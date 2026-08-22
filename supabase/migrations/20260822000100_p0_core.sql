-- PTA OS P0 core schema. Applied before the local-only seed.
begin;

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant usage on schema public to authenticated;

create table private.runtime_flags (
  key text primary key,
  enabled boolean not null default false
);
insert into private.runtime_flags (key, enabled) values ('allow_self_bootstrap', false);

create type public.workspace_role as enum ('owner', 'admin', 'manager', 'member', 'viewer');
create type public.membership_status as enum ('active', 'suspended');
create type public.task_status_category as enum (
  'backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'
);
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  initials text,
  avatar_path text,
  locale text not null default 'pt-BR',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_name_length check (char_length(btrim(full_name)) between 2 and 120),
  constraint profiles_email_length check (char_length(email) between 3 and 320)
);

create unique index profiles_email_lower_unique on public.profiles (lower(email));

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  task_prefix text not null default 'PTA',
  timezone text not null default 'America/Sao_Paulo',
  locale text not null default 'pt-BR',
  accent_color text not null default '#C7ED22',
  week_starts_on smallint not null default 1,
  working_days smallint[] not null default array[1, 2, 3, 4, 5]::smallint[],
  default_due_time time without time zone not null default '18:00',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint workspaces_name_length check (char_length(btrim(name)) between 2 and 120),
  constraint workspaces_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint workspaces_task_prefix_format check (task_prefix ~ '^[A-Z0-9]{2,8}$'),
  constraint workspaces_week_start_valid check (week_starts_on between 0 and 6),
  constraint workspaces_working_days_valid check (
    cardinality(working_days) > 0
    and working_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  ),
  constraint workspaces_accent_color_format check (accent_color ~ '^#[0-9A-Fa-f]{6}$')
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role public.workspace_role not null,
  status public.membership_status not null default 'active',
  weekly_capacity_minutes integer,
  joined_at timestamptz not null default now(),
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  constraint workspace_members_capacity_valid check (
    weekly_capacity_minutes is null or weekly_capacity_minutes > 0
  ),
  constraint workspace_members_suspension_consistent check (
    (status = 'active' and suspended_at is null)
    or (status = 'suspended' and suspended_at is not null)
  )
);

create unique index workspace_members_one_active_owner
  on public.workspace_members (workspace_id)
  where role = 'owner'::public.workspace_role
    and status = 'active'::public.membership_status;
create index workspace_members_user_active on public.workspace_members (user_id, workspace_id)
  where status = 'active';

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'member',
  token_hash text not null unique,
  invited_by uuid not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, invited_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint invitations_not_owner check (role <> 'owner'),
  constraint invitations_email_length check (char_length(email) between 3 and 320)
);

create unique index invitations_open_email on public.workspace_invitations (workspace_id, lower(email))
  where accepted_at is null;

create table public.workspace_preferences (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  credentials_enabled boolean not null default false,
  notification_digest boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.task_statuses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  system_category public.task_status_category not null,
  color text not null default 'stone',
  position integer not null default 0,
  is_default boolean not null default false,
  is_active boolean not null default true,
  is_closed boolean generated always as (
    system_category in ('done'::public.task_status_category, 'cancelled'::public.task_status_category)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  constraint task_statuses_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint task_statuses_position_valid check (position >= 0)
);

create unique index task_statuses_name_workspace_unique on public.task_statuses (workspace_id, lower(name));
create unique index task_statuses_one_default on public.task_statuses (workspace_id)
  where is_default and is_active;

create table public.task_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  icon text,
  color text not null default 'stone',
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  constraint task_types_name_length check (char_length(btrim(name)) between 1 and 80)
);

create unique index task_types_name_workspace_unique on public.task_types (workspace_id, lower(name));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  description_json jsonb not null default '{}'::jsonb,
  owner_id uuid,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (workspace_id, id),
  unique (workspace_id, slug),
  foreign key (workspace_id, owner_id)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint products_name_length check (char_length(btrim(name)) between 2 and 180),
  constraint products_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint products_description_object check (jsonb_typeof(description_json) = 'object')
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid,
  name text not null,
  slug text not null,
  owner_id uuid,
  start_date date,
  end_date date,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (workspace_id, id),
  unique (workspace_id, slug),
  foreign key (workspace_id, product_id)
    references public.products(workspace_id, id) on delete restrict,
  foreign key (workspace_id, owner_id)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint events_name_length check (char_length(btrim(name)) between 2 and 180),
  constraint events_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint events_date_range_valid check (start_date is null or end_date is null or end_date >= start_date)
);

