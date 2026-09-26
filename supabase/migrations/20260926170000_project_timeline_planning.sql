-- Project timeline planning: date ranges, custom phases and versioned drag/drop RPCs.

begin;

create table public.event_phases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  event_id uuid not null,
  name text not null,
  color text not null default 'blue',
  position numeric(20, 10) not null default 1000,
  start_date date,
  end_date date,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  version integer not null default 1,
  unique (workspace_id, id),
  unique (workspace_id, event_id, id),
  foreign key (workspace_id, event_id)
    references public.events(workspace_id, id) on delete cascade,
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, updated_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint event_phases_name_length check (char_length(btrim(name)) between 2 and 120),
  constraint event_phases_color_valid check (color in ('slate', 'blue', 'indigo', 'violet', 'pink', 'red', 'orange', 'amber', 'emerald', 'teal')),
  constraint event_phases_position_valid check (position >= 0),
  constraint event_phases_dates_valid check (start_date is null or end_date is null or end_date >= start_date),
  constraint event_phases_version_valid check (version >= 1)
);

create index event_phases_event_position_idx
  on public.event_phases (workspace_id, event_id, position, id)
  where archived_at is null;

alter table public.tasks
  add column start_date date,
  add column start_time time without time zone,
  add column event_phase_id uuid;

alter table public.tasks
  add constraint tasks_start_time_requires_date
    check (start_time is null or start_date is not null),
  add constraint tasks_start_requires_due_date
    check (start_date is null or due_date is not null),
  add constraint tasks_schedule_range_valid
    check (
      start_date is null
      or due_date > start_date
      or (
        due_date = start_date
        and (start_time is null or due_time is null or due_time >= start_time)
      )
    ),
  add constraint tasks_phase_requires_event
    check (event_phase_id is null or event_id is not null),
  add constraint tasks_workspace_event_phase_fkey
    foreign key (workspace_id, event_id, event_phase_id)
    references public.event_phases(workspace_id, event_id, id) on delete restrict;

create index tasks_workspace_event_timeline_idx
  on public.tasks (workspace_id, event_id, start_date, due_date, status_id)
  where archived_at is null;

alter table public.event_milestones
  add column event_phase_id uuid;

alter table public.event_milestones
  add constraint event_milestones_workspace_event_phase_fkey
    foreign key (workspace_id, event_id, event_phase_id)
    references public.event_phases(workspace_id, event_id, id) on delete restrict;

create index event_milestones_phase_date_idx
  on public.event_milestones (workspace_id, event_id, event_phase_id, due_date, position);

create or replace function private.event_phases_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.workspace_id := old.workspace_id;
    new.event_id := old.event_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.version := old.version + 1;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger event_phases_before_write
before insert or update on public.event_phases
for each row execute function private.event_phases_before_write();

alter table public.event_phases enable row level security;
alter table public.event_phases force row level security;

create policy event_phases_select_workspace_member
on public.event_phases for select to authenticated
using (private.is_active_workspace_member(workspace_id));

revoke all on table public.event_phases from public, anon;
revoke insert, update, delete, truncate on table public.event_phases from authenticated;
grant select on table public.event_phases to authenticated;

create or replace function public.create_event_phase(
  p_workspace_id uuid,
  p_event_id uuid,
  p_name text,
  p_color text default 'blue',
  p_start_date date default null,
  p_end_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_phase public.event_phases%rowtype;
begin
  if v_actor is null
     or coalesce(private.current_workspace_role(p_workspace_id) not in ('owner', 'admin', 'manager'), true) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.events event
    where event.workspace_id = p_workspace_id
      and event.id = p_event_id
      and event.archived_at is null
  ) then
    raise exception using errcode = 'P0002', message = 'PTA_EVENT_NOT_FOUND';
  end if;

  insert into public.event_phases (
    workspace_id, event_id, name, color, position, start_date, end_date, created_by, updated_by
  ) values (
    p_workspace_id,
    p_event_id,
    p_name,
    p_color,
    coalesce((
      select max(phase.position) + 1000
      from public.event_phases phase
      where phase.workspace_id = p_workspace_id
        and phase.event_id = p_event_id
        and phase.archived_at is null
    ), 1000),
    p_start_date,
    p_end_date,
    v_actor,
    v_actor
  ) returning * into v_phase;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, metadata_json
  ) values (
    p_workspace_id, v_actor, 'event_phase', v_phase.id, 'event.phase_created',
    jsonb_build_object('event_id', p_event_id)
  );

  return jsonb_build_object(
    'id', v_phase.id,
    'version', v_phase.version,
    'position', v_phase.position
  );
