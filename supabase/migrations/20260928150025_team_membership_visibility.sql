-- Team membership is a visibility boundary, including for workspace administrators.
create or replace function private.can_read_team(p_team_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.teams t join public.team_members m
    on m.workspace_id = t.workspace_id and m.team_id = t.id
    where t.id = p_team_id and t.archived_at is null and m.removed_at is null
      and m.user_id = (select auth.uid()) and private.is_active_workspace_member(t.workspace_id));
$$;
create or replace function private.can_read_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.events e where e.id = p_event_id
    and private.is_active_workspace_member(e.workspace_id)
    and (e.primary_team_id is null or private.can_read_team(e.primary_team_id)));
$$;
create or replace function private.can_read_task(p_task_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.tasks t where t.id = p_task_id
    and private.is_active_workspace_member(t.workspace_id)
    and (t.event_id is null or private.can_read_event(t.event_id))
    and (t.team_id is null or private.can_read_team(t.team_id)));
$$;
revoke all on function private.can_read_team(uuid) from public,anon;
revoke all on function private.can_read_event(uuid) from public,anon;
revoke all on function private.can_read_task(uuid) from public,anon;
grant execute on function private.can_read_team(uuid) to authenticated;
grant execute on function private.can_read_event(uuid) to authenticated;
grant execute on function private.can_read_task(uuid) to authenticated;

-- Restrictive policies supplement existing policies rather than widen them.
create policy teams_member_visibility on public.teams as restrictive for select to authenticated using(private.can_read_team(id));
create policy team_members_member_visibility on public.team_members as restrictive for select to authenticated using(private.can_read_team(team_id));
create policy team_functions_member_visibility on public.team_member_functions as restrictive for select to authenticated using(private.can_read_team(team_id));
create policy events_team_visibility on public.events as restrictive for select to authenticated using(private.can_read_event(id));
create policy tasks_team_visibility on public.tasks as restrictive for select to authenticated using(private.can_read_task(id));
create policy event_members_team_visibility on public.event_members as restrictive for select to authenticated using(private.can_read_event(event_id));
create policy event_phases_team_visibility on public.event_phases as restrictive for select to authenticated using(private.can_read_event(event_id));
create policy event_milestones_team_visibility on public.event_milestones as restrictive for select to authenticated using(private.can_read_event(event_id));
create policy task_assignees_team_visibility on public.task_assignees as restrictive for select to authenticated using(private.can_read_task(task_id));
create policy task_checklists_team_visibility on public.task_checklists as restrictive for select to authenticated using(private.can_read_task(task_id));
create policy task_checklist_items_team_visibility on public.task_checklist_items as restrictive for select to authenticated using(private.can_read_task(task_id));
create policy task_comments_team_visibility on public.task_comments as restrictive for select to authenticated using(private.can_read_task(task_id));
create policy task_links_team_visibility on public.task_links as restrictive for select to authenticated using(private.can_read_task(task_id));
create policy task_attachments_team_visibility on public.task_attachments as restrictive for select to authenticated using(private.can_read_task(task_id));
create policy task_custom_values_team_visibility on public.task_custom_field_values as restrictive for select to authenticated using(private.can_read_task(task_id));
create policy task_approvals_team_visibility on public.task_approval_requests as restrictive for select to authenticated using(private.can_read_task(task_id));
create policy task_dependencies_team_visibility on public.task_dependencies as restrictive for select to authenticated
  using(private.can_read_task(blocking_task_id) and private.can_read_task(blocked_task_id));
create policy task_subtasks_team_visibility on public.task_subtasks as restrictive for select to authenticated
  using(private.can_read_task(parent_task_id) and private.can_read_task(child_task_id));
create policy task_handoffs_team_visibility on public.task_handoffs as restrictive for select to authenticated
  using(private.can_read_task(source_task_id) and private.can_read_task(target_task_id));
create policy resource_tasks_team_visibility on public.resource_tasks as restrictive for select to authenticated using(private.can_read_task(task_id));
create policy resource_events_team_visibility on public.resource_events as restrictive for select to authenticated using(private.can_read_event(event_id));