create table public.workspace_counters (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null,
  last_number bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, entity_type),
  constraint workspace_counters_number_valid check (last_number >= 0)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_number bigint not null,
  title text not null,
  description_json jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  status_id uuid not null,
  type_id uuid,
  priority public.task_priority not null default 'medium',
  product_id uuid,
  event_id uuid,
  due_date date,
  due_time time without time zone,
  due_at timestamptz,
  due_is_date_only boolean generated always as (due_date is not null and due_time is null) stored,
  completed_at timestamptz,
  completed_by uuid,
  blocked_reason text,
  estimated_minutes integer,
  week_position numeric(20, 10) not null default 1000,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid,
  version integer not null default 1,
  search_vector tsvector not null default ''::tsvector,
  unique (workspace_id, id),
  unique (workspace_id, task_number),
  foreign key (workspace_id, status_id)
    references public.task_statuses(workspace_id, id) on delete restrict,
  foreign key (workspace_id, type_id)
    references public.task_types(workspace_id, id) on delete restrict,
  foreign key (workspace_id, product_id)
    references public.products(workspace_id, id) on delete restrict,
  foreign key (workspace_id, event_id)
    references public.events(workspace_id, id) on delete restrict,
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, updated_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, completed_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, archived_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint tasks_number_valid check (task_number > 0),
  constraint tasks_title_length check (char_length(btrim(title)) between 3 and 180),
  constraint tasks_blocked_reason_length check (blocked_reason is null or char_length(blocked_reason) <= 1000),
  constraint tasks_week_position_valid check (week_position >= 0),
  constraint tasks_description_object check (jsonb_typeof(description_json) = 'object'),
  constraint tasks_description_size check (octet_length(description_json::text) <= 1000000),
  constraint tasks_due_consistent check (
    (due_date is null and due_time is null and due_at is null)
    or (due_date is not null and due_at is not null)
  ),
  constraint tasks_estimate_valid check (estimated_minutes is null or estimated_minutes > 0),
  constraint tasks_version_valid check (version >= 1),
  constraint tasks_archived_actor_consistent check (
    (archived_at is null and archived_by is null)
    or (archived_at is not null and archived_by is not null)
  )
);

create index tasks_workspace_active_updated on public.tasks (workspace_id, updated_at desc)
  where archived_at is null;
create index tasks_workspace_status_due on public.tasks (workspace_id, status_id, due_at);
create index tasks_workspace_week on public.tasks (workspace_id, due_date, week_position)
  where archived_at is null;
create index tasks_search_vector on public.tasks using gin (search_vector);

create table public.task_assignees (
  workspace_id uuid not null,
  task_id uuid not null,
  user_id uuid not null,
  is_primary boolean not null default false,
  assigned_by uuid not null,
  assigned_at timestamptz not null default now(),
  primary key (workspace_id, task_id, user_id),
  foreign key (workspace_id, task_id)
    references public.tasks(workspace_id, id) on delete cascade,
  foreign key (workspace_id, user_id)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, assigned_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict
);

create unique index task_assignees_one_primary on public.task_assignees (task_id) where is_primary;

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  changes_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_changes_object check (jsonb_typeof(changes_json) = 'object'),
  constraint activity_metadata_object check (jsonb_typeof(metadata_json) = 'object')
);

create index activity_entity_created
  on public.activity_logs (workspace_id, entity_type, entity_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid not null,
  actor_id uuid references public.profiles(id) on delete set null,
  notification_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  title text not null,
  body text,
  dedupe_key text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  archived_at timestamptz,
  foreign key (workspace_id, user_id)
    references public.workspace_members(workspace_id, user_id) on delete cascade,
  constraint notifications_title_length check (char_length(title) between 1 and 180)
);

create unique index notifications_dedupe_unique on public.notifications (dedupe_key)
  where dedupe_key is not null;
create index notifications_inbox on public.notifications (user_id, read_at, created_at desc)
  where archived_at is null;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger workspaces_updated_at before update on public.workspaces
  for each row execute function private.set_updated_at();
create trigger task_statuses_updated_at before update on public.task_statuses
  for each row execute function private.set_updated_at();
create trigger task_types_updated_at before update on public.task_types
  for each row execute function private.set_updated_at();
create trigger products_updated_at before update on public.products
  for each row execute function private.set_updated_at();
create trigger events_updated_at before update on public.events
  for each row execute function private.set_updated_at();

