-- Configurable, workspace-scoped task boards.
-- Stable keys keep presentation changes independent from workflow semantics.

begin;

alter table public.task_statuses
  add column if not exists semantic_key text,
  add column if not exists cover_url text check (cover_url is null or (cover_url ~ '^https://[^[:space:]]+$' and char_length(cover_url) <= 2048)),
  add column if not exists icon_key text not null default 'circle',
  add column if not exists version integer not null default 1;

update public.task_statuses status
set semantic_key = case
  when lower(btrim(status.name)) = 'emergência' then 'emergency'
  when lower(btrim(status.name)) = 'a fazer' then 'todo-default'
  when lower(btrim(status.name)) = 'em andamento' then 'in-progress'
  when lower(btrim(status.name)) in ('em revisão', 'alterações') then 'alterations'
  when lower(btrim(status.name)) = 'bloqueada' then 'blocked'
  when lower(btrim(status.name)) = 'concluída' then 'done'
  when lower(btrim(status.name)) = 'cancelada' then 'cancelled'
  else 'status-' || replace(status.id::text, '-', '')
end
where status.semantic_key is null;

update public.task_statuses status
set icon_key = case status.semantic_key
  when 'emergency' then 'zap'
  when 'todo-default' then 'circle'
  when 'in-progress' then 'loader-circle'
  when 'alterations' then 'refresh-cw'
  when 'blocked' then 'shield-alert'
  when 'done' then 'circle-check'
  when 'cancelled' then 'circle-x'
  else status.icon_key
end
where status.icon_key = 'circle';

alter table public.task_statuses
  alter column semantic_key set not null;

alter table public.task_statuses
  drop constraint if exists task_statuses_semantic_key_valid;
alter table public.task_statuses
  add constraint task_statuses_semantic_key_valid check (
    semantic_key ~ '^[a-z][a-z0-9_-]{0,63}$'
  );
alter table public.task_statuses
  drop constraint if exists task_statuses_icon_key_valid;
alter table public.task_statuses
  add constraint task_statuses_icon_key_valid check (
    icon_key ~ '^[a-z][a-z0-9-]{0,63}$'
  );
alter table public.task_statuses
  drop constraint if exists task_statuses_version_positive;
alter table public.task_statuses
  add constraint task_statuses_version_positive check (version > 0);

create unique index if not exists task_statuses_semantic_key_workspace_unique
  on public.task_statuses (workspace_id, semantic_key);

create table public.task_board_settings (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  board_kind text not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  primary key (workspace_id, board_kind),
  constraint task_board_settings_kind_valid check (board_kind in ('status', 'week')),
  constraint task_board_settings_version_positive check (version > 0)
);

create table public.task_week_lanes (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lane_key text not null,
  name text not null,
  color text not null default 'stone',
  cover_url text check (cover_url is null or (cover_url ~ '^https://[^[:space:]]+$' and char_length(cover_url) <= 2048)),
  icon_key text not null default 'circle',
  position integer not null default 0,
  is_active boolean not null default true,
  is_system boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, lane_key),
  constraint task_week_lanes_key_valid check (lane_key ~ '^[a-z][a-z0-9_-]{0,63}$'),
  constraint task_week_lanes_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint task_week_lanes_color_valid check (color ~ '^[a-z][a-z0-9_-]{0,31}$'),
  constraint task_week_lanes_icon_key_valid check (icon_key ~ '^[a-z][a-z0-9-]{0,63}$'),
  constraint task_week_lanes_position_valid check (position >= 0),
  constraint task_week_lanes_version_positive check (version > 0)
);

create unique index task_week_lanes_name_workspace_unique
  on public.task_week_lanes (workspace_id, lower(name));

create table public.task_status_week_lane_links (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status_id uuid not null,
  week_lane_key text not null,
  direction text not null default 'both',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, status_id, week_lane_key),
  foreign key (workspace_id, status_id)
    references public.task_statuses(workspace_id, id) on delete cascade,
  foreign key (workspace_id, week_lane_key)
    references public.task_week_lanes(workspace_id, lane_key) on delete cascade,
  constraint task_status_week_lane_links_direction_valid check (
    direction in ('both', 'status_to_week', 'week_to_status')
  ),
  constraint task_status_week_lane_links_version_positive check (version > 0),
  unique (workspace_id, status_id),
  unique (workspace_id, week_lane_key)
);

create table public.project_board_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint project_board_settings_version_positive check (version > 0)
);

create table public.project_board_columns (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  column_key text not null,
  name text not null,
  color text not null,
  cover_url text check (cover_url is null or (cover_url ~ '^https://[^[:space:]]+$' and char_length(cover_url) <= 2048)),
  icon_key text not null,
  position integer not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, column_key),
  constraint project_board_columns_key_valid check (
    column_key in ('planning', 'active', 'completed', 'cancelled')
  ),
  constraint project_board_columns_name_length check (
    char_length(btrim(name)) between 1 and 80
  ),
  constraint project_board_columns_color_valid check (
    color ~ '^[a-z][a-z0-9_-]{0,31}$'
  ),
  constraint project_board_columns_icon_key_valid check (
    icon_key ~ '^[a-z][a-z0-9-]{0,63}$'
  ),
  constraint project_board_columns_position_valid check (position >= 0),
  constraint project_board_columns_version_positive check (version > 0)
);