end;
$$;

create or replace function public.update_event_phase(
  p_workspace_id uuid,
  p_phase_id uuid,
  p_expected_version integer,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_phase public.event_phases%rowtype;
begin
  if v_actor is null
     or coalesce(private.current_workspace_role(p_workspace_id) not in ('owner', 'admin', 'manager'), true) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception using errcode = '22023', message = 'PTA_PATCH_MUST_BE_OBJECT';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_patch) patch(key)
    where patch.key <> all (array['name', 'color', 'position', 'start_date', 'end_date']::text[])
  ) then
    raise exception using errcode = '22023', message = 'PTA_PATCH_HAS_UNSUPPORTED_FIELDS';
  end if;

  select phase.* into v_phase
  from public.event_phases phase
  where phase.workspace_id = p_workspace_id
    and phase.id = p_phase_id
    and phase.archived_at is null
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'PTA_PHASE_NOT_FOUND'; end if;
  if v_phase.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  update public.event_phases phase set
    name = case when p_patch ? 'name' then p_patch->>'name' else phase.name end,
    color = case when p_patch ? 'color' then p_patch->>'color' else phase.color end,
    position = case when p_patch ? 'position' then (p_patch->>'position')::numeric else phase.position end,
    start_date = case when p_patch ? 'start_date' then nullif(p_patch->>'start_date', '')::date else phase.start_date end,
    end_date = case when p_patch ? 'end_date' then nullif(p_patch->>'end_date', '')::date else phase.end_date end,
    updated_by = v_actor
  where phase.workspace_id = p_workspace_id
    and phase.id = p_phase_id
    and phase.version = p_expected_version
  returning * into v_phase;
  if not found then raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT'; end if;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, changes_json
  ) values (
    p_workspace_id, v_actor, 'event_phase', v_phase.id, 'event.phase_updated', p_patch
  );

  return jsonb_build_object(
    'id', v_phase.id,
    'version', v_phase.version,
    'updated_at', v_phase.updated_at
  );
end;
$$;

create or replace function public.archive_event_phase(
  p_workspace_id uuid,
  p_phase_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_phase public.event_phases%rowtype;
begin
  if v_actor is null
     or coalesce(private.current_workspace_role(p_workspace_id) not in ('owner', 'admin', 'manager'), true) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  select phase.* into v_phase
  from public.event_phases phase
  where phase.workspace_id = p_workspace_id
    and phase.id = p_phase_id
    and phase.archived_at is null
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'PTA_PHASE_NOT_FOUND'; end if;
  if v_phase.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  update public.tasks task
  set event_phase_id = null, updated_by = v_actor
  where task.workspace_id = p_workspace_id and task.event_phase_id = p_phase_id;
  update public.event_milestones milestone
  set event_phase_id = null, updated_by = v_actor
  where milestone.workspace_id = p_workspace_id and milestone.event_phase_id = p_phase_id;
  update public.event_phases phase
  set archived_at = clock_timestamp(), updated_by = v_actor
  where phase.workspace_id = p_workspace_id
    and phase.id = p_phase_id
    and phase.version = p_expected_version
  returning * into v_phase;
  if not found then raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT'; end if;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, metadata_json
  ) values (
    p_workspace_id, v_actor, 'event_phase', v_phase.id, 'event.phase_archived',
    jsonb_build_object('event_id', v_phase.event_id)
  );
  return jsonb_build_object('id', v_phase.id, 'version', v_phase.version);