create or replace function private.can_read_domain_entity(p_entity_type text,p_entity_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_entity_type = 'task' then private.can_read_task(p_entity_id)
    when p_entity_type in ('event','project') then private.can_read_event(p_entity_id)
    when p_entity_type = 'team' then private.can_read_team(p_entity_id)
    when p_entity_type = 'event_phase' then exists(select 1 from public.event_phases where id = p_entity_id and private.can_read_event(event_id))
    when p_entity_type = 'event_milestone' then exists(select 1 from public.event_milestones where id = p_entity_id and private.can_read_event(event_id))
    when p_entity_type like 'team_%' then false
    else true end;
$$;
revoke all on function private.can_read_domain_entity(text,uuid) from public,anon;
grant execute on function private.can_read_domain_entity(text,uuid) to authenticated;
create policy activity_team_visibility on public.activity_logs as restrictive for select to authenticated
  using(private.can_read_domain_entity(entity_type,entity_id));
create policy notifications_team_visibility on public.notifications as restrictive for select to authenticated
  using(private.can_read_domain_entity(entity_type,entity_id));
create or replace function public.list_team_directory(p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.uid() is null or private.current_workspace_role(p_workspace_id) is null then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  with task_counts as (select event_id,count(*) as n from public.tasks where workspace_id = p_workspace_id and archived_at is null and private.can_read_task(id) group by event_id), member_counts as (
    select team_id, count(*) as n from public.team_members
    where workspace_id = p_workspace_id and removed_at is null group by team_id
  ), project_counts as (
    select primary_team_id, count(*) as n from public.events
    where workspace_id = p_workspace_id and archived_at is null group by primary_team_id
  )
  select jsonb_build_object(
    'teams', coalesce((select jsonb_agg(jsonb_build_object(
      'id', t.id, 'name', t.name, 'description', t.description, 'color', t.color,
      'workspace_event_id', t.workspace_event_id, 'task_count', coalesce(tc.n,0), 'version', t.version, 'member_count', coalesce(m.n,0), 'project_count', coalesce(p.n,0)
    ) order by t.name, t.id) from public.teams t
      left join task_counts tc on tc.event_id = t.workspace_event_id left join member_counts m on m.team_id = t.id
      left join project_counts p on p.primary_team_id = t.id
      where t.workspace_id = p_workspace_id and t.archived_at is null and private.can_read_team(t.id)), '[]'::jsonb),
    'unassigned_count', coalesce((select n from project_counts where primary_team_id is null),0),
    'can_manage', private.can_manage_operating_model(p_workspace_id)
  ) into v_result;
  return v_result;
end;
$$;



create or replace function public.list_team_projects(
  p_workspace_id uuid, p_team_id uuid default null, p_unassigned boolean default false,
  p_search text default '', p_offset integer default 0, p_limit integer default 30
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.uid() is null or private.current_workspace_role(p_workspace_id) is null then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if p_offset is null or p_offset < 0 or p_limit is null or p_limit < 1 or p_limit > 100
    or length(coalesce(p_search,'')) > 200 or (p_team_id is not null and p_unassigned) then
    raise exception using errcode = '22023', message = 'PTA_INVALID_FILTER';
  end if;
  if p_team_id is not null and not exists (select 1 from public.teams
    where workspace_id = p_workspace_id and id = p_team_id and archived_at is null and private.can_read_team(id)) then
    raise exception using errcode = 'P0002', message = 'PTA_TEAM_NOT_FOUND';
  end if;
  with filtered as materialized (
    select e.id, e.name, e.status, e.version, e.primary_team_id, t.name as team_name, e.start_date, e.end_date
    from public.events e left join public.teams t on t.workspace_id = e.workspace_id and t.id = e.primary_team_id
    where e.workspace_id = p_workspace_id and e.archived_at is null and private.can_read_event(e.id)
      and (p_team_id is null or e.primary_team_id = p_team_id)
      and (not coalesce(p_unassigned,false) or e.primary_team_id is null)
      and (coalesce(btrim(p_search),'') = '' or strpos(lower(e.name),lower(btrim(p_search))) > 0)
  ), page as (select * from filtered order by name, id offset p_offset limit p_limit)
  select jsonb_build_object('projects', coalesce((select jsonb_agg(to_jsonb(page) order by name,id) from page),'[]'::jsonb),
    'total', (select count(*) from filtered)) into v_result;
  return v_result;
end;
$$;