create unique index project_board_columns_name_workspace_unique
  on public.project_board_columns (workspace_id, lower(name));

insert into public.task_board_settings (workspace_id, board_kind)
select workspace.id, kind.board_kind
from public.workspaces workspace
cross join (values ('status'), ('week')) as kind(board_kind)
on conflict (workspace_id, board_kind) do nothing;

insert into public.task_week_lanes (
  workspace_id,
  lane_key,
  name,
  color,
  icon_key,
  position,
  is_system
)
select
  workspace.id,
  lane.lane_key,
  lane.name,
  lane.color,
  lane.icon_key,
  lane.position,
  lane.is_system
from public.workspaces workspace
cross join (
  values
    ('emergency', 'Emergência', 'red', 'zap', 0, true),
    ('important', 'Links importantes', 'blue', 'link', 1000, false),
    ('backlog', 'Para planejar', 'stone', 'inbox', 2000, true),
    ('scheduled', 'Agenda', 'blue', 'calendar-days', 3000, true),
    ('delivered', 'Entregues', 'green', 'package-check', 4000, false),
    ('revision', 'Alterações', 'violet', 'refresh-cw', 5000, true),
    ('ideas', 'Ideias', 'amber', 'lightbulb', 6000, false),
    ('discarded', 'Descartadas', 'stone', 'archive-x', 7000, false)
) as lane(lane_key, name, color, icon_key, position, is_system)
on conflict (workspace_id, lane_key) do nothing;

insert into public.task_status_week_lane_links (
  workspace_id,
  status_id,
  week_lane_key,
  direction
)
select status.workspace_id, status.id, 'emergency', 'both'
from public.task_statuses status
where status.semantic_key = 'emergency'
on conflict (workspace_id, status_id, week_lane_key) do nothing;

insert into public.task_status_week_lane_links (
  workspace_id,
  status_id,
  week_lane_key,
  direction
)
select status.workspace_id, status.id, 'revision', 'both'
from public.task_statuses status
where status.semantic_key = 'alterations'
on conflict (workspace_id, status_id, week_lane_key) do nothing;

insert into public.project_board_settings (workspace_id)
select workspace.id
from public.workspaces workspace
on conflict (workspace_id) do nothing;

insert into public.project_board_columns (
  workspace_id,
  column_key,
  name,
  color,
  icon_key,
  position
)
select
  workspace.id,
  column_definition.column_key,
  column_definition.name,
  column_definition.color,
  column_definition.icon_key,
  column_definition.position
from public.workspaces workspace
cross join (
  values
    ('planning', 'Planejamento', 'stone', 'clipboard-list', 1000),
    ('active', 'Em andamento', 'blue', 'circle-play', 2000),
    ('completed', 'Concluídos', 'green', 'circle-check', 3000),
    ('cancelled', 'Cancelados', 'stone', 'circle-x', 4000)
) as column_definition(column_key, name, color, icon_key, position)
on conflict (workspace_id, column_key) do nothing;

alter table public.events
  drop constraint if exists events_workspace_project_board_column_fkey;
alter table public.events
  add constraint events_workspace_project_board_column_fkey
  foreign key (workspace_id, status)
  references public.project_board_columns(workspace_id, column_key)
  on update restrict on delete restrict
  not valid;
alter table public.events
  validate constraint events_workspace_project_board_column_fkey;

alter table public.tasks
  drop constraint if exists tasks_workspace_week_lane_fkey;
alter table public.tasks
  add constraint tasks_workspace_week_lane_fkey
  foreign key (workspace_id, week_lane)
  references public.task_week_lanes(workspace_id, lane_key)
  on update restrict on delete restrict
  not valid;
alter table public.tasks validate constraint tasks_workspace_week_lane_fkey;

create or replace function private.task_status_configuration_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.semantic_key := coalesce(
      nullif(btrim(new.semantic_key), ''),
      case
        when lower(btrim(new.name)) = 'emergência' then 'emergency'
        when lower(btrim(new.name)) = 'a fazer' then 'todo-default'
        when lower(btrim(new.name)) = 'em andamento' then 'in-progress'
        when lower(btrim(new.name)) in ('em revisão', 'alterações') then 'alterations'
        when lower(btrim(new.name)) = 'bloqueada' then 'blocked'
        when lower(btrim(new.name)) = 'concluída' then 'done'
        when lower(btrim(new.name)) = 'cancelada' then 'cancelled'
        else 'status-' || replace(new.id::text, '-', '')
      end
    );
    if new.icon_key is null or btrim(new.icon_key) in ('', 'circle') then
      new.icon_key := case new.semantic_key
        when 'emergency' then 'zap'
        when 'in-progress' then 'loader-circle'
        when 'alterations' then 'refresh-cw'
        when 'blocked' then 'shield-alert'
        when 'done' then 'circle-check'
        when 'cancelled' then 'circle-x'
        else 'circle'
      end;
    end if;
    new.version := 1;
  else
    new.semantic_key := old.semantic_key;
  end if;

  if tg_op = 'UPDATE' and (
       new.name is distinct from old.name
     or new.color is distinct from old.color
     or new.cover_url is distinct from old.cover_url
     or new.icon_key is distinct from old.icon_key
     or new.position is distinct from old.position
     or new.is_active is distinct from old.is_active
     or new.is_default is distinct from old.is_default
  ) then
    new.version := old.version + 1;
  elsif tg_op = 'UPDATE' then
    new.version := old.version;
  end if;
  return new;