end;
$$;

create or replace function public.create_event_milestone_in_phase(
  p_workspace_id uuid,
  p_event_id uuid,
  p_event_phase_id uuid,
  p_title text,
  p_due_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_milestone public.event_milestones%rowtype;
begin
  if v_actor is null
     or coalesce(private.current_workspace_role(p_workspace_id) not in ('owner', 'admin', 'manager'), true) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.events event
    where event.workspace_id = p_workspace_id and event.id = p_event_id and event.archived_at is null
  ) then
    raise exception using errcode = 'P0002', message = 'PTA_EVENT_NOT_FOUND';
  end if;
  if p_event_phase_id is not null and not exists (
    select 1 from public.event_phases phase
    where phase.workspace_id = p_workspace_id
      and phase.event_id = p_event_id
      and phase.id = p_event_phase_id
      and phase.archived_at is null
  ) then
    raise exception using errcode = '23514', message = 'PTA_PHASE_NOT_ACTIVE';
  end if;

  insert into public.event_milestones (
    workspace_id, event_id, event_phase_id, title, due_date, phase, position, created_by, updated_by
  ) values (
    p_workspace_id, p_event_id, p_event_phase_id, p_title, p_due_date, 'preparation',
    coalesce((select max(milestone.position) + 1000 from public.event_milestones milestone
      where milestone.workspace_id = p_workspace_id and milestone.event_id = p_event_id), 1000),
    v_actor, v_actor
  ) returning * into v_milestone;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, metadata_json
  ) values (
    p_workspace_id, v_actor, 'event_milestone', v_milestone.id, 'event.milestone_created',
    jsonb_build_object('event_id', p_event_id, 'event_phase_id', p_event_phase_id)
  );
  return jsonb_build_object('id', v_milestone.id, 'version', v_milestone.version);
end;
$$;

create or replace function public.move_event_milestone_in_timeline(
  p_workspace_id uuid,
  p_milestone_id uuid,
  p_expected_version integer,
  p_event_phase_id uuid,
  p_due_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_milestone public.event_milestones%rowtype;
begin
  if v_actor is null
     or coalesce(private.current_workspace_role(p_workspace_id) not in ('owner', 'admin', 'manager'), true) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  select milestone.* into v_milestone
  from public.event_milestones milestone
  where milestone.workspace_id = p_workspace_id and milestone.id = p_milestone_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'PTA_MILESTONE_NOT_FOUND'; end if;
  if v_milestone.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;
  if p_event_phase_id is not null and not exists (
    select 1 from public.event_phases phase
    where phase.workspace_id = p_workspace_id
      and phase.event_id = v_milestone.event_id
      and phase.id = p_event_phase_id
      and phase.archived_at is null
  ) then
    raise exception using errcode = '23514', message = 'PTA_PHASE_NOT_ACTIVE';
  end if;

  update public.event_milestones milestone set
    event_phase_id = p_event_phase_id,
    due_date = p_due_date,
    updated_by = v_actor
  where milestone.workspace_id = p_workspace_id
    and milestone.id = p_milestone_id
    and milestone.version = p_expected_version
  returning * into v_milestone;
  if not found then raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT'; end if;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, changes_json
  ) values (
    p_workspace_id, v_actor, 'event_milestone', v_milestone.id, 'event.milestone_moved',
    jsonb_build_object('event_phase_id', p_event_phase_id, 'due_date', p_due_date)
  );
  return jsonb_build_object(
    'id', v_milestone.id,
    'version', v_milestone.version,
    'event_phase_id', v_milestone.event_phase_id,
    'due_date', v_milestone.due_date
  );
end;
$$;

