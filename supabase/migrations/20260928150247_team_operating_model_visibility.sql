create or replace function public.list_workspace_operating_model(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_can_manage_all boolean;
  v_teams jsonb;
  v_functions jsonb;
  v_members jsonb;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;

  v_role := private.current_workspace_role(p_workspace_id);
  if v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_WORKSPACE_NOT_FOUND';
  end if;
  if v_role = 'viewer'::public.workspace_role then
    raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
  end if;

  v_can_manage_all := private.can_manage_operating_model(p_workspace_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', team.id,
        'name', team.name,
        'slug', team.slug,
        'description', team.description,
        'color', team.color,
        'is_default', team.is_default,
        'version', team.version,
        'created_at', team.created_at,
        'updated_at', team.updated_at,
        'member_count', (
          select count(*)
          from public.team_members counted_member
          where counted_member.workspace_id = team.workspace_id
            and counted_member.team_id = team.id
            and counted_member.removed_at is null
        ),
        'can_manage_members', (
          v_can_manage_all
          or private.current_team_role(team.id, v_actor) = 'lead'::public.team_member_role
        ),
        'members', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'user_id', team_member.user_id,
                'full_name', profile.full_name,
                'initials', coalesce(
                  nullif(btrim(profile.initials), ''),
                  upper(left(btrim(profile.full_name), 1))
                ),
                'avatar_path', profile.avatar_path,
                'workspace_role', workspace_member.role,
                'team_role', team_member.role,
                'is_primary_team', team_member.is_primary,
                'version', team_member.version,
                'functions', (
                  select coalesce(
                    jsonb_agg(
                      jsonb_build_object(
                        'id', job_function.id,
                        'name', job_function.name,
                        'category', job_function.category,
                        'is_primary', member_function.is_primary,
                        'assignment_version', member_function.version
                      )
                      order by member_function.is_primary desc,
                        job_function.position,
                        lower(job_function.name),
                        job_function.id
                    ),
                    '[]'::jsonb
                  )
                  from public.team_member_functions member_function
                  join public.job_functions job_function
                    on job_function.workspace_id = member_function.workspace_id
                    and job_function.id = member_function.job_function_id
                    and job_function.archived_at is null
                  where member_function.workspace_id = team_member.workspace_id
                    and member_function.team_id = team_member.team_id
                    and member_function.user_id = team_member.user_id
                    and member_function.archived_at is null
                )
              )
              order by
                case team_member.role
                  when 'lead'::public.team_member_role then 0
                  else 1
                end,
                lower(profile.full_name),
                team_member.user_id
            ),
            '[]'::jsonb
          )
          from public.team_members team_member
          join public.workspace_members workspace_member
            on workspace_member.workspace_id = team_member.workspace_id
            and workspace_member.user_id = team_member.user_id
            and workspace_member.status = 'active'::public.membership_status
            and workspace_member.removed_at is null
          join public.profiles profile
            on profile.id = team_member.user_id
            and profile.is_active
          where team_member.workspace_id = team.workspace_id
            and team_member.team_id = team.id
            and team_member.removed_at is null
            and (
              v_can_manage_all
              or team_member.user_id = v_actor
              or private.current_team_role(team.id, v_actor) = 'lead'::public.team_member_role
            )
        )
      )
      order by team.is_default desc, lower(team.name), team.id
    ),
    '[]'::jsonb
  )
  into v_teams
  from public.teams team
  where team.workspace_id = p_workspace_id
    and team.archived_at is null and private.can_read_team(team.id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', job_function.id,
        'system_key', job_function.system_key,
        'name', job_function.name,
        'category', job_function.category,
        'description', job_function.description,
        'position', job_function.position,
        'is_system', job_function.is_system,
        'version', job_function.version
      )
      order by job_function.position, lower(job_function.name), job_function.id
    ),
    '[]'::jsonb
  )
  into v_functions
  from public.job_functions job_function
  where job_function.workspace_id = p_workspace_id
    and job_function.archived_at is null;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', workspace_member.user_id,
        'full_name', profile.full_name,
        'initials', coalesce(
          nullif(btrim(profile.initials), ''),
          upper(left(btrim(profile.full_name), 1))
        ),
        'avatar_path', profile.avatar_path,
        'workspace_role', workspace_member.role,
        'workspace_member_version', workspace_member.version,
        'primary_team_id', (
          select team_member.team_id
          from public.team_members team_member
          where team_member.workspace_id = workspace_member.workspace_id
            and team_member.user_id = workspace_member.user_id
            and private.can_read_team(team_member.team_id) and team_member.is_primary
            and team_member.removed_at is null
          limit 1
        )
      )
      order by lower(profile.full_name), workspace_member.user_id
    ),
    '[]'::jsonb
  )
  into v_members
  from public.workspace_members workspace_member
  join public.profiles profile
    on profile.id = workspace_member.user_id
    and profile.is_active
  where workspace_member.workspace_id = p_workspace_id
    and workspace_member.status = 'active'::public.membership_status
    and workspace_member.removed_at is null
    and (
      v_can_manage_all
      or workspace_member.user_id = v_actor
      or exists (
        select 1
        from public.team_members actor_team
        join public.team_members visible_team
          on visible_team.workspace_id = actor_team.workspace_id
          and visible_team.team_id = actor_team.team_id
          and visible_team.user_id = workspace_member.user_id
          and visible_team.removed_at is null
        where actor_team.workspace_id = p_workspace_id
          and actor_team.user_id = v_actor
          and actor_team.role = 'lead'::public.team_member_role
          and actor_team.removed_at is null
      )
    );

  return jsonb_build_object(
    'workspace_id', p_workspace_id,
    'workspace_role', v_role,
    'teams', v_teams,
    'job_functions', v_functions,
    'members', v_members,
    'permissions', jsonb_build_object(
      'can_manage_teams', v_can_manage_all,
      'can_manage_job_functions', v_can_manage_all,
      'can_manage_all_team_members', v_can_manage_all
    )
  );
end;
$$;