end;
$$;

drop trigger if exists task_statuses_board_metadata on public.task_statuses;
create trigger task_statuses_board_metadata
before insert or update on public.task_statuses
for each row execute function private.task_status_configuration_defaults();

create or replace function private.task_week_lane_configuration_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.lane_key := old.lane_key;
  new.workspace_id := old.workspace_id;
  new.version := old.version + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger task_week_lanes_version
before update on public.task_week_lanes
for each row execute function private.task_week_lane_configuration_version();

create or replace function private.project_board_column_configuration_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.workspace_id := old.workspace_id;
  new.column_key := old.column_key;
  new.version := old.version + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger project_board_columns_version
before update on public.project_board_columns
for each row execute function private.project_board_column_configuration_version();

create or replace function private.seed_task_board_configuration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_board_settings (workspace_id, board_kind)
  values (new.id, 'status'), (new.id, 'week');

  insert into public.task_week_lanes (
    workspace_id, lane_key, name, color, icon_key, position, is_system
  ) values
    (new.id, 'emergency', 'Emergência', 'red', 'zap', 0, true),
    (new.id, 'important', 'Links importantes', 'blue', 'link', 1000, false),
    (new.id, 'backlog', 'Para planejar', 'stone', 'inbox', 2000, true),
    (new.id, 'scheduled', 'Agenda', 'blue', 'calendar-days', 3000, true),
    (new.id, 'delivered', 'Entregues', 'green', 'package-check', 4000, false),
    (new.id, 'revision', 'Alterações', 'violet', 'refresh-cw', 5000, true),
    (new.id, 'ideas', 'Ideias', 'amber', 'lightbulb', 6000, false),
    (new.id, 'discarded', 'Descartadas', 'stone', 'archive-x', 7000, false);

  insert into public.project_board_settings (workspace_id) values (new.id);
  insert into public.project_board_columns (
    workspace_id, column_key, name, color, icon_key, position
  ) values
    (new.id, 'planning', 'Planejamento', 'stone', 'clipboard-list', 1000),
    (new.id, 'active', 'Em andamento', 'blue', 'circle-play', 2000),
    (new.id, 'completed', 'Concluídos', 'green', 'circle-check', 3000),
    (new.id, 'cancelled', 'Cancelados', 'stone', 'circle-x', 4000);
  return new;
end;
$$;

drop trigger if exists workspaces_seed_task_board_configuration on public.workspaces;
create trigger workspaces_seed_task_board_configuration
after insert on public.workspaces
for each row execute function private.seed_task_board_configuration();