create or replace function private.sync_auth_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, locale, created_at, updated_at)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(split_part(new.email, '@', 1), ''), 'Usuário'),
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'pt-BR'),
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    updated_at = now();
  return new;
end;
$$;

alter function private.sync_auth_profile() owner to postgres;
drop trigger if exists auth_user_profile_sync on auth.users;
create trigger auth_user_profile_sync
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function private.sync_auth_profile();

create or replace function private.is_active_workspace_member(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members wm
    join public.profiles p on p.id = wm.user_id and p.is_active
    join public.workspaces w on w.id = wm.workspace_id and w.archived_at is null
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
  );
$$;

create or replace function private.current_workspace_role(p_workspace_id uuid)
returns public.workspace_role language sql stable security definer set search_path = '' as $$
  select wm.role from public.workspace_members wm
  join public.profiles p on p.id = wm.user_id and p.is_active
  join public.workspaces w on w.id = wm.workspace_id and w.archived_at is null
  where wm.workspace_id = p_workspace_id
    and wm.user_id = (select auth.uid())
    and wm.status = 'active'
  limit 1;
$$;

create or replace function private.shares_active_workspace(p_other_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles own_profile
    where own_profile.id = (select auth.uid()) and own_profile.is_active
  ) and (
    p_other_user_id = (select auth.uid()) or exists (
    select 1 from public.workspace_members mine
    join public.workspace_members other_member on other_member.workspace_id = mine.workspace_id
    join public.workspaces w on w.id = mine.workspace_id and w.archived_at is null
    join public.profiles other_profile on other_profile.id = other_member.user_id and other_profile.is_active
    where mine.user_id = (select auth.uid()) and mine.status = 'active'
      and other_member.user_id = p_other_user_id and other_member.status = 'active'
    )
  );
$$;

create or replace function private.can_create_tasks(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    private.current_workspace_role(p_workspace_id) in ('owner', 'admin', 'manager', 'member'),
    false
  );
$$;

create or replace function private.can_edit_task(p_task_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks t
    join public.workspace_members wm
      on wm.workspace_id = t.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
    join public.profiles p on p.id = wm.user_id and p.is_active
    join public.workspaces w on w.id = wm.workspace_id and w.archived_at is null
    where t.id = p_task_id
      and t.archived_at is null
      and (
        wm.role in ('owner', 'admin', 'manager')
        or (
          wm.role = 'member'
          and (
            t.created_by = (select auth.uid())
            or exists (
              select 1 from public.task_assignees ta
              where ta.workspace_id = t.workspace_id
                and ta.task_id = t.id
                and ta.user_id = (select auth.uid())
            )
          )
        )
      )
  );
$$;

