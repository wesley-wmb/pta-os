-- Teams organize projects without changing workspace visibility or task ownership.
alter table public.events add column primary_team_id uuid;
alter table public.events add constraint events_primary_team_workspace_fk
  foreign key (workspace_id, primary_team_id) references public.teams(workspace_id, id);
create index events_active_primary_team_idx on public.events(workspace_id, primary_team_id, name, id)
  where archived_at is null;

create or replace function private.guard_project_team()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.primary_team_id is not null then
    perform 1 from public.teams where workspace_id = new.workspace_id
      and id = new.primary_team_id and archived_at is null for share;
    if not found then raise exception using errcode = '23514', message = 'PTA_TEAM_NOT_ACTIVE'; end if;
  end if;
  return new;
end;
$$;
create trigger events_guard_primary_team before insert or update of primary_team_id, workspace_id
  on public.events for each row execute function private.guard_project_team();

create or replace function private.guard_team_project_archive()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.archived_at is null and new.archived_at is not null and exists (
    select 1 from public.events where workspace_id = new.workspace_id
      and primary_team_id = new.id and archived_at is null
  ) then raise exception using errcode = '23514', message = 'PTA_TEAM_HAS_ACTIVE_PROJECTS'; end if;
  return new;
end;
$$;
create trigger teams_guard_project_archive before update of archived_at on public.teams
  for each row execute function private.guard_team_project_archive();
revoke all on function private.guard_project_team() from public, anon, authenticated;
revoke all on function private.guard_team_project_archive() from public, anon, authenticated;

create or replace function public.list_team_directory(p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.uid() is null or private.current_workspace_role(p_workspace_id) is null then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  with member_counts as (
    select team_id, count(*) as n from public.team_members
    where workspace_id = p_workspace_id and removed_at is null group by team_id
  ), project_counts as (
    select primary_team_id, count(*) as n from public.events
    where workspace_id = p_workspace_id and archived_at is null group by primary_team_id
  )
  select jsonb_build_object(
    'teams', coalesce((select jsonb_agg(jsonb_build_object(
      'id', t.id, 'name', t.name, 'description', t.description, 'color', t.color,
      'version', t.version, 'member_count', coalesce(m.n,0), 'project_count', coalesce(p.n,0)
    ) order by t.name, t.id) from public.teams t
      left join member_counts m on m.team_id = t.id
      left join project_counts p on p.primary_team_id = t.id
      where t.workspace_id = p_workspace_id and t.archived_at is null), '[]'::jsonb),
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
    where workspace_id = p_workspace_id and id = p_team_id and archived_at is null) then
    raise exception using errcode = 'P0002', message = 'PTA_TEAM_NOT_FOUND';
  end if;
  with filtered as materialized (
    select e.id, e.name, e.status, e.version, e.primary_team_id, t.name as team_name, e.start_date, e.end_date
    from public.events e left join public.teams t on t.workspace_id = e.workspace_id and t.id = e.primary_team_id
    where e.workspace_id = p_workspace_id and e.archived_at is null
      and (p_team_id is null or e.primary_team_id = p_team_id)
      and (not coalesce(p_unassigned,false) or e.primary_team_id is null)
      and (coalesce(btrim(p_search),'') = '' or strpos(lower(e.name),lower(btrim(p_search))) > 0)
  ), page as (select * from filtered order by name, id offset p_offset limit p_limit)
  select jsonb_build_object('projects', coalesce((select jsonb_agg(to_jsonb(page) order by name,id) from page),'[]'::jsonb),
    'total', (select count(*) from filtered)) into v_result;
  return v_result;
end;
$$;

create or replace function public.set_project_team(
  p_workspace_id uuid, p_project_id uuid, p_team_id uuid, p_expected_version integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_project public.events%rowtype; v_old_team uuid;
begin
  if auth.uid() is null or not private.can_manage_operating_model(p_workspace_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_EXPECTED_VERSION';
  end if;
  -- Lock the destination before the project, consistently with archival.
  if p_team_id is not null then
    perform 1 from public.teams where workspace_id = p_workspace_id and id = p_team_id
      and archived_at is null for share;
    if not found then raise exception using errcode = '23514', message = 'PTA_TEAM_NOT_ACTIVE'; end if;
  end if;
  select * into v_project from public.events where workspace_id = p_workspace_id
    and id = p_project_id and archived_at is null for update;
  if not found then raise exception using errcode = 'P0002', message = 'PTA_EVENT_NOT_FOUND'; end if;
  if v_project.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;
  if v_project.primary_team_id is not distinct from p_team_id then
    return jsonb_build_object('id', v_project.id, 'version', v_project.version);
  end if;
  v_old_team := v_project.primary_team_id;
  update public.events set primary_team_id = p_team_id, updated_by = auth.uid()
    where workspace_id = p_workspace_id and id = p_project_id returning * into v_project;
  insert into public.activity_logs(workspace_id,actor_id,entity_type,entity_id,action,changes_json)
    values(p_workspace_id,auth.uid(),'event',p_project_id,'event.team_changed',
      jsonb_build_object('previous_team_id',v_old_team,'primary_team_id',p_team_id));
  return jsonb_build_object('id',v_project.id,'version',v_project.version);
end;
$$;

create or replace function public.create_team_project(p_workspace_id uuid, p_team_id uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_project jsonb;
begin
  if auth.uid() is null or not private.can_manage_operating_model(p_workspace_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if p_name is null or length(btrim(p_name)) < 2 or length(btrim(p_name)) > 200 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_NAME';
  end if;
  if p_team_id is not null then
    perform 1 from public.teams where workspace_id = p_workspace_id and id = p_team_id
      and archived_at is null for share;
    if not found then raise exception using errcode = '23514', message = 'PTA_TEAM_NOT_ACTIVE'; end if;
  end if;
  v_project := public.create_event_operational(p_workspace_id => p_workspace_id, p_name => btrim(p_name));
  if p_team_id is not null then
    v_project := public.set_project_team(p_workspace_id,(v_project->>'id')::uuid,p_team_id,(v_project->>'version')::integer);
  end if;
  return v_project;
end;
$$;

revoke all on function public.list_team_directory(uuid) from public, anon;
revoke all on function public.list_team_projects(uuid,uuid,boolean,text,integer,integer) from public, anon;
revoke all on function public.set_project_team(uuid,uuid,uuid,integer) from public, anon;
revoke all on function public.create_team_project(uuid,uuid,text) from public, anon;
grant execute on function public.list_team_directory(uuid) to authenticated;
grant execute on function public.list_team_projects(uuid,uuid,boolean,text,integer,integer) to authenticated;
grant execute on function public.set_project_team(uuid,uuid,uuid,integer) to authenticated;
grant execute on function public.create_team_project(uuid,uuid,text) to authenticated;