create or replace function private.seed_task_status_week_lane_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week_lane_key text;
begin
  v_week_lane_key := case new.semantic_key
    when 'emergency' then 'emergency'
    when 'alterations' then 'revision'
    else null
  end;
  if v_week_lane_key is not null then
    insert into public.task_status_week_lane_links (
      workspace_id, status_id, week_lane_key, direction
    ) values (
      new.workspace_id, new.id, v_week_lane_key, 'both'
    ) on conflict (workspace_id, status_id, week_lane_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists task_statuses_seed_week_lane_link on public.task_statuses;
create trigger task_statuses_seed_week_lane_link
after insert on public.task_statuses
for each row execute function private.seed_task_status_week_lane_link();

create or replace function private.sync_task_special_lanes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_lane text;
  v_target_status uuid;
  v_old_lane text;
  v_old_status uuid;
begin
  if tg_op = 'INSERT' then
    select link.week_lane_key
    into v_target_lane
    from public.task_status_week_lane_links link
    where link.workspace_id = new.workspace_id
      and link.status_id = new.status_id
      and link.direction in ('both', 'status_to_week')
    limit 1;
    new.week_lane := coalesce(v_target_lane, new.week_lane);
    return new;
  end if;

  if new.status_id is distinct from old.status_id then
    select link.week_lane_key
    into v_target_lane
    from public.task_status_week_lane_links link
    where link.workspace_id = new.workspace_id
      and link.status_id = new.status_id
      and link.direction in ('both', 'status_to_week')
    limit 1;

    if v_target_lane is not null then
      new.week_lane := v_target_lane;
    else
      select link.week_lane_key
      into v_old_lane
      from public.task_status_week_lane_links link
      where link.workspace_id = old.workspace_id
        and link.status_id = old.status_id
        and link.direction in ('both', 'status_to_week')
      limit 1;
      if v_old_lane = old.week_lane then
        new.week_lane := case
          when new.due_date is null then 'backlog'
          else 'scheduled'
        end;
      end if;
    end if;
  elsif new.week_lane is distinct from old.week_lane then
    select link.status_id
    into v_target_status
    from public.task_status_week_lane_links link
    where link.workspace_id = new.workspace_id
      and link.week_lane_key = new.week_lane
      and link.direction in ('both', 'week_to_status')
    limit 1;

    if v_target_status is not null then
      new.status_id := v_target_status;
    else
      select link.status_id
      into v_old_status
      from public.task_status_week_lane_links link
      where link.workspace_id = old.workspace_id
        and link.week_lane_key = old.week_lane
        and link.direction in ('both', 'week_to_status')
      limit 1;
      if v_old_status = old.status_id then
        select status.id
        into v_target_status
        from public.task_statuses status
        where status.workspace_id = new.workspace_id
          and status.is_active
          and status.is_default
        order by status.position, status.id
        limit 1;
        new.status_id := coalesce(v_target_status, new.status_id);
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_00_sync_special_lanes on public.tasks;
create trigger tasks_00_sync_special_lanes
before insert or update of status_id, week_lane on public.tasks
for each row execute function private.sync_task_special_lanes();

create or replace function public.get_task_board_configuration(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.workspace_role;
  v_status_version integer;
  v_week_version integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;
  v_role := private.current_workspace_role(p_workspace_id);
  if v_role is null then
    raise exception using errcode = '42501', message = 'PTA_WORKSPACE_FORBIDDEN';
  end if;

  select setting.version into v_status_version
  from public.task_board_settings setting
  where setting.workspace_id = p_workspace_id and setting.board_kind = 'status';
  select setting.version into v_week_version
  from public.task_board_settings setting
  where setting.workspace_id = p_workspace_id and setting.board_kind = 'week';

  return jsonb_build_object(
    'schema_version', 1,
    'workspace_id', p_workspace_id,
    'permissions', jsonb_build_object(
      'can_manage_columns', v_role in (
        'owner'::public.workspace_role,
        'admin'::public.workspace_role,
        'manager'::public.workspace_role
      )
    ),
    'status_board', jsonb_build_object(
      'version', v_status_version,
      'columns', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', status.id,
          'key', status.semantic_key,
          'name', status.name,
          'category', status.system_category,
          'color', status.color,
          'icon_key', status.icon_key,
          'cover_url', status.cover_url,
          'position', status.position,
          'is_active', status.is_active,
          'version', status.version
        ) order by status.position, status.id)
        from public.task_statuses status
        where status.workspace_id = p_workspace_id
      ), '[]'::jsonb)
    ),
    'week_board', jsonb_build_object(
      'version', v_week_version,
      'columns', coalesce((
        select jsonb_agg(jsonb_build_object(
          'key', lane.lane_key,
          'name', lane.name,
          'color', lane.color,
          'icon_key', lane.icon_key,
          'cover_url', lane.cover_url,
          'position', lane.position,
          'is_active', lane.is_active,
          'is_system', lane.is_system,
          'version', lane.version
        ) order by lane.position, lane.lane_key)
        from public.task_week_lanes lane
        where lane.workspace_id = p_workspace_id
      ), '[]'::jsonb)
    ),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status_id', link.status_id,
        'week_lane_key', link.week_lane_key,
        'direction', link.direction,
        'version', link.version
      ) order by link.week_lane_key, link.status_id)
      from public.task_status_week_lane_links link
      where link.workspace_id = p_workspace_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.update_task_board_column(
  p_workspace_id uuid,
  p_board_kind text,
  p_column_key text,
  p_name text,
  p_color text,
  p_icon_key text,
  p_expected_board_version integer,
  p_expected_column_version integer,
  p_cover_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_board_version integer;
  v_column_version integer;
begin
  v_role := private.current_workspace_role(p_workspace_id);
  if v_actor is null or v_role is null or v_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role
  ) then
    raise exception using errcode = '42501', message = 'PTA_BOARD_CONFIGURATION_FORBIDDEN';
  end if;
  if p_board_kind not in ('status', 'week') then
    raise exception using errcode = '22023', message = 'PTA_BOARD_KIND_INVALID';
  end if;
  if p_cover_url is not null and (p_cover_url !~ '^https://[^[:space:]]+$' or char_length(p_cover_url) > 2048) then
    raise exception using errcode = '22023', message = 'PTA_BOARD_COVER_INVALID';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'PTA_BOARD_COLUMN_NAME_INVALID';
  end if;
  if coalesce(p_color, '') !~ '^[a-z][a-z0-9_-]{0,31}$'
     or coalesce(p_icon_key, '') !~ '^[a-z][a-z0-9-]{0,63}$' then
    raise exception using errcode = '22023', message = 'PTA_BOARD_COLUMN_STYLE_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'pta:task-board:' || p_workspace_id::text || ':' || p_board_kind,
      0
    )
  );
  select setting.version into v_board_version
  from public.task_board_settings setting
  where setting.workspace_id = p_workspace_id
    and setting.board_kind = p_board_kind
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_BOARD_NOT_FOUND';
  end if;
  if v_board_version is distinct from p_expected_board_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  if p_board_kind = 'status' then
    select status.version into v_column_version
    from public.task_statuses status
    where status.workspace_id = p_workspace_id
      and status.semantic_key = p_column_key
    for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'PTA_BOARD_COLUMN_NOT_FOUND';
    end if;
    if v_column_version is distinct from p_expected_column_version then
      raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
    end if;
    update public.task_statuses status
    set name = btrim(p_name), color = p_color, icon_key = p_icon_key, cover_url = p_cover_url
    where status.workspace_id = p_workspace_id
      and status.semantic_key = p_column_key;
  else
    select lane.version into v_column_version
    from public.task_week_lanes lane
    where lane.workspace_id = p_workspace_id
      and lane.lane_key = p_column_key
    for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'PTA_BOARD_COLUMN_NOT_FOUND';
    end if;
    if v_column_version is distinct from p_expected_column_version then
      raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
    end if;
    update public.task_week_lanes lane
    set name = btrim(p_name), color = p_color, icon_key = p_icon_key, cover_url = p_cover_url
    where lane.workspace_id = p_workspace_id
      and lane.lane_key = p_column_key;
  end if;

  update public.task_board_settings setting
  set version = setting.version + 1,
      updated_at = clock_timestamp(),
      updated_by = v_actor
  where setting.workspace_id = p_workspace_id
    and setting.board_kind = p_board_kind;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, changes_json
  ) values (
    p_workspace_id, v_actor, 'task_board', p_workspace_id,
    'task_board.column_updated',
    jsonb_build_object('board_kind', p_board_kind, 'column_key', p_column_key)
  );
  return public.get_task_board_configuration(p_workspace_id);