create or replace function private.next_task_number(p_workspace_id uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_number bigint;
begin
  insert into public.workspace_counters (workspace_id, entity_type, last_number)
  values (p_workspace_id, 'task', 0)
  on conflict (workspace_id, entity_type) do nothing;

  update public.workspace_counters
  set last_number = last_number + 1, updated_at = clock_timestamp()
  where workspace_id = p_workspace_id and entity_type = 'task'
  returning last_number into v_number;

  return v_number;
end;
$$;

create or replace function private.tasks_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_timezone text;
  v_default_due_time time without time zone;
  v_status_category public.task_status_category;
  v_status_active boolean;
  v_event_product_id uuid;
begin
  new.title := btrim(new.title);

  if tg_op = 'INSERT' then
    new.task_number := private.next_task_number(new.workspace_id);
    new.created_by := coalesce(new.created_by, v_actor);
    new.updated_by := coalesce(new.updated_by, v_actor);
    new.version := 1;
  else
    new.id := old.id;
    new.workspace_id := old.workspace_id;
    new.task_number := old.task_number;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_by := coalesce(v_actor, new.updated_by, old.updated_by);
    new.updated_at := clock_timestamp();
    new.version := old.version + 1;
  end if;

  select ts.system_category, ts.is_active into v_status_category, v_status_active
  from public.task_statuses ts
  where ts.workspace_id = new.workspace_id and ts.id = new.status_id;
  if not found then raise exception using errcode = '23503', message = 'PTA_INVALID_TASK_STATUS'; end if;
  if (tg_op = 'INSERT' or new.status_id is distinct from old.status_id) and not v_status_active then
    raise exception using errcode = '23514', message = 'PTA_INACTIVE_TASK_STATUS';
  end if;

  if new.event_id is not null then
    select e.product_id into v_event_product_id from public.events e
    where e.workspace_id = new.workspace_id and e.id = new.event_id and e.archived_at is null;
    if not found then raise exception using errcode = '23503', message = 'PTA_INVALID_TASK_EVENT'; end if;
    if v_event_product_id is not null and new.product_id is null then new.product_id := v_event_product_id; end if;
    if v_event_product_id is not null and new.product_id <> v_event_product_id then
      raise exception using errcode = '23514', message = 'PTA_EVENT_PRODUCT_MISMATCH';
    end if;
  end if;

  if new.product_id is not null and not exists (
    select 1 from public.products p
    where p.workspace_id = new.workspace_id and p.id = new.product_id and p.archived_at is null
  ) then
    raise exception using errcode = '23503', message = 'PTA_INVALID_TASK_PRODUCT';
  end if;

  select w.timezone, w.default_due_time into v_timezone, v_default_due_time
  from public.workspaces w where w.id = new.workspace_id and w.archived_at is null;
  if not found then raise exception using errcode = '23503', message = 'PTA_INVALID_WORKSPACE'; end if;

  if new.due_date is null then
    new.due_time := null;
    new.due_at := null;
  else
    new.due_at := (new.due_date + coalesce(new.due_time, v_default_due_time)) at time zone v_timezone;
  end if;

  if v_status_category = 'done' then
    new.completed_at := coalesce(new.completed_at, clock_timestamp());
    new.completed_by := coalesce(new.completed_by, v_actor, new.updated_by);
  else
    new.completed_at := null;
    new.completed_by := null;
  end if;

  if v_status_category = 'blocked' then
    new.blocked_reason := nullif(btrim(new.blocked_reason), '');
    if new.blocked_reason is null then
      raise exception using errcode = '23514', message = 'PTA_BLOCKED_REASON_REQUIRED';
    end if;
  else
    new.blocked_reason := null;
  end if;

  new.search_vector :=
    setweight(to_tsvector('pg_catalog.portuguese'::regconfig, coalesce(new.title, '')), 'A')
    || setweight(to_tsvector('pg_catalog.simple'::regconfig, new.task_number::text), 'A');
  return new;
end;
$$;

create trigger tasks_before_write before insert or update on public.tasks
  for each row execute function private.tasks_before_write();

create or replace function private.tasks_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_changes jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.activity_logs (workspace_id, actor_id, entity_type, entity_id, action, metadata_json)
    values (new.workspace_id, new.created_by, 'task', new.id, 'task.created', jsonb_build_object('task_number', new.task_number));
    insert into public.notifications (
      workspace_id, user_id, actor_id, notification_type, entity_type, entity_id, title, body, dedupe_key
    ) values (
      new.workspace_id, new.created_by, new.created_by, 'task_created', 'task', new.id,
      'Demanda criada', new.title, format('task_created:%s:%s', new.id, new.created_by)
    ) on conflict do nothing;
    return new;
  end if;

  if new.title is distinct from old.title then
    v_changes := v_changes || jsonb_build_object('title', jsonb_build_object('old', old.title, 'new', new.title));
  end if;
  if new.status_id is distinct from old.status_id then
    v_changes := v_changes || jsonb_build_object('status_id', jsonb_build_object('old', old.status_id, 'new', new.status_id));
  end if;
  if new.priority is distinct from old.priority then
    v_changes := v_changes || jsonb_build_object('priority', jsonb_build_object('old', old.priority, 'new', new.priority));
  end if;
  if new.due_date is distinct from old.due_date or new.due_time is distinct from old.due_time then
    v_changes := v_changes || jsonb_build_object('due', jsonb_build_object(
      'old', jsonb_build_object('date', old.due_date, 'time', old.due_time),
      'new', jsonb_build_object('date', new.due_date, 'time', new.due_time)
    ));
  end if;
  if v_changes <> '{}'::jsonb then
    insert into public.activity_logs (workspace_id, actor_id, entity_type, entity_id, action, changes_json)
    values (new.workspace_id, new.updated_by, 'task', new.id, 'task.updated', v_changes);
  end if;
  return new;
end;
$$;

create trigger tasks_after_write after insert or update on public.tasks
  for each row execute function private.tasks_after_write();

create or replace function private.assignees_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_row public.task_assignees%rowtype; v_action text; v_notify boolean := false;
begin
  if tg_op = 'DELETE' then
    v_row := old;
    v_action := 'task.assignee_removed';
  elsif tg_op = 'UPDATE' then
    v_row := new;
    v_action := 'task.assignee_changed';
    v_notify := new.is_primary and not old.is_primary;
  else
    v_row := new;
    v_action := 'task.assignee_added';
    v_notify := true;
  end if;
  insert into public.activity_logs (workspace_id, actor_id, entity_type, entity_id, action, metadata_json)
  values (v_row.workspace_id, coalesce(auth.uid(), v_row.assigned_by), 'task', v_row.task_id, v_action,
    jsonb_build_object('user_id', v_row.user_id, 'is_primary', v_row.is_primary));
  if v_notify and v_row.user_id is distinct from auth.uid() then
    insert into public.notifications (
      workspace_id, user_id, actor_id, notification_type, entity_type, entity_id, title, body, dedupe_key
    ) values (
      v_row.workspace_id, v_row.user_id, auth.uid(), 'task_assigned', 'task', v_row.task_id,
      'Nova demanda atribuída', 'Uma demanda foi atribuída a você.',
      format('task_assigned:%s:%s:%s', v_row.task_id, v_row.user_id, extract(epoch from v_row.assigned_at)::bigint)
    ) on conflict do nothing;
  end if;
  return null;
end;
$$;

create trigger assignees_after_write after insert or update or delete on public.task_assignees
  for each row execute function private.assignees_after_write();

create or replace function private.prevent_activity_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = '42501', message = 'PTA_ACTIVITY_LOG_IS_APPEND_ONLY';
end;
$$;

create trigger activity_logs_immutable before update or delete on public.activity_logs
  for each row execute function private.prevent_activity_mutation();

alter function private.next_task_number(uuid) owner to postgres;
alter function private.tasks_before_write() owner to postgres;
alter function private.tasks_after_write() owner to postgres;
alter function private.assignees_after_write() owner to postgres;

create or replace function public.bootstrap_user_workspace(
  p_name text,
  p_slug text,
  p_task_prefix text default 'PTA'
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_workspace_id uuid;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED'; end if;
  if not coalesce((select enabled from private.runtime_flags where key = 'allow_self_bootstrap'), false) then
    raise exception using errcode = '42501', message = 'PTA_BOOTSTRAP_DISABLED';
  end if;
  insert into public.profiles (id, full_name, email, locale)
  select
    u.id,
    coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(split_part(u.email, '@', 1), ''), 'Usuário'),
    u.email,
    coalesce(nullif(u.raw_user_meta_data ->> 'locale', ''), 'pt-BR')
  from auth.users u
  where u.id = v_user_id
  on conflict (id) do nothing;
  if not exists (select 1 from public.profiles where id = v_user_id and is_active) then
    raise exception using errcode = '42501', message = 'PTA_PROFILE_INACTIVE';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  if exists (select 1 from public.workspace_members where user_id = v_user_id) then
    raise exception using errcode = '23514', message = 'PTA_WORKSPACE_ALREADY_BOOTSTRAPPED';
  end if;
  insert into public.workspaces (name, slug, task_prefix, created_by)
  values (p_name, lower(btrim(p_slug)), upper(btrim(p_task_prefix)), v_user_id)
  returning id into v_workspace_id;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'owner');
  insert into public.workspace_preferences (workspace_id) values (v_workspace_id);
  insert into public.task_statuses (workspace_id, name, system_category, color, position, is_default)
  values
    (v_workspace_id, 'A fazer', 'todo', 'stone', 10, true),
    (v_workspace_id, 'Em andamento', 'in_progress', 'blue', 20, false),
    (v_workspace_id, 'Em revisão', 'review', 'violet', 30, false),
    (v_workspace_id, 'Bloqueada', 'blocked', 'red', 40, false),
    (v_workspace_id, 'Concluída', 'done', 'green', 50, false),
    (v_workspace_id, 'Cancelada', 'cancelled', 'stone', 60, false);
  insert into public.task_types (workspace_id, name, position)
  values (v_workspace_id, 'Operação', 10), (v_workspace_id, 'Criativo', 20), (v_workspace_id, 'Gestão', 30);
  return v_workspace_id;
