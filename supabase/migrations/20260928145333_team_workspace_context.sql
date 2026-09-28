-- An operational team owns one internal event context for the existing task UI.
-- Existing contexts are deliberately not merged or reassigned by this migration.
alter table public.teams add column workspace_event_id uuid;
alter table public.teams add constraint teams_workspace_event_fk
  foreign key (workspace_id, workspace_event_id) references public.events(workspace_id,id);
alter table public.teams add constraint teams_workspace_event_unique unique(workspace_id,workspace_event_id);

create or replace function private.guard_team_workspace_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.workspace_event_id is not null
    and new.workspace_event_id is distinct from old.workspace_event_id then
    raise exception using errcode = '23514', message = 'PTA_TEAM_WORKSPACE_IMMUTABLE';
  end if;
  if new.workspace_event_id is not null then
    perform 1 from public.events where workspace_id = new.workspace_id and id = new.workspace_event_id
      and primary_team_id = new.id and archived_at is null for share;
    if not found then raise exception using errcode = '23514', message = 'PTA_TEAM_WORKSPACE_INVALID'; end if;
  end if;
  return new;
end;
$$;
create trigger teams_guard_workspace_event before insert or update of workspace_event_id on public.teams
  for each row execute function private.guard_team_workspace_event();

create or replace function private.guard_team_context_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.teams t where t.workspace_id = old.workspace_id and t.workspace_event_id = old.id
    and (new.primary_team_id is distinct from t.id or (new.archived_at is not null and t.archived_at is null))) then
    raise exception using errcode = '23514', message = 'PTA_TEAM_WORKSPACE_PROTECTED';
  end if;
  return new;
end;
$$;
create trigger events_guard_team_context before update of primary_team_id,archived_at on public.events
  for each row execute function private.guard_team_context_event();

create or replace function private.guard_team_project_archive()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.archived_at is null and new.archived_at is not null then
    if exists(select 1 from public.events where workspace_id = new.workspace_id and primary_team_id = new.id
      and id is distinct from new.workspace_event_id and archived_at is null) then
      raise exception using errcode = '23514', message = 'PTA_TEAM_HAS_ACTIVE_PROJECTS';
    end if;
    if exists(select 1 from public.tasks where workspace_id = new.workspace_id
      and event_id = new.workspace_event_id and archived_at is null) then
      raise exception using errcode = '23514', message = 'PTA_TEAM_HAS_ACTIVE_TASKS';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.archive_team_context_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.archived_at is null and new.archived_at is not null and new.workspace_event_id is not null then
    update public.events set archived_at = new.archived_at, updated_by = auth.uid()
      where workspace_id = new.workspace_id and id = new.workspace_event_id and archived_at is null;
    insert into public.activity_logs(workspace_id,actor_id,entity_type,entity_id,action)
      values(new.workspace_id,auth.uid(),'event',new.workspace_event_id,'event.archived_with_team');
  end if;
  return new;
end;
$$;
create trigger teams_archive_context_event after update of archived_at on public.teams
  for each row execute function private.archive_team_context_event();

create or replace function public.create_operating_team_workspace(
  p_workspace_id uuid, p_name text, p_slug text, p_description text default null, p_color text default 'blue'
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_team jsonb; v_event jsonb; v_version integer;
begin
  v_team := public.create_operating_team(p_workspace_id,p_name,p_slug,p_description,p_color);
  v_event := public.create_team_project(p_workspace_id,(v_team->>'id')::uuid,p_name);
  update public.teams set workspace_event_id = (v_event->>'id')::uuid
    where workspace_id = p_workspace_id and id = (v_team->>'id')::uuid returning version into v_version;
  return jsonb_build_object('team', v_team || jsonb_build_object('workspace_event_id',v_event->>'id','version',v_version));
end;
$$;

create or replace function public.archive_team_workspace(p_team_id uuid,p_expected_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  -- Existing RPC validates actor, role, version, default team, memberships and tasks.
  -- Triggers archive its internal event only after those validations succeed.
  return public.archive_operating_team(p_team_id,p_expected_version);
end;
$$;
revoke all on function private.guard_team_workspace_event() from public,anon,authenticated;
revoke all on function private.guard_team_context_event() from public,anon,authenticated;
revoke all on function private.archive_team_context_event() from public,anon,authenticated;
revoke all on function public.create_operating_team_workspace(uuid,text,text,text,text) from public,anon;
revoke all on function public.archive_team_workspace(uuid,integer) from public,anon;
grant execute on function public.create_operating_team_workspace(uuid,text,text,text,text) to authenticated;
grant execute on function public.archive_team_workspace(uuid,integer) to authenticated;

-- Preserve an unambiguous existing context. Multiple contexts require an explicit mapping.
do $$
declare t record; v_id uuid; v_count integer;
begin
  for t in select * from public.teams where archived_at is null and workspace_event_id is null loop
    select count(*), (array_agg(id order by created_at,id))[1] into v_count,v_id
      from public.events where workspace_id = t.workspace_id and primary_team_id = t.id and archived_at is null;
    if v_count = 0 then
      v_id := gen_random_uuid();
      insert into public.events(id,workspace_id,name,slug,primary_team_id,created_by,updated_by)
        values(v_id,t.workspace_id,t.name,private.portfolio_slug(t.name,v_id),t.id,t.created_by,t.created_by);
    end if;
    if v_count <= 1 then
      update public.teams set workspace_event_id = v_id where workspace_id = t.workspace_id and id = t.id;
    end if;
  end loop;
end;
$$;
create or replace function public.list_team_directory(p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.uid() is null or private.current_workspace_role(p_workspace_id) is null then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  with task_counts as (select event_id,count(*) as n from public.tasks where workspace_id = p_workspace_id and archived_at is null group by event_id), member_counts as (
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
      where t.workspace_id = p_workspace_id and t.archived_at is null), '[]'::jsonb),
    'unassigned_count', coalesce((select n from project_counts where primary_team_id is null),0),
    'can_manage', private.can_manage_operating_model(p_workspace_id)
  ) into v_result;
  return v_result;
end;
$$;