create or replace function public.move_task_in_timeline(
  p_workspace_id uuid,
  p_event_id uuid,
  p_task_id uuid,
  p_expected_version integer,
  p_status_id uuid,
  p_event_phase_id uuid,
  p_start_date date,
  p_start_time time without time zone,
  p_due_date date,
  p_due_time time without time zone
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_task public.tasks%rowtype;
begin
  if v_actor is null or not private.can_edit_task(p_task_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;

  select task.* into v_task
  from public.tasks task
  where task.workspace_id = p_workspace_id
    and task.event_id = p_event_id
    and task.id = p_task_id
    and task.archived_at is null
  for update;
  if not found then raise exception using errcode = '42501', message = 'PTA_FORBIDDEN'; end if;
  if v_task.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;
  if not exists (
    select 1 from public.task_statuses status
    where status.workspace_id = p_workspace_id and status.id = p_status_id and status.is_active
  ) then
    raise exception using errcode = '23514', message = 'PTA_STATUS_NOT_ACTIVE';
  end if;
  if p_event_phase_id is not null and not exists (
    select 1 from public.event_phases phase
    where phase.workspace_id = p_workspace_id
      and phase.event_id = p_event_id
      and phase.id = p_event_phase_id
      and phase.archived_at is null
  ) then
    raise exception using errcode = '23514', message = 'PTA_PHASE_NOT_ACTIVE';
  end if;

  update public.tasks task set
    status_id = p_status_id,
    event_phase_id = p_event_phase_id,
    start_date = p_start_date,
    start_time = p_start_time,
    due_date = p_due_date,
    due_time = p_due_time,
    updated_by = v_actor
  where task.workspace_id = p_workspace_id
    and task.event_id = p_event_id
    and task.id = p_task_id
    and task.version = p_expected_version
  returning * into v_task;
  if not found then raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT'; end if;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, changes_json
  ) values (
    p_workspace_id, v_actor, 'task', v_task.id, 'task.timeline_moved',
    jsonb_build_object(
      'status_id', v_task.status_id,
      'event_phase_id', v_task.event_phase_id,
      'start_date', v_task.start_date,
      'start_time', v_task.start_time,
      'due_date', v_task.due_date,
      'due_time', v_task.due_time
    )
  );

  return jsonb_build_object(
    'id', v_task.id,
    'version', v_task.version,
    'status_id', v_task.status_id,
    'event_phase_id', v_task.event_phase_id,
    'start_date', v_task.start_date,
    'start_time', v_task.start_time,
    'due_date', v_task.due_date,
    'due_time', v_task.due_time,
    'updated_at', v_task.updated_at
  );
end;
$$;

create or replace function public.get_project_timeline(
  p_workspace_id uuid,
  p_event_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.workspace_role;
begin
  v_role := private.current_workspace_role(p_workspace_id);
  if auth.uid() is null or v_role is null then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.events event
    where event.workspace_id = p_workspace_id
      and event.id = p_event_id
      and event.archived_at is null
  ) then
    raise exception using errcode = 'P0002', message = 'PTA_EVENT_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'phases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', phase.id,
        'name', phase.name,
        'color', phase.color,
        'position', phase.position,
        'start_date', phase.start_date,
        'end_date', phase.end_date,
        'version', phase.version
      ) order by phase.position, phase.id)
      from public.event_phases phase
      where phase.workspace_id = p_workspace_id
        and phase.event_id = p_event_id
        and phase.archived_at is null
    ), '[]'::jsonb),
    'statuses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', status.id,
        'name', status.name,
        'category', status.system_category,
        'color', status.color,
        'position', status.position
      ) order by status.position, status.id)
      from public.task_statuses status
      where status.workspace_id = p_workspace_id and status.is_active
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', task.id,
        'task_number', task.task_number,
        'title', task.title,
        'priority', task.priority,
        'status_id', task.status_id,
        'event_phase_id', task.event_phase_id,
        'start_date', task.start_date,
        'start_time', task.start_time,
        'due_date', task.due_date,
        'due_time', task.due_time,
        'version', task.version,
        'can_edit', private.can_edit_task(task.id),
        'assignee_id', assignee.user_id,
        'assignee_name', profile.full_name
      ) order by task.start_date nulls last, task.due_date nulls last, task.board_position, task.id)
      from public.tasks task
      left join public.task_assignees assignee
        on assignee.workspace_id = task.workspace_id
        and assignee.task_id = task.id
        and assignee.is_primary
      left join public.profiles profile on profile.id = assignee.user_id
      where task.workspace_id = p_workspace_id
        and task.event_id = p_event_id
        and task.archived_at is null
    ), '[]'::jsonb),
    'milestones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', milestone.id,
        'title', milestone.title,
        'due_date', milestone.due_date,
        'event_phase_id', milestone.event_phase_id,
        'position', milestone.position,
        'completed_at', milestone.completed_at,
        'version', milestone.version
      ) order by milestone.due_date nulls last, milestone.position, milestone.id)
      from public.event_milestones milestone
      where milestone.workspace_id = p_workspace_id and milestone.event_id = p_event_id
    ), '[]'::jsonb),
    'capabilities', jsonb_build_object(
      'can_edit_tasks', v_role in ('owner', 'admin', 'manager', 'member'),
      'can_manage_structure', v_role in ('owner', 'admin', 'manager')
    )
  );