end;
$$;

create or replace function public.reorder_task_board_columns(
  p_workspace_id uuid,
  p_board_kind text,
  p_ordered_keys text[],
  p_expected_board_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_board_version integer;
  v_active_count integer;
  v_distinct_count integer;
  v_matched_count integer;
begin
  v_role := private.current_workspace_role(p_workspace_id);
  if v_actor is null or v_role is null or v_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role
  ) then
    raise exception using errcode = '42501', message = 'PTA_BOARD_CONFIGURATION_FORBIDDEN';
  end if;
  if p_board_kind not in ('status', 'week') then
    raise exception using errcode = '22023', message = 'PTA_BOARD_KIND_INVALID';
  end if;
  select count(distinct ordered_key.key)::integer into v_distinct_count
  from unnest(coalesce(p_ordered_keys, array[]::text[])) as ordered_key(key);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'pta:task-board:' || p_workspace_id::text || ':' || p_board_kind,
      0
    )
  );
  select setting.version into v_board_version
  from public.task_board_settings setting
  where setting.workspace_id = p_workspace_id
    and setting.board_kind = p_board_kind
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_BOARD_NOT_FOUND';
  end if;
  if v_board_version is distinct from p_expected_board_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  if p_board_kind = 'status' then
    select count(*)::integer into v_active_count
    from public.task_statuses status
    where status.workspace_id = p_workspace_id and status.is_active;
    select count(*)::integer into v_matched_count
    from public.task_statuses status
    where status.workspace_id = p_workspace_id
      and status.is_active
      and status.semantic_key = any(coalesce(p_ordered_keys, array[]::text[]));
  else
    select count(*)::integer into v_active_count
    from public.task_week_lanes lane
    where lane.workspace_id = p_workspace_id and lane.is_active;
    select count(*)::integer into v_matched_count
    from public.task_week_lanes lane
    where lane.workspace_id = p_workspace_id
      and lane.is_active
      and lane.lane_key = any(coalesce(p_ordered_keys, array[]::text[]));
  end if;

  if cardinality(coalesce(p_ordered_keys, array[]::text[])) <> v_active_count
     or v_distinct_count <> v_active_count
     or v_matched_count <> v_active_count then
    raise exception using errcode = '22023', message = 'PTA_BOARD_COLUMN_ORDER_INVALID';
  end if;

  if p_board_kind = 'status' then
    update public.task_statuses status
    set position = ordered.ordinality::integer * 1000
    from unnest(p_ordered_keys) with ordinality ordered(key, ordinality)
    where status.workspace_id = p_workspace_id
      and status.semantic_key = ordered.key
      and status.is_active;
  else
    update public.task_week_lanes lane
    set position = ordered.ordinality::integer * 1000
    from unnest(p_ordered_keys) with ordinality ordered(key, ordinality)
    where lane.workspace_id = p_workspace_id
      and lane.lane_key = ordered.key
      and lane.is_active;
  end if;

  update public.task_board_settings setting
  set version = setting.version + 1,
      updated_at = clock_timestamp(),
      updated_by = v_actor
  where setting.workspace_id = p_workspace_id
    and setting.board_kind = p_board_kind;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, changes_json
  ) values (
    p_workspace_id, v_actor, 'task_board', p_workspace_id,
    'task_board.columns_reordered',
    jsonb_build_object('board_kind', p_board_kind, 'ordered_keys', p_ordered_keys)
  );
  return public.get_task_board_configuration(p_workspace_id);