end;
$$;

create or replace function public.create_task(
  p_workspace_id uuid,
  p_title text,
  p_status_id uuid default null,
  p_priority public.task_priority default 'medium',
  p_due_date date default null,
  p_due_time time without time zone default null,
  p_primary_assignee_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_status_id uuid; v_task public.tasks%rowtype;
begin
  if v_user_id is null or not private.can_create_tasks(p_workspace_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  select coalesce(p_status_id, (
    select id from public.task_statuses
    where workspace_id = p_workspace_id and is_default and is_active
    order by position limit 1
  )) into v_status_id;
  if v_status_id is null then
    raise exception using errcode = '23514', message = 'PTA_DEFAULT_STATUS_REQUIRED';
  end if;
  if p_primary_assignee_id is not null then
    if private.current_workspace_role(p_workspace_id) = 'member'
       and p_primary_assignee_id <> v_user_id then
      raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
    end if;
    if not exists (
      select 1 from public.workspace_members wm
      join public.profiles p on p.id = wm.user_id and p.is_active
      where wm.workspace_id = p_workspace_id
        and wm.user_id = p_primary_assignee_id
        and wm.status = 'active'
        and wm.role <> 'viewer'
    ) then
      raise exception using errcode = '23514', message = 'PTA_ASSIGNEE_NOT_ACTIVE_MEMBER';
    end if;
  end if;
  insert into public.tasks (
    workspace_id, title, status_id, priority, due_date, due_time, created_by, updated_by
  ) values (
    p_workspace_id, p_title, v_status_id, p_priority, p_due_date, p_due_time, v_user_id, v_user_id
  ) returning * into v_task;
  if p_primary_assignee_id is not null then
    insert into public.task_assignees (workspace_id, task_id, user_id, is_primary, assigned_by)
    values (p_workspace_id, v_task.id, p_primary_assignee_id, true, v_user_id);
  end if;
  return jsonb_build_object('id', v_task.id, 'task_number', v_task.task_number, 'version', v_task.version);
end;
$$;

create or replace function public.update_task(
  p_task_id uuid,
  p_expected_version integer,
  p_patch jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_task public.tasks%rowtype; v_workspace_id uuid;
begin
  select workspace_id into v_workspace_id from public.tasks where id = p_task_id;
  if v_user_id is null or not private.can_edit_task(p_task_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception using errcode = '22023', message = 'PTA_PATCH_MUST_BE_OBJECT';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_patch) as k(key)
    where k.key <> all (array['title', 'status_id', 'priority', 'due_date', 'due_time', 'blocked_reason']::text[])
  ) then raise exception using errcode = '22023', message = 'PTA_PATCH_HAS_UNSUPPORTED_FIELDS'; end if;
  update public.tasks t set
    title = case when p_patch ? 'title' then p_patch ->> 'title' else t.title end,
    status_id = case when p_patch ? 'status_id' then (p_patch ->> 'status_id')::uuid else t.status_id end,
    priority = case when p_patch ? 'priority' then (p_patch ->> 'priority')::public.task_priority else t.priority end,
    due_date = case when p_patch ? 'due_date' then nullif(p_patch ->> 'due_date', '')::date else t.due_date end,
    due_time = case when p_patch ? 'due_time' then nullif(p_patch ->> 'due_time', '')::time else t.due_time end,
    blocked_reason = case when p_patch ? 'blocked_reason' then p_patch ->> 'blocked_reason' else t.blocked_reason end,
    updated_by = v_user_id
  where t.id = p_task_id and t.version = p_expected_version
  returning * into v_task;
  if not found then raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT'; end if;
  return jsonb_build_object('id', v_task.id, 'version', v_task.version, 'updated_at', v_task.updated_at);
end;
$$;

create or replace function public.set_task_primary_assignee(
  p_task_id uuid,
  p_user_id uuid,
  p_expected_version integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_task public.tasks%rowtype;
begin
  if v_actor is null or not private.can_edit_task(p_task_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or not private.can_edit_task(p_task_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if private.current_workspace_role(v_task.workspace_id) not in ('owner', 'admin', 'manager') then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if v_task.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;
  if p_user_id is not null and not exists (
    select 1 from public.workspace_members wm
    join public.profiles p on p.id = wm.user_id and p.is_active
    where wm.workspace_id = v_task.workspace_id
      and wm.user_id = p_user_id
      and wm.status = 'active'
      and wm.role <> 'viewer'
  ) then raise exception using errcode = '23514', message = 'PTA_ASSIGNEE_NOT_ACTIVE_MEMBER'; end if;
  delete from public.task_assignees
  where workspace_id = v_task.workspace_id and task_id = p_task_id and is_primary;
  if p_user_id is not null then
    insert into public.task_assignees (workspace_id, task_id, user_id, is_primary, assigned_by)
    values (v_task.workspace_id, p_task_id, p_user_id, true, v_actor)
    on conflict (workspace_id, task_id, user_id) do update set
      is_primary = true,
      assigned_by = excluded.assigned_by,
      assigned_at = clock_timestamp();
  end if;
  update public.tasks set updated_by = v_actor where id = p_task_id returning * into v_task;
  return jsonb_build_object('id', v_task.id, 'primary_assignee_id', p_user_id, 'version', v_task.version);
end;
$$;

create or replace function public.move_task_to_day(
  p_task_id uuid,
  p_due_date date,
  p_position numeric,
  p_expected_version integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_task public.tasks%rowtype;
begin
  if v_actor is null or not private.can_edit_task(p_task_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if p_due_date is null or p_position is null or p_position < 0 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_WEEK_POSITION';
  end if;
  update public.tasks t set
    due_date = p_due_date,
    week_position = p_position,
    updated_by = v_actor
  where t.id = p_task_id and t.version = p_expected_version
  returning * into v_task;
  if not found then raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT'; end if;
  return jsonb_build_object(
    'id', v_task.id,
    'due_date', v_task.due_date,
    'week_position', v_task.week_position,
    'version', v_task.version
  );
end;
$$;

alter function public.bootstrap_user_workspace(text, text, text) owner to postgres;
comment on function public.bootstrap_user_workspace(text, text, text) is
  'Local development bootstrap. Disabled by default; enable only through the local seed.';
alter function public.create_task(uuid, text, uuid, public.task_priority, date, time without time zone, uuid) owner to postgres;
alter function public.update_task(uuid, integer, jsonb) owner to postgres;
alter function public.set_task_primary_assignee(uuid, uuid, integer) owner to postgres;
alter function public.move_task_to_day(uuid, date, numeric, integer) owner to postgres;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_members force row level security;
alter table public.workspace_invitations enable row level security;
alter table public.workspace_invitations force row level security;
alter table public.workspace_preferences enable row level security;
alter table public.workspace_preferences force row level security;
alter table public.task_statuses enable row level security;
alter table public.task_statuses force row level security;
alter table public.task_types enable row level security;
alter table public.task_types force row level security;
alter table public.products enable row level security;
alter table public.products force row level security;
alter table public.events enable row level security;
alter table public.events force row level security;
alter table public.workspace_counters enable row level security;
alter table public.workspace_counters force row level security;
alter table public.tasks enable row level security;
alter table public.tasks force row level security;
alter table public.task_assignees enable row level security;
alter table public.task_assignees force row level security;
alter table public.activity_logs enable row level security;
alter table public.activity_logs force row level security;
alter table public.notifications enable row level security;
alter table public.notifications force row level security;

create policy profiles_select_shared on public.profiles for select to authenticated
  using (private.shares_active_workspace(id));
create policy workspaces_select_member on public.workspaces for select to authenticated
  using (private.is_active_workspace_member(id));
create policy members_select_member on public.workspace_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_active_workspace_member(workspace_id));
create policy preferences_select_member on public.workspace_preferences for select to authenticated
  using (private.is_active_workspace_member(workspace_id));
create policy statuses_select_member on public.task_statuses for select to authenticated
  using (private.is_active_workspace_member(workspace_id));
create policy types_select_member on public.task_types for select to authenticated
  using (private.is_active_workspace_member(workspace_id));
create policy products_select_member on public.products for select to authenticated
  using (private.is_active_workspace_member(workspace_id));
create policy events_select_member on public.events for select to authenticated
  using (private.is_active_workspace_member(workspace_id));
create policy tasks_select_member on public.tasks for select to authenticated
  using (private.is_active_workspace_member(workspace_id));
create policy assignees_select_member on public.task_assignees for select to authenticated
  using (private.is_active_workspace_member(workspace_id));
create policy activity_select_member on public.activity_logs for select to authenticated
  using (private.is_active_workspace_member(workspace_id));
create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and private.is_active_workspace_member(workspace_id));
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid()) and private.is_active_workspace_member(workspace_id))
  with check (user_id = (select auth.uid()) and private.is_active_workspace_member(workspace_id));

revoke all on
  public.profiles,
  public.workspaces,
  public.workspace_members,
  public.workspace_invitations,
  public.workspace_preferences,
  public.task_statuses,
  public.task_types,
  public.products,
  public.events,
  public.workspace_counters,
  public.tasks,
  public.task_assignees,
  public.activity_logs,
  public.notifications
from anon, authenticated;
grant select on public.profiles, public.workspaces, public.workspace_members, public.task_statuses,
  public.task_types, public.products, public.events, public.tasks, public.task_assignees,
  public.activity_logs, public.notifications, public.workspace_preferences to authenticated;
grant update (read_at, archived_at) on public.notifications to authenticated;

create view public.v_task_overview with (security_invoker = true) as
select
  t.id,
  t.workspace_id,
  w.task_prefix || '-' || lpad(t.task_number::text, 6, '0') as task_key,
  t.task_number,
  t.title,
  t.priority,
  t.status_id,
  ts.name as status_name,
  ts.system_category as status_category,
  ts.color as status_color,
  t.due_date,
  t.due_time,
  t.due_is_date_only,
  t.week_position,
  t.version,
  t.created_by,
  t.created_at,
  t.updated_at,
  ta.user_id as primary_assignee_id,
  p.full_name as primary_assignee_name
from public.tasks t
join public.workspaces w on w.id = t.workspace_id
join public.task_statuses ts on ts.workspace_id = t.workspace_id and ts.id = t.status_id
left join public.task_assignees ta
  on ta.workspace_id = t.workspace_id and ta.task_id = t.id and ta.is_primary
left join public.profiles p on p.id = ta.user_id
where t.archived_at is null;

revoke all on public.v_task_overview from anon, authenticated;
grant select on public.v_task_overview to authenticated;

create or replace function public.get_task_detail(p_task_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_workspace_id uuid; v_task jsonb; v_activity jsonb;
begin
  select workspace_id into v_workspace_id from public.tasks where id = p_task_id;
  if not private.is_active_workspace_member(v_workspace_id) then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;
  select to_jsonb(v) into v_task from public.v_task_overview v where v.id = p_task_id;
  if v_task is null then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb)
  into v_activity from (
    select id, actor_id, action, changes_json, metadata_json, created_at
    from public.activity_logs
    where workspace_id = v_workspace_id and entity_type = 'task' and entity_id = p_task_id
    order by created_at desc limit 50
  ) a;
  return jsonb_build_object(
    'task', v_task,
    'activity', v_activity,
    'capabilities', jsonb_build_object(
      'can_edit', private.can_edit_task(p_task_id),
      'can_manage_assignees', private.current_workspace_role(v_workspace_id) in ('owner', 'admin', 'manager')
    )
  );
end;
$$;

alter function public.get_task_detail(uuid) owner to postgres;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_active_workspace_member(uuid) to authenticated;
grant execute on function private.current_workspace_role(uuid) to authenticated;
grant execute on function private.shares_active_workspace(uuid) to authenticated;

revoke execute on function public.bootstrap_user_workspace(text, text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_user_workspace(text, text, text) to authenticated;
revoke execute on function public.create_task(uuid, text, uuid, public.task_priority, date, time without time zone, uuid)
  from public, anon, authenticated;
grant execute on function public.create_task(uuid, text, uuid, public.task_priority, date, time without time zone, uuid)
  to authenticated;
revoke execute on function public.update_task(uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.update_task(uuid, integer, jsonb) to authenticated;
revoke execute on function public.set_task_primary_assignee(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.set_task_primary_assignee(uuid, uuid, integer) to authenticated;
revoke execute on function public.move_task_to_day(uuid, date, numeric, integer) from public, anon, authenticated;
grant execute on function public.move_task_to_day(uuid, date, numeric, integer) to authenticated;
revoke execute on function public.get_task_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_task_detail(uuid) to authenticated;

do $$
declare v_all_tables boolean;
begin
  select p.puballtables into v_all_tables
  from pg_catalog.pg_publication p
  where p.pubname = 'supabase_realtime';

  if not found then raise exception 'Publication supabase_realtime not found'; end if;

  if not v_all_tables and not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then alter publication supabase_realtime add table public.tasks; end if;

  if not v_all_tables and not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then alter publication supabase_realtime add table public.notifications; end if;
end;
$$;

do $$
declare v_function record;
begin
  for v_function in
    select n.nspname, p.proname, r.rolname, r.rolbypassrls
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    join pg_catalog.pg_roles r on r.oid = p.proowner
    where p.prosecdef and n.nspname in ('public', 'private')
  loop
    if not v_function.rolbypassrls then
      raise exception 'SECURITY DEFINER function %.% is owned by role % without BYPASSRLS',
        v_function.nspname, v_function.proname, v_function.rolname;
    end if;
  end loop;
end;
$$;

commit;