end;
$$;

alter function private.event_phases_before_write() owner to postgres;
alter function public.create_event_phase(uuid, uuid, text, text, date, date) owner to postgres;
alter function public.update_event_phase(uuid, uuid, integer, jsonb) owner to postgres;
alter function public.archive_event_phase(uuid, uuid, integer) owner to postgres;
alter function public.create_event_milestone_in_phase(uuid, uuid, uuid, text, date) owner to postgres;
alter function public.move_event_milestone_in_timeline(uuid, uuid, integer, uuid, date) owner to postgres;
alter function public.move_task_in_timeline(uuid, uuid, uuid, integer, uuid, uuid, date, time without time zone, date, time without time zone) owner to postgres;
alter function public.get_project_timeline(uuid, uuid) owner to postgres;

revoke all on function private.event_phases_before_write() from public, anon, authenticated;
revoke all on function public.create_event_phase(uuid, uuid, text, text, date, date) from public, anon, authenticated;
revoke all on function public.update_event_phase(uuid, uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.archive_event_phase(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.create_event_milestone_in_phase(uuid, uuid, uuid, text, date) from public, anon, authenticated;
revoke all on function public.move_event_milestone_in_timeline(uuid, uuid, integer, uuid, date) from public, anon, authenticated;
revoke all on function public.move_task_in_timeline(uuid, uuid, uuid, integer, uuid, uuid, date, time without time zone, date, time without time zone) from public, anon, authenticated;
revoke all on function public.get_project_timeline(uuid, uuid) from public, anon, authenticated;

grant execute on function public.create_event_phase(uuid, uuid, text, text, date, date) to authenticated;
grant execute on function public.update_event_phase(uuid, uuid, integer, jsonb) to authenticated;
grant execute on function public.archive_event_phase(uuid, uuid, integer) to authenticated;
grant execute on function public.create_event_milestone_in_phase(uuid, uuid, uuid, text, date) to authenticated;
grant execute on function public.move_event_milestone_in_timeline(uuid, uuid, integer, uuid, date) to authenticated;
grant execute on function public.move_task_in_timeline(uuid, uuid, uuid, integer, uuid, uuid, date, time without time zone, date, time without time zone) to authenticated;
grant execute on function public.get_project_timeline(uuid, uuid) to authenticated;

comment on table public.event_phases is
  'User-defined project phases used to group timeline work and milestones without assuming a fixed workflow.';
comment on function public.move_task_in_timeline(uuid, uuid, uuid, integer, uuid, uuid, date, time without time zone, date, time without time zone) is
  'Moves a project task across status/phase and changes its local date/time interval atomically with optimistic concurrency.';

commit;