end;
$$;

create or replace function public.set_task_board_lane_link(
  p_workspace_id uuid,
  p_status_id uuid,
  p_week_lane_key text,
  p_direction text,
  p_enabled boolean,
  p_expected_board_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_board_version integer;
begin
  v_role := private.current_workspace_role(p_workspace_id);
  if v_actor is null or v_role is null or v_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role
  ) then
    raise exception using errcode = '42501', message = 'PTA_BOARD_CONFIGURATION_FORBIDDEN';
  end if;
  if p_direction not in ('both', 'status_to_week', 'week_to_status')
     or p_enabled is null then
    raise exception using errcode = '22023', message = 'PTA_BOARD_LINK_DIRECTION_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pta:task-board:' || p_workspace_id::text, 0)
  );
  select setting.version into v_board_version
  from public.task_board_settings setting
  where setting.workspace_id = p_workspace_id
    and setting.board_kind = 'status'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_BOARD_NOT_FOUND';
  end if;
  if v_board_version is distinct from p_expected_board_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;
  if not exists (
    select 1 from public.task_statuses status
    where status.workspace_id = p_workspace_id
      and status.id = p_status_id
      and status.is_active
  ) or not exists (
    select 1 from public.task_week_lanes lane
    where lane.workspace_id = p_workspace_id
      and lane.lane_key = p_week_lane_key
      and lane.is_active
  ) then
    raise exception using errcode = '23503', message = 'PTA_BOARD_LINK_TARGET_INVALID';
  end if;

  if p_enabled then
    delete from public.task_status_week_lane_links link
    where link.workspace_id = p_workspace_id
      and (link.status_id = p_status_id or link.week_lane_key = p_week_lane_key)
      and not (
        link.status_id = p_status_id and link.week_lane_key = p_week_lane_key
      );
    insert into public.task_status_week_lane_links (
      workspace_id, status_id, week_lane_key, direction
    ) values (
      p_workspace_id, p_status_id, p_week_lane_key, p_direction
    )
    on conflict (workspace_id, status_id, week_lane_key) do update
      set direction = excluded.direction,
          version = task_status_week_lane_links.version + 1,
          updated_at = clock_timestamp();
  else
    delete from public.task_status_week_lane_links link
    where link.workspace_id = p_workspace_id
      and link.status_id = p_status_id
      and link.week_lane_key = p_week_lane_key;
  end if;

  update public.task_board_settings setting
  set version = setting.version + 1,
      updated_at = clock_timestamp(),
      updated_by = v_actor
  where setting.workspace_id = p_workspace_id
    and setting.board_kind in ('status', 'week');

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, changes_json
  ) values (
    p_workspace_id, v_actor, 'task_board', p_workspace_id,
    'task_board.lane_link_updated',
    jsonb_build_object(
      'status_id', p_status_id,
      'week_lane_key', p_week_lane_key,
      'direction', p_direction,
      'enabled', p_enabled
    )
  );
  return public.get_task_board_configuration(p_workspace_id);
end;
$$;

create or replace function public.get_project_board_configuration(
  p_workspace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.workspace_role;
  v_board_version integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;
  v_role := private.current_workspace_role(p_workspace_id);
  if v_role is null then
    raise exception using errcode = '42501', message = 'PTA_WORKSPACE_FORBIDDEN';
  end if;

  select setting.version
  into v_board_version
  from public.project_board_settings setting
  where setting.workspace_id = p_workspace_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_PROJECT_BOARD_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'schema_version', 1,
    'workspace_id', p_workspace_id,
    'version', v_board_version,
    'can_manage_columns', v_role in (
      'owner'::public.workspace_role,
      'admin'::public.workspace_role,
      'manager'::public.workspace_role
    ),
    'columns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', board_column.column_key,
        'name', board_column.name,
        'color', board_column.color,
        'icon_key', board_column.icon_key,
          'cover_url', board_column.cover_url,
        'position', board_column.position,
        'version', board_column.version
      ) order by board_column.position, board_column.column_key)
      from public.project_board_columns board_column
      where board_column.workspace_id = p_workspace_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.update_project_board_column(
  p_workspace_id uuid,
  p_column_key text,
  p_name text,
  p_color text,
  p_icon_key text,
  p_expected_board_version integer,
  p_expected_column_version integer,
  p_cover_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_board_version integer;
  v_column_version integer;
begin
  v_role := private.current_workspace_role(p_workspace_id);
  if v_actor is null or v_role is null or v_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role
  ) then
    raise exception using errcode = '42501', message = 'PTA_PROJECT_BOARD_CONFIGURATION_FORBIDDEN';
  end if;
  if p_cover_url is not null and (p_cover_url !~ '^https://[^[:space:]]+$' or char_length(p_cover_url) > 2048) then
    raise exception using errcode = '22023', message = 'PTA_BOARD_COVER_INVALID';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'PTA_PROJECT_BOARD_COLUMN_NAME_INVALID';
  end if;
  if coalesce(p_color, '') !~ '^[a-z][a-z0-9_-]{0,31}$'
     or coalesce(p_icon_key, '') !~ '^[a-z][a-z0-9-]{0,63}$' then
    raise exception using errcode = '22023', message = 'PTA_PROJECT_BOARD_COLUMN_STYLE_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pta:project-board:' || p_workspace_id::text, 0)
  );
  select setting.version
  into v_board_version
  from public.project_board_settings setting
  where setting.workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_PROJECT_BOARD_NOT_FOUND';
  end if;
  if v_board_version is distinct from p_expected_board_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  select board_column.version
  into v_column_version
  from public.project_board_columns board_column
  where board_column.workspace_id = p_workspace_id
    and board_column.column_key = p_column_key
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_PROJECT_BOARD_COLUMN_NOT_FOUND';
  end if;
  if v_column_version is distinct from p_expected_column_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  update public.project_board_columns board_column
  set name = btrim(p_name),
      color = p_color,
      icon_key = p_icon_key,
      cover_url = p_cover_url
  where board_column.workspace_id = p_workspace_id
    and board_column.column_key = p_column_key;
  update public.project_board_settings setting
  set version = setting.version + 1,
      updated_at = clock_timestamp(),
      updated_by = v_actor
  where setting.workspace_id = p_workspace_id;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, changes_json
  ) values (
    p_workspace_id, v_actor, 'project_board', p_workspace_id,
    'project_board.column_updated',
    jsonb_build_object('column_key', p_column_key)
  );
  return public.get_project_board_configuration(p_workspace_id);
end;
$$;

create or replace function public.reorder_project_board_columns(
  p_workspace_id uuid,
  p_ordered_keys text[],
  p_expected_board_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_board_version integer;
  v_column_count integer;
  v_distinct_count integer;
  v_matched_count integer;
begin
  v_role := private.current_workspace_role(p_workspace_id);
  if v_actor is null or v_role is null or v_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role
  ) then
    raise exception using errcode = '42501', message = 'PTA_PROJECT_BOARD_CONFIGURATION_FORBIDDEN';
  end if;
  select count(distinct ordered_key.key)::integer
  into v_distinct_count
  from unnest(coalesce(p_ordered_keys, array[]::text[])) as ordered_key(key);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pta:project-board:' || p_workspace_id::text, 0)
  );
  select setting.version
  into v_board_version
  from public.project_board_settings setting
  where setting.workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_PROJECT_BOARD_NOT_FOUND';
  end if;
  if v_board_version is distinct from p_expected_board_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  select count(*)::integer
  into v_column_count
  from public.project_board_columns board_column
  where board_column.workspace_id = p_workspace_id;
  select count(*)::integer
  into v_matched_count
  from public.project_board_columns board_column
  where board_column.workspace_id = p_workspace_id
    and board_column.column_key = any(
      coalesce(p_ordered_keys, array[]::text[])
    );
  if cardinality(coalesce(p_ordered_keys, array[]::text[])) <> v_column_count
     or v_distinct_count <> v_column_count
     or v_matched_count <> v_column_count then
    raise exception using errcode = '22023', message = 'PTA_PROJECT_BOARD_COLUMN_ORDER_INVALID';
  end if;

  update public.project_board_columns board_column
  set position = ordered.ordinality::integer * 1000
  from unnest(p_ordered_keys) with ordinality ordered(key, ordinality)
  where board_column.workspace_id = p_workspace_id
    and board_column.column_key = ordered.key;
  update public.project_board_settings setting
  set version = setting.version + 1,
      updated_at = clock_timestamp(),
      updated_by = v_actor
  where setting.workspace_id = p_workspace_id;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, changes_json
  ) values (
    p_workspace_id, v_actor, 'project_board', p_workspace_id,
    'project_board.columns_reordered',
    jsonb_build_object('ordered_keys', p_ordered_keys)
  );
  return public.get_project_board_configuration(p_workspace_id);
end;
$$;

alter table public.task_board_settings enable row level security;
alter table public.task_board_settings force row level security;
alter table public.task_week_lanes enable row level security;
alter table public.task_week_lanes force row level security;
alter table public.task_status_week_lane_links enable row level security;
alter table public.task_status_week_lane_links force row level security;
alter table public.project_board_settings enable row level security;
alter table public.project_board_settings force row level security;
alter table public.project_board_columns enable row level security;
alter table public.project_board_columns force row level security;

create policy task_board_settings_select_member
on public.task_board_settings for select to authenticated
using (private.is_active_workspace_member(workspace_id));
create policy task_week_lanes_select_member
on public.task_week_lanes for select to authenticated
using (private.is_active_workspace_member(workspace_id));
create policy task_status_week_lane_links_select_member
on public.task_status_week_lane_links for select to authenticated
using (private.is_active_workspace_member(workspace_id));
create policy project_board_settings_select_member
on public.project_board_settings for select to authenticated
using (private.is_active_workspace_member(workspace_id));
create policy project_board_columns_select_member
on public.project_board_columns for select to authenticated
using (private.is_active_workspace_member(workspace_id));

revoke all on public.task_board_settings from public, anon, authenticated;
revoke all on public.task_week_lanes from public, anon, authenticated;
revoke all on public.task_status_week_lane_links from public, anon, authenticated;
revoke all on public.project_board_settings from public, anon, authenticated;
revoke all on public.project_board_columns from public, anon, authenticated;
grant select on public.task_board_settings to authenticated;
grant select on public.task_week_lanes to authenticated;
grant select on public.task_status_week_lane_links to authenticated;
grant select on public.project_board_settings to authenticated;
grant select on public.project_board_columns to authenticated;

do $$
declare
  v_all_tables boolean;
  v_table text;
begin
  select publication.puballtables
  into v_all_tables
  from pg_catalog.pg_publication publication
  where publication.pubname = 'supabase_realtime';

  if found and not v_all_tables then
    foreach v_table in array array[
      'task_statuses',
      'task_board_settings',
      'task_week_lanes',
      'task_status_week_lane_links',
      'project_board_settings',
      'project_board_columns'
    ] loop
      if not exists (
        select 1
        from pg_catalog.pg_publication_tables publication_table
        where publication_table.pubname = 'supabase_realtime'
          and publication_table.schemaname = 'public'
          and publication_table.tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;

alter function public.get_task_board_configuration(uuid) owner to postgres;
alter function public.update_task_board_column(
  uuid, text, text, text, text, text, integer, integer, text
) owner to postgres;
alter function public.reorder_task_board_columns(uuid, text, text[], integer)
  owner to postgres;
alter function public.set_task_board_lane_link(
  uuid, uuid, text, text, boolean, integer
) owner to postgres;
alter function public.get_project_board_configuration(uuid) owner to postgres;
alter function public.update_project_board_column(
  uuid, text, text, text, text, integer, integer, text
) owner to postgres;
alter function public.reorder_project_board_columns(uuid, text[], integer)
  owner to postgres;

revoke all on function public.get_task_board_configuration(uuid)
  from public, anon, authenticated;
revoke all on function public.update_task_board_column(
  uuid, text, text, text, text, text, integer, integer, text
) from public, anon, authenticated;
revoke all on function public.reorder_task_board_columns(uuid, text, text[], integer)
  from public, anon, authenticated;
revoke all on function public.set_task_board_lane_link(
  uuid, uuid, text, text, boolean, integer
) from public, anon, authenticated;
revoke all on function public.get_project_board_configuration(uuid)
  from public, anon, authenticated;
revoke all on function public.update_project_board_column(
  uuid, text, text, text, text, integer, integer, text
) from public, anon, authenticated;
revoke all on function public.reorder_project_board_columns(uuid, text[], integer)
  from public, anon, authenticated;

grant execute on function public.get_task_board_configuration(uuid)
  to authenticated;
grant execute on function public.update_task_board_column(
  uuid, text, text, text, text, text, integer, integer, text
) to authenticated;
grant execute on function public.reorder_task_board_columns(uuid, text, text[], integer)
  to authenticated;
grant execute on function public.set_task_board_lane_link(
  uuid, uuid, text, text, boolean, integer
) to authenticated;
grant execute on function public.get_project_board_configuration(uuid)
  to authenticated;
grant execute on function public.update_project_board_column(
  uuid, text, text, text, text, integer, integer, text
) to authenticated;
grant execute on function public.reorder_project_board_columns(uuid, text[], integer)
  to authenticated;

revoke all on function private.task_status_configuration_defaults()
  from public, anon, authenticated;
revoke all on function private.task_week_lane_configuration_version()
  from public, anon, authenticated;
revoke all on function private.project_board_column_configuration_version()
  from public, anon, authenticated;
revoke all on function private.seed_task_board_configuration()
  from public, anon, authenticated;
revoke all on function private.seed_task_status_week_lane_link()
  from public, anon, authenticated;
revoke all on function private.sync_task_special_lanes()
  from public, anon, authenticated;

comment on table public.task_board_settings is
  'Optimistic concurrency boundary for shared task board configuration.';
comment on table public.task_week_lanes is
  'Workspace-owned presentation catalog for stable weekly lane keys.';
comment on table public.task_status_week_lane_links is
  'Typed automations linking one task status and one weekly lane without mutable-name coupling.';
comment on table public.project_board_settings is
  'Optimistic concurrency boundary for the shared project portfolio board.';
comment on table public.project_board_columns is
  'Workspace-owned presentation catalog for the four stable project states.';
comment on function public.get_task_board_configuration(uuid) is
  'Returns the workspace-scoped board catalogs, links, versions, and management capability.';
comment on function public.get_project_board_configuration(uuid) is
  'Returns the workspace-scoped project board columns, version, and management capability.';

commit;
