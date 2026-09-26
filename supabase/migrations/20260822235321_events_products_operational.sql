-- Operational portfolio for products and events.
-- Hosted migration version: 20260822235321.
-- All client mutations go through the RPCs below. This migration is intentionally
-- self-contained so it can be reviewed before it is applied to a shared project.

begin;

alter table public.products
  add column status text not null default 'active',
  add column version integer not null default 1,
  add column updated_by uuid;

update public.products set updated_by = created_by where updated_by is null;

alter table public.products
  alter column updated_by set not null,
  add constraint products_status_valid
    check (status in ('planning', 'active', 'paused', 'completed')),
  add constraint products_version_valid check (version >= 1),
  add constraint products_updated_by_member_fk
    foreign key (workspace_id, updated_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict;

alter table public.events
  add column status text not null default 'planning',
  add column summary text,
  add column objective text,
  add column success_metric text,
  add column health_override text,
  add column version integer not null default 1,
  add column updated_by uuid;

update public.events set updated_by = created_by where updated_by is null;

alter table public.events
  alter column updated_by set not null,
  add constraint events_status_valid
    check (status in ('planning', 'active', 'completed', 'cancelled')),
  add constraint events_health_override_valid
    check (health_override is null or health_override in ('healthy', 'attention', 'risk')),
  add constraint events_summary_length check (summary is null or char_length(summary) <= 4000),
  add constraint events_objective_length check (objective is null or char_length(objective) <= 1000),
  add constraint events_success_metric_length check (success_metric is null or char_length(success_metric) <= 500),
  add constraint events_version_valid check (version >= 1),
  add constraint events_updated_by_member_fk
    foreign key (workspace_id, updated_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict;

create table public.product_members (
  workspace_id uuid not null,
  product_id uuid not null,
  user_id uuid not null,
  role_label text,
  added_by uuid not null,
  added_at timestamptz not null default now(),
  primary key (workspace_id, product_id, user_id),
  foreign key (workspace_id, product_id)
    references public.products(workspace_id, id) on delete cascade,
  foreign key (workspace_id, user_id)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, added_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint product_members_role_length
    check (role_label is null or char_length(btrim(role_label)) between 1 and 80)
);

create table public.event_members (
  workspace_id uuid not null,
  event_id uuid not null,
  user_id uuid not null,
  role_label text,
  added_by uuid not null,
  added_at timestamptz not null default now(),
  primary key (workspace_id, event_id, user_id),
  foreign key (workspace_id, event_id)
    references public.events(workspace_id, id) on delete cascade,
  foreign key (workspace_id, user_id)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, added_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint event_members_role_length
    check (role_label is null or char_length(btrim(role_label)) between 1 and 80)
);

create table public.event_milestones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  event_id uuid not null,
  title text not null,
  due_date date,
  phase text not null default 'preparation',
  position integer not null default 0,
  completed_at timestamptz,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (workspace_id, id),
  foreign key (workspace_id, event_id)
    references public.events(workspace_id, id) on delete cascade,
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, updated_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint event_milestones_title_length
    check (char_length(btrim(title)) between 2 and 180),
  constraint event_milestones_phase_valid
    check (phase in ('preparation', 'capture', 'warmup', 'event', 'closing', 'post_event')),
  constraint event_milestones_position_valid check (position >= 0),
  constraint event_milestones_version_valid check (version >= 1)
);

create index product_members_product on public.product_members (workspace_id, product_id, added_at);
create index event_members_event on public.event_members (workspace_id, event_id, added_at);
create index event_milestones_event on public.event_milestones (workspace_id, event_id, position, due_date);
create index products_operational_status on public.products (workspace_id, status, updated_at desc) where archived_at is null;
create index events_operational_period on public.events (workspace_id, status, start_date, end_date) where archived_at is null;

create or replace function private.portfolio_can_manage(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.current_workspace_role(p_workspace_id) in ('owner', 'admin', 'manager'),
    false
  );
$$;

create or replace function private.portfolio_member_is_active(
  p_workspace_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1
    from public.workspace_members wm
    join public.profiles profile on profile.id = wm.user_id and profile.is_active
    where wm.workspace_id = p_workspace_id
      and wm.user_id = p_user_id
      and wm.status = 'active'
  );
$$;

create or replace function private.portfolio_slug(p_name text, p_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(extensions.unaccent(btrim(p_name))), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'item'
  ) || '-' || left(replace(p_id::text, '-', ''), 10);
$$;

create or replace function private.event_health(
  p_override text,
  p_start_date date,
  p_end_date date,
  p_progress integer,
  p_overdue integer,
  p_critical integer,
  p_blocked integer,
  p_today date
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_override is not null then p_override
    when p_critical > 0 then 'risk'
    when p_end_date is not null and p_end_date < p_today and p_progress < 100 then 'risk'
    when p_overdue >= 3 then 'risk'
    when p_overdue > 0 or p_blocked > 0 then 'attention'
    when p_start_date is not null and p_end_date is not null
      and p_end_date > p_start_date
      and p_today between p_start_date and p_end_date
      and p_progress + 20 < least(100, greatest(0,
        round(100.0 * (p_today - p_start_date) / (p_end_date - p_start_date))::integer
      )) then 'attention'
    else 'healthy'
  end;
$$;

create or replace function private.portfolio_members_valid(
  p_workspace_id uuid,
  p_member_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with requested as (
    select distinct member_id
    from unnest(coalesce(p_member_ids, array[]::uuid[])) member_id
    where member_id is not null
  )
  select not exists (
    select 1
    from requested r
    where not private.portfolio_member_is_active(p_workspace_id, r.member_id)
  );
$$;

create or replace function private.products_before_write()
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
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.version := old.version + 1;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create or replace function private.events_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.summary := nullif(btrim(new.summary), '');
  new.objective := nullif(btrim(new.objective), '');
  new.success_metric := nullif(btrim(new.success_metric), '');
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.workspace_id := old.workspace_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.version := old.version + 1;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create or replace function private.event_milestones_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.title := btrim(new.title);
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

create trigger products_operational_before_write
before insert or update on public.products
for each row execute function private.products_before_write();

create trigger events_operational_before_write
before insert or update on public.events
for each row execute function private.events_before_write();

create trigger event_milestones_before_write
before insert or update on public.event_milestones
for each row execute function private.event_milestones_before_write();

alter table public.product_members enable row level security;
alter table public.product_members force row level security;
alter table public.event_members enable row level security;
alter table public.event_members force row level security;
alter table public.event_milestones enable row level security;
alter table public.event_milestones force row level security;

create policy product_members_select_workspace
on public.product_members for select to authenticated
using (private.is_active_workspace_member(workspace_id));

create policy event_members_select_workspace
on public.event_members for select to authenticated
using (private.is_active_workspace_member(workspace_id));

create policy event_milestones_select_workspace
on public.event_milestones for select to authenticated
using (private.is_active_workspace_member(workspace_id));

revoke all on public.product_members, public.event_members, public.event_milestones from public, anon;
revoke insert, update, delete, truncate on public.products, public.events, public.product_members, public.event_members, public.event_milestones from authenticated;
grant select on public.product_members, public.event_members, public.event_milestones to authenticated;

create or replace function public.list_products_operational(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.workspace_role;
  v_result jsonb;
  v_timezone text;
  v_today date;
begin
  v_role := private.current_workspace_role(p_workspace_id);
  if auth.uid() is null or v_role is null then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  select timezone into v_timezone from public.workspaces where id = p_workspace_id;
  v_today := (clock_timestamp() at time zone v_timezone)::date;

  select coalesce(jsonb_agg(item order by item->>'updated_at' desc), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id', product.id,
      'name', product.name,
      'status', product.status,
      'description', coalesce(product.description_json->>'text', ''),
      'owner_id', product.owner_id,
      'owner_name', owner_profile.full_name,
      'version', product.version,
      'updated_at', product.updated_at,
      'event_count', (select count(*) from public.events event where event.product_id = product.id and event.archived_at is null),
      'upcoming_event_count', (select count(*) from public.events event where event.product_id = product.id and event.archived_at is null and event.end_date >= v_today),
      'task_count', (select count(*) from public.tasks task join public.task_statuses status on status.id = task.status_id and status.workspace_id = task.workspace_id where task.product_id = product.id and task.archived_at is null and status.system_category <> 'cancelled'),
      'open_task_count', (select count(*) from public.tasks task join public.task_statuses status on status.id = task.status_id and status.workspace_id = task.workspace_id where task.product_id = product.id and task.archived_at is null and status.system_category not in ('done', 'cancelled')),
      'overdue_task_count', (select count(*) from public.tasks task join public.task_statuses status on status.id = task.status_id and status.workspace_id = task.workspace_id where task.product_id = product.id and task.archived_at is null and status.system_category not in ('done', 'cancelled') and task.due_at < now()),
      'resource_count', (select count(*) from public.resource_products relation join public.resources resource on resource.id = relation.resource_id and resource.workspace_id = relation.workspace_id where relation.product_id = product.id and resource.archived_at is null and private.can_view_resource(resource.id)),
      'team_count', (select count(*) from public.product_members member where member.product_id = product.id),
      'health', case
        when exists (select 1 from public.tasks task join public.task_statuses status on status.id = task.status_id and status.workspace_id = task.workspace_id where task.product_id = product.id and task.archived_at is null and status.system_category not in ('done', 'cancelled') and task.due_at < now() and task.priority in ('high', 'urgent')) then 'risk'
        when exists (select 1 from public.tasks task join public.task_statuses status on status.id = task.status_id and status.workspace_id = task.workspace_id where task.product_id = product.id and task.archived_at is null and status.system_category not in ('done', 'cancelled') and task.due_at < now()) then 'attention'
        else 'healthy'
      end
    ) as item
    from public.products product
    left join public.profiles owner_profile on owner_profile.id = product.owner_id
    where product.workspace_id = p_workspace_id
      and product.archived_at is null
  ) rows;

  return jsonb_build_object('products', v_result);
end;
$$;

create or replace function public.list_events_operational(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.workspace_role;
  v_result jsonb;
  v_timezone text;
  v_today date;
begin
  v_role := private.current_workspace_role(p_workspace_id);
  if auth.uid() is null or v_role is null then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  select timezone into v_timezone from public.workspaces where id = p_workspace_id;
  v_today := (clock_timestamp() at time zone v_timezone)::date;

  with event_rows as (
    select
      event.*,
      product.name as product_name,
      owner_profile.full_name as owner_name,
      count(task.id) filter (where status.system_category <> 'cancelled')::integer as task_count,
      count(task.id) filter (where status.system_category = 'done')::integer as done_task_count,
      count(task.id) filter (where status.system_category not in ('done', 'cancelled'))::integer as open_task_count,
      count(task.id) filter (where status.system_category not in ('done', 'cancelled') and task.due_at < now())::integer as overdue_task_count,
      count(task.id) filter (where status.system_category = 'blocked')::integer as blocked_task_count,
      count(task.id) filter (where
        (status.system_category = 'blocked' and task.priority in ('high', 'urgent'))
        or (
          status.system_category not in ('done', 'cancelled')
          and task.due_at < now()
          and task.priority in ('high', 'urgent')
        )
      )::integer as critical_task_count
    from public.events event
    left join public.products product on product.id = event.product_id and product.workspace_id = event.workspace_id
    left join public.profiles owner_profile on owner_profile.id = event.owner_id
    left join public.tasks task on task.event_id = event.id and task.workspace_id = event.workspace_id and task.archived_at is null
    left join public.task_statuses status on status.id = task.status_id and status.workspace_id = task.workspace_id
    where event.workspace_id = p_workspace_id and event.archived_at is null
    group by event.id, product.name, owner_profile.full_name
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', row.id,
    'name', row.name,
    'status', row.status,
    'summary', row.summary,
    'product_id', row.product_id,
    'product_name', row.product_name,
    'owner_id', row.owner_id,
    'owner_name', row.owner_name,
    'start_date', row.start_date,
    'end_date', row.end_date,
    'version', row.version,
    'updated_at', row.updated_at,
    'task_count', row.task_count,
    'done_task_count', row.done_task_count,
    'open_task_count', row.open_task_count,
    'overdue_task_count', row.overdue_task_count,
    'progress', case when row.task_count = 0 then null else round(100.0 * row.done_task_count / row.task_count)::integer end,
    'health', private.event_health(
      row.health_override,
      row.start_date,
      row.end_date,
      case when row.task_count = 0 then 0 else round(100.0 * row.done_task_count / row.task_count)::integer end,
      row.overdue_task_count,
      row.critical_task_count,
      row.blocked_task_count,
      v_today
    ),
    'resource_count', (select count(*) from public.resource_events relation join public.resources resource on resource.id = relation.resource_id and resource.workspace_id = relation.workspace_id where relation.event_id = row.id and resource.archived_at is null and private.can_view_resource(resource.id)),
    'team_count', (select count(*) from public.event_members member where member.event_id = row.id),
    'milestone_count', (select count(*) from public.event_milestones milestone where milestone.event_id = row.id),
    'completed_milestone_count', (select count(*) from public.event_milestones milestone where milestone.event_id = row.id and milestone.completed_at is not null)
  ) order by row.start_date nulls last, row.name), '[]'::jsonb)
  into v_result
  from event_rows row;

  return jsonb_build_object('events', v_result, 'today', v_today);
end;
$$;

create or replace function public.get_product_operational(p_product_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_role public.workspace_role;
begin
  select * into v_product from public.products where id = p_product_id and archived_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_PRODUCT_NOT_FOUND';
  end if;
  v_role := private.current_workspace_role(v_product.workspace_id);
  if auth.uid() is null or v_role is null then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;

  return jsonb_build_object(
    'product', jsonb_build_object(
      'id', v_product.id,
      'name', v_product.name,
      'status', v_product.status,
      'description', coalesce(v_product.description_json->>'text', ''),
      'owner_id', v_product.owner_id,
      'owner_name', (select full_name from public.profiles where id = v_product.owner_id),
      'version', v_product.version,
      'created_at', v_product.created_at,
      'updated_at', v_product.updated_at
    ),
    'events', coalesce((select jsonb_agg(jsonb_build_object(
      'id', event.id, 'name', event.name, 'status', event.status,
      'start_date', event.start_date, 'end_date', event.end_date,
      'owner_name', owner_profile.full_name
    ) order by event.start_date nulls last, event.name)
      from public.events event
      left join public.profiles owner_profile on owner_profile.id = event.owner_id
      where event.product_id = v_product.id and event.archived_at is null), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object(
      'id', task.id, 'task_number', task.task_number, 'title', task.title,
      'priority', task.priority, 'due_date', task.due_date,
      'status_name', status.name, 'status_category', status.system_category,
      'assignee_name', assignee_profile.full_name
    ) order by task.updated_at desc)
      from public.tasks task
      join public.task_statuses status on status.id = task.status_id and status.workspace_id = task.workspace_id
      left join public.task_assignees assignee on assignee.task_id = task.id and assignee.workspace_id = task.workspace_id and assignee.is_primary
      left join public.profiles assignee_profile on assignee_profile.id = assignee.user_id
      where task.product_id = v_product.id and task.archived_at is null), '[]'::jsonb),
    'resources', coalesce((select jsonb_agg(jsonb_build_object(
      'id', resource.id, 'title', resource.title, 'type', resource.resource_type, 'updated_at', resource.updated_at
    ) order by resource.updated_at desc)
      from public.resource_products relation
      join public.resources resource on resource.id = relation.resource_id and resource.workspace_id = relation.workspace_id
      where relation.product_id = v_product.id and resource.archived_at is null and private.can_view_resource(resource.id)), '[]'::jsonb),
    'team', coalesce((select jsonb_agg(jsonb_build_object(
      'id', member.user_id, 'name', profile.full_name, 'role_label', member.role_label
    ) order by profile.full_name)
      from public.product_members member
      join public.profiles profile on profile.id = member.user_id
      where member.product_id = v_product.id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(log_row.item order by log_row.created_at desc)
      from (select log.created_at, jsonb_build_object(
        'id', log.id, 'action', log.action, 'actor_name', actor.full_name,
        'created_at', log.created_at
      ) item
      from public.activity_logs log
      left join public.profiles actor on actor.id = log.actor_id
      where log.workspace_id = v_product.workspace_id
        and (
          (log.entity_type = 'product' and log.entity_id = v_product.id)
          or (log.entity_type = 'event' and exists (
            select 1 from public.events related_event
            where related_event.id = log.entity_id and related_event.product_id = v_product.id
          ))
          or (log.entity_type = 'task' and exists (
            select 1 from public.tasks related_task
            where related_task.id = log.entity_id and related_task.product_id = v_product.id
          ))
        )
      order by log.created_at desc limit 50) log_row), '[]'::jsonb),
    'capabilities', jsonb_build_object(
      'can_edit', v_role in ('owner', 'admin', 'manager'),
      'can_create_task', v_role in ('owner', 'admin', 'manager', 'member')
    )
  );
end;
$$;

create or replace function public.get_event_operational(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_role public.workspace_role;
  v_task_count integer;
  v_done_task_count integer;
  v_open_task_count integer;
  v_overdue_task_count integer;
  v_blocked_task_count integer;
  v_critical_task_count integer;
  v_progress integer;
  v_timezone text;
  v_today date;
begin
  select * into v_event from public.events where id = p_event_id and archived_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_EVENT_NOT_FOUND';
  end if;
  v_role := private.current_workspace_role(v_event.workspace_id);
  if auth.uid() is null or v_role is null then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  select timezone into v_timezone from public.workspaces where id = v_event.workspace_id;
  v_today := (clock_timestamp() at time zone v_timezone)::date;

  select
    count(task.id) filter (where status.system_category <> 'cancelled')::integer,
    count(task.id) filter (where status.system_category = 'done')::integer,
    count(task.id) filter (where status.system_category not in ('done', 'cancelled'))::integer,
    count(task.id) filter (where status.system_category not in ('done', 'cancelled') and task.due_at < now())::integer,
    count(task.id) filter (where status.system_category = 'blocked')::integer,
    count(task.id) filter (where
      (status.system_category = 'blocked' and task.priority in ('high', 'urgent'))
      or (
        status.system_category not in ('done', 'cancelled')
        and task.due_at < now()
        and task.priority in ('high', 'urgent')
      )
    )::integer
  into v_task_count, v_done_task_count, v_open_task_count,
    v_overdue_task_count, v_blocked_task_count, v_critical_task_count
  from public.tasks task
  join public.task_statuses status
    on status.id = task.status_id and status.workspace_id = task.workspace_id
  where task.event_id = v_event.id and task.archived_at is null;

  v_progress := case
    when v_task_count = 0 then 0
    else round(100.0 * v_done_task_count / v_task_count)::integer
  end;

  return jsonb_build_object(
    'event', jsonb_build_object(
      'id', v_event.id, 'name', v_event.name, 'status', v_event.status,
      'summary', v_event.summary, 'objective', v_event.objective,
      'success_metric', v_event.success_metric, 'health_override', v_event.health_override,
      'product_id', v_event.product_id,
      'product_name', (select name from public.products where id = v_event.product_id),
      'owner_id', v_event.owner_id,
      'owner_name', (select full_name from public.profiles where id = v_event.owner_id),
      'start_date', v_event.start_date, 'end_date', v_event.end_date,
      'task_count', v_task_count, 'done_task_count', v_done_task_count,
      'open_task_count', v_open_task_count, 'overdue_task_count', v_overdue_task_count,
      'progress', case when v_task_count = 0 then null else v_progress end,
      'health', private.event_health(
        v_event.health_override, v_event.start_date, v_event.end_date,
        v_progress, v_overdue_task_count, v_critical_task_count,
        v_blocked_task_count, v_today
      ),
      'version', v_event.version, 'created_at', v_event.created_at, 'updated_at', v_event.updated_at
    ),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object(
      'id', task.id, 'task_number', task.task_number, 'title', task.title,
      'priority', task.priority, 'due_date', task.due_date,
      'status_name', status.name, 'status_category', status.system_category,
      'assignee_name', assignee_profile.full_name
    ) order by task.updated_at desc)
      from public.tasks task
      join public.task_statuses status on status.id = task.status_id and status.workspace_id = task.workspace_id
      left join public.task_assignees assignee on assignee.task_id = task.id and assignee.workspace_id = task.workspace_id and assignee.is_primary
      left join public.profiles assignee_profile on assignee_profile.id = assignee.user_id
      where task.event_id = v_event.id and task.archived_at is null), '[]'::jsonb),
    'resources', coalesce((select jsonb_agg(jsonb_build_object(
      'id', resource.id, 'title', resource.title, 'type', resource.resource_type, 'updated_at', resource.updated_at
    ) order by resource.updated_at desc)
      from public.resource_events relation
      join public.resources resource on resource.id = relation.resource_id and resource.workspace_id = relation.workspace_id
      where relation.event_id = v_event.id and resource.archived_at is null and private.can_view_resource(resource.id)), '[]'::jsonb),
    'team', coalesce((select jsonb_agg(jsonb_build_object(
      'id', member.user_id, 'name', profile.full_name, 'role_label', member.role_label
    ) order by profile.full_name)
      from public.event_members member
      join public.profiles profile on profile.id = member.user_id
      where member.event_id = v_event.id), '[]'::jsonb),
    'milestones', coalesce((select jsonb_agg(jsonb_build_object(
      'id', milestone.id, 'title', milestone.title, 'due_date', milestone.due_date,
      'phase', milestone.phase, 'completed_at', milestone.completed_at,
      'position', milestone.position, 'version', milestone.version
    ) order by milestone.position, milestone.due_date nulls last)
      from public.event_milestones milestone where milestone.event_id = v_event.id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(log_row.item order by log_row.created_at desc)
      from (select log.created_at, jsonb_build_object(
        'id', log.id, 'action', log.action, 'actor_name', actor.full_name,
        'created_at', log.created_at
      ) item
      from public.activity_logs log
      left join public.profiles actor on actor.id = log.actor_id
      where log.workspace_id = v_event.workspace_id
        and (
          (log.entity_type = 'event' and log.entity_id = v_event.id)
          or (log.entity_type = 'event_milestone' and log.metadata_json->>'event_id' = v_event.id::text)
          or (log.entity_type = 'task' and exists (
            select 1 from public.tasks related_task
            where related_task.id = log.entity_id and related_task.event_id = v_event.id
          ))
        )
      order by log.created_at desc limit 50) log_row), '[]'::jsonb),
    'capabilities', jsonb_build_object(
      'can_edit', v_role in ('owner', 'admin', 'manager'),
      'can_create_task', v_role in ('owner', 'admin', 'manager', 'member')
    )
  );
end;
$$;

create or replace function public.create_product_operational(
  p_workspace_id uuid,
  p_name text,
  p_owner_id uuid default null,
  p_status text default 'active',
  p_description text default null,
  p_member_ids uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_id uuid := gen_random_uuid();
  v_product public.products%rowtype;
begin
  v_role := private.current_workspace_role(p_workspace_id);
  if v_actor is null or v_role is null or v_role not in ('owner', 'admin', 'manager') then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if p_owner_id is not null and not private.portfolio_member_is_active(p_workspace_id, p_owner_id) then
    raise exception using errcode = '23514', message = 'PTA_OWNER_NOT_ACTIVE_MEMBER';
  end if;
  if not private.portfolio_members_valid(p_workspace_id, p_member_ids) then
    raise exception using errcode = '23514', message = 'PTA_TEAM_MEMBER_NOT_ACTIVE';
  end if;

  insert into public.products (
    id, workspace_id, name, slug, description_json, owner_id, status, created_by, updated_by
  ) values (
    v_id, p_workspace_id, p_name, private.portfolio_slug(p_name, v_id),
    jsonb_build_object('text', coalesce(nullif(btrim(p_description), ''), '')),
    p_owner_id, p_status, v_actor, v_actor
  ) returning * into v_product;

  insert into public.product_members (workspace_id, product_id, user_id, added_by)
  select p_workspace_id, v_product.id, member_id, v_actor
  from (select distinct member_id from unnest(coalesce(p_member_ids, array[]::uuid[])) member_id where member_id is not null) requested;

  insert into public.activity_logs (workspace_id, actor_id, entity_type, entity_id, action)
  values (p_workspace_id, v_actor, 'product', v_product.id, 'product.created');

  return jsonb_build_object('id', v_product.id, 'version', v_product.version);
end;
$$;

create or replace function public.update_product_operational(
  p_product_id uuid,
  p_expected_version integer,
  p_patch jsonb,
  p_member_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_product public.products%rowtype;
  v_role public.workspace_role;
  v_owner_id uuid;
begin
  select * into v_product from public.products where id = p_product_id and archived_at is null for update;
  if not found then raise exception using errcode = 'P0002', message = 'PTA_PRODUCT_NOT_FOUND'; end if;
  v_role := private.current_workspace_role(v_product.workspace_id);
  if v_actor is null or v_role is null or v_role not in ('owner', 'admin', 'manager') then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if v_product.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception using errcode = '22023', message = 'PTA_PATCH_MUST_BE_OBJECT';
  end if;
  if exists (select 1 from jsonb_object_keys(p_patch) as patch_key(key) where patch_key.key <> all(array['name', 'status', 'description', 'owner_id']::text[])) then
    raise exception using errcode = '22023', message = 'PTA_PATCH_HAS_UNSUPPORTED_FIELDS';
  end if;

  v_owner_id := case when p_patch ? 'owner_id' then nullif(p_patch->>'owner_id', '')::uuid else v_product.owner_id end;
  if v_owner_id is not null and not private.portfolio_member_is_active(v_product.workspace_id, v_owner_id) then
    raise exception using errcode = '23514', message = 'PTA_OWNER_NOT_ACTIVE_MEMBER';
  end if;
  if p_member_ids is not null and not private.portfolio_members_valid(v_product.workspace_id, p_member_ids) then
    raise exception using errcode = '23514', message = 'PTA_TEAM_MEMBER_NOT_ACTIVE';
  end if;

  update public.products product set
    name = case when p_patch ? 'name' then p_patch->>'name' else product.name end,
    status = case when p_patch ? 'status' then p_patch->>'status' else product.status end,
    description_json = case when p_patch ? 'description' then jsonb_build_object('text', coalesce(p_patch->>'description', '')) else product.description_json end,
    owner_id = v_owner_id,
    updated_by = v_actor
  where product.id = p_product_id and product.version = p_expected_version
  returning * into v_product;
  if not found then raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT'; end if;

  if p_member_ids is not null then
    delete from public.product_members where product_id = v_product.id;
    insert into public.product_members (workspace_id, product_id, user_id, added_by)
    select v_product.workspace_id, v_product.id, member_id, v_actor
    from (select distinct member_id from unnest(p_member_ids) member_id where member_id is not null) requested;
  end if;

  insert into public.activity_logs (workspace_id, actor_id, entity_type, entity_id, action, changes_json)
  values (v_product.workspace_id, v_actor, 'product', v_product.id, 'product.updated', jsonb_build_object('fields', (select jsonb_agg(patch_key.key) from jsonb_object_keys(p_patch) as patch_key(key))));
  return jsonb_build_object('id', v_product.id, 'version', v_product.version, 'updated_at', v_product.updated_at);
end;
$$;

create or replace function public.create_event_operational(
  p_workspace_id uuid,
  p_name text,
  p_product_id uuid default null,
  p_owner_id uuid default null,
  p_status text default 'planning',
  p_start_date date default null,
  p_end_date date default null,
  p_summary text default null,
  p_objective text default null,
  p_success_metric text default null,
  p_member_ids uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_id uuid := gen_random_uuid();
  v_event public.events%rowtype;
begin
  v_role := private.current_workspace_role(p_workspace_id);
  if v_actor is null or v_role is null or v_role not in ('owner', 'admin', 'manager') then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if p_product_id is not null and not exists (select 1 from public.products where id = p_product_id and workspace_id = p_workspace_id and archived_at is null) then
    raise exception using errcode = '23514', message = 'PTA_PRODUCT_NOT_ACTIVE';
  end if;
  if p_owner_id is not null and not private.portfolio_member_is_active(p_workspace_id, p_owner_id) then
    raise exception using errcode = '23514', message = 'PTA_OWNER_NOT_ACTIVE_MEMBER';
  end if;
  if not private.portfolio_members_valid(p_workspace_id, p_member_ids) then
    raise exception using errcode = '23514', message = 'PTA_TEAM_MEMBER_NOT_ACTIVE';
  end if;

  insert into public.events (
    id, workspace_id, product_id, name, slug, owner_id, status, start_date, end_date,
    summary, objective, success_metric, created_by, updated_by
  ) values (
    v_id, p_workspace_id, p_product_id, p_name, private.portfolio_slug(p_name, v_id), p_owner_id,
    p_status, p_start_date, p_end_date, p_summary, p_objective, p_success_metric, v_actor, v_actor
  ) returning * into v_event;

  insert into public.event_members (workspace_id, event_id, user_id, added_by)
  select p_workspace_id, v_event.id, member_id, v_actor
  from (select distinct member_id from unnest(coalesce(p_member_ids, array[]::uuid[])) member_id where member_id is not null) requested;

  insert into public.activity_logs (workspace_id, actor_id, entity_type, entity_id, action)
  values (p_workspace_id, v_actor, 'event', v_event.id, 'event.created');
  return jsonb_build_object('id', v_event.id, 'version', v_event.version);
end;
$$;

create or replace function public.update_event_operational(
  p_event_id uuid,
  p_expected_version integer,
  p_patch jsonb,
  p_member_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_event public.events%rowtype;
  v_role public.workspace_role;
  v_owner_id uuid;
  v_product_id uuid;
begin
  select * into v_event from public.events where id = p_event_id and archived_at is null for update;
  if not found then raise exception using errcode = 'P0002', message = 'PTA_EVENT_NOT_FOUND'; end if;
  v_role := private.current_workspace_role(v_event.workspace_id);
  if v_actor is null or v_role is null or v_role not in ('owner', 'admin', 'manager') then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if v_event.version <> p_expected_version then raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then raise exception using errcode = '22023', message = 'PTA_PATCH_MUST_BE_OBJECT'; end if;
  if exists (select 1 from jsonb_object_keys(p_patch) as patch_key(key) where patch_key.key <> all(array['name', 'status', 'summary', 'objective', 'success_metric', 'health_override', 'product_id', 'owner_id', 'start_date', 'end_date']::text[])) then
    raise exception using errcode = '22023', message = 'PTA_PATCH_HAS_UNSUPPORTED_FIELDS';
  end if;
  v_owner_id := case when p_patch ? 'owner_id' then nullif(p_patch->>'owner_id', '')::uuid else v_event.owner_id end;
  v_product_id := case when p_patch ? 'product_id' then nullif(p_patch->>'product_id', '')::uuid else v_event.product_id end;
  if v_owner_id is not null and not private.portfolio_member_is_active(v_event.workspace_id, v_owner_id) then raise exception using errcode = '23514', message = 'PTA_OWNER_NOT_ACTIVE_MEMBER'; end if;
  if v_product_id is not null and not exists (select 1 from public.products where id = v_product_id and workspace_id = v_event.workspace_id and archived_at is null) then raise exception using errcode = '23514', message = 'PTA_PRODUCT_NOT_ACTIVE'; end if;
  if v_product_id is distinct from v_event.product_id and exists (
    select 1 from public.tasks task
    where task.event_id = v_event.id
      and task.archived_at is null
      and task.product_id is distinct from v_product_id
  ) then
    raise exception using errcode = '23514', message = 'PTA_EVENT_PRODUCT_HAS_TASKS_MISMATCH';
  end if;
  if p_member_ids is not null and not private.portfolio_members_valid(v_event.workspace_id, p_member_ids) then raise exception using errcode = '23514', message = 'PTA_TEAM_MEMBER_NOT_ACTIVE'; end if;

  update public.events event set
    name = case when p_patch ? 'name' then p_patch->>'name' else event.name end,
    status = case when p_patch ? 'status' then p_patch->>'status' else event.status end,
    summary = case when p_patch ? 'summary' then p_patch->>'summary' else event.summary end,
    objective = case when p_patch ? 'objective' then p_patch->>'objective' else event.objective end,
    success_metric = case when p_patch ? 'success_metric' then p_patch->>'success_metric' else event.success_metric end,
    health_override = case when p_patch ? 'health_override' then nullif(p_patch->>'health_override', '') else event.health_override end,
    product_id = v_product_id,
    owner_id = v_owner_id,
    start_date = case when p_patch ? 'start_date' then nullif(p_patch->>'start_date', '')::date else event.start_date end,
    end_date = case when p_patch ? 'end_date' then nullif(p_patch->>'end_date', '')::date else event.end_date end,
    updated_by = v_actor
  where event.id = p_event_id and event.version = p_expected_version
  returning * into v_event;
  if not found then raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT'; end if;

  if p_member_ids is not null then
    delete from public.event_members where event_id = v_event.id;
    insert into public.event_members (workspace_id, event_id, user_id, added_by)
    select v_event.workspace_id, v_event.id, member_id, v_actor
    from (select distinct member_id from unnest(p_member_ids) member_id where member_id is not null) requested;
  end if;
  insert into public.activity_logs (workspace_id, actor_id, entity_type, entity_id, action, changes_json)
  values (v_event.workspace_id, v_actor, 'event', v_event.id, 'event.updated', jsonb_build_object('fields', (select jsonb_agg(patch_key.key) from jsonb_object_keys(p_patch) as patch_key(key))));
  return jsonb_build_object('id', v_event.id, 'version', v_event.version, 'updated_at', v_event.updated_at);
end;
$$;

create or replace function public.create_event_milestone(
  p_event_id uuid,
  p_title text,
  p_due_date date default null,
  p_phase text default 'preparation'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_event public.events%rowtype;
  v_milestone public.event_milestones%rowtype;
  v_role public.workspace_role;
begin
  select * into v_event from public.events where id = p_event_id and archived_at is null;
  if not found then raise exception using errcode = 'P0002', message = 'PTA_EVENT_NOT_FOUND'; end if;
  v_role := private.current_workspace_role(v_event.workspace_id);
  if v_actor is null or v_role is null or v_role not in ('owner', 'admin', 'manager') then raise exception using errcode = '42501', message = 'PTA_FORBIDDEN'; end if;
  insert into public.event_milestones (workspace_id, event_id, title, due_date, phase, position, created_by, updated_by)
  values (v_event.workspace_id, v_event.id, p_title, p_due_date, p_phase,
    coalesce((select max(position) + 1000 from public.event_milestones where event_id = v_event.id), 1000), v_actor, v_actor)
  returning * into v_milestone;
  insert into public.activity_logs (workspace_id, actor_id, entity_type, entity_id, action, metadata_json)
  values (v_event.workspace_id, v_actor, 'event_milestone', v_milestone.id, 'event.milestone_created', jsonb_build_object('event_id', v_event.id));
  return jsonb_build_object('id', v_milestone.id, 'version', v_milestone.version);
end;
$$;

create or replace function public.toggle_event_milestone(
  p_milestone_id uuid,
  p_expected_version integer,
  p_completed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_milestone public.event_milestones%rowtype;
  v_role public.workspace_role;
begin
  select * into v_milestone from public.event_milestones where id = p_milestone_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PTA_MILESTONE_NOT_FOUND'; end if;
  v_role := private.current_workspace_role(v_milestone.workspace_id);
  if v_actor is null or v_role is null or v_role not in ('owner', 'admin', 'manager') then raise exception using errcode = '42501', message = 'PTA_FORBIDDEN'; end if;
  update public.event_milestones milestone set
    completed_at = case when p_completed then clock_timestamp() else null end,
    updated_by = v_actor
  where milestone.id = p_milestone_id and milestone.version = p_expected_version
  returning * into v_milestone;
  if not found then raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT'; end if;
  insert into public.activity_logs (workspace_id, actor_id, entity_type, entity_id, action, metadata_json)
  values (v_milestone.workspace_id, v_actor, 'event_milestone', v_milestone.id,
    case when p_completed then 'event.milestone_completed' else 'event.milestone_reopened' end,
    jsonb_build_object('event_id', v_milestone.event_id));
  return jsonb_build_object('id', v_milestone.id, 'version', v_milestone.version, 'completed_at', v_milestone.completed_at);
end;
$$;

create or replace function public.create_context_task(
  p_workspace_id uuid,
  p_context_type text,
  p_context_id uuid,
  p_title text,
  p_status_id uuid default null,
  p_priority public.task_priority default 'medium',
  p_due_date date default null,
  p_primary_assignee_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_status_id uuid;
  v_product_id uuid;
  v_event_id uuid;
  v_task public.tasks%rowtype;
begin
  v_role := private.current_workspace_role(p_workspace_id);
  if v_actor is null or v_role is null or v_role = 'viewer' then raise exception using errcode = '42501', message = 'PTA_FORBIDDEN'; end if;
  if p_context_type = 'product' then
    select id into v_product_id from public.products where id = p_context_id and workspace_id = p_workspace_id and archived_at is null;
    if v_product_id is null then raise exception using errcode = '23514', message = 'PTA_PRODUCT_NOT_ACTIVE'; end if;
  elsif p_context_type = 'event' then
    select id, product_id into v_event_id, v_product_id from public.events where id = p_context_id and workspace_id = p_workspace_id and archived_at is null;
    if v_event_id is null then raise exception using errcode = '23514', message = 'PTA_EVENT_NOT_ACTIVE'; end if;
  else
    raise exception using errcode = '22023', message = 'PTA_CONTEXT_INVALID';
  end if;
  select coalesce(p_status_id, (select id from public.task_statuses where workspace_id = p_workspace_id and is_default and is_active order by position limit 1)) into v_status_id;
  if v_status_id is null then raise exception using errcode = '23514', message = 'PTA_DEFAULT_STATUS_REQUIRED'; end if;
  if not exists (
    select 1 from public.task_statuses
    where id = v_status_id and workspace_id = p_workspace_id and is_active
  ) then raise exception using errcode = '23514', message = 'PTA_STATUS_NOT_ACTIVE'; end if;
  if p_primary_assignee_id is not null then
    if v_role = 'member' and p_primary_assignee_id <> v_actor then raise exception using errcode = '42501', message = 'PTA_FORBIDDEN'; end if;
    if not exists (
      select 1 from public.workspace_members wm
      join public.profiles profile on profile.id = wm.user_id and profile.is_active
      where wm.workspace_id = p_workspace_id
        and wm.user_id = p_primary_assignee_id
        and wm.status = 'active'
        and wm.role <> 'viewer'
    ) then raise exception using errcode = '23514', message = 'PTA_ASSIGNEE_NOT_ACTIVE_MEMBER'; end if;
  end if;
  insert into public.tasks (workspace_id, title, status_id, priority, product_id, event_id, due_date, created_by, updated_by)
  values (p_workspace_id, p_title, v_status_id, p_priority, v_product_id, v_event_id, p_due_date, v_actor, v_actor)
  returning * into v_task;
  if p_primary_assignee_id is not null then
    insert into public.task_assignees (workspace_id, task_id, user_id, is_primary, assigned_by)
    values (p_workspace_id, v_task.id, p_primary_assignee_id, true, v_actor);
  end if;
  return jsonb_build_object('id', v_task.id, 'task_number', v_task.task_number, 'version', v_task.version);
end;
$$;

alter function private.portfolio_can_manage(uuid) owner to postgres;
alter function private.portfolio_member_is_active(uuid, uuid) owner to postgres;
alter function private.portfolio_slug(text, uuid) owner to postgres;
alter function private.event_health(text, date, date, integer, integer, integer, integer, date) owner to postgres;
alter function private.portfolio_members_valid(uuid, uuid[]) owner to postgres;
alter function private.products_before_write() owner to postgres;
alter function private.events_before_write() owner to postgres;
alter function private.event_milestones_before_write() owner to postgres;
alter function public.list_products_operational(uuid) owner to postgres;
alter function public.list_events_operational(uuid) owner to postgres;
alter function public.get_product_operational(uuid) owner to postgres;
alter function public.get_event_operational(uuid) owner to postgres;
alter function public.create_product_operational(uuid, text, uuid, text, text, uuid[]) owner to postgres;
alter function public.update_product_operational(uuid, integer, jsonb, uuid[]) owner to postgres;
alter function public.create_event_operational(uuid, text, uuid, uuid, text, date, date, text, text, text, uuid[]) owner to postgres;
alter function public.update_event_operational(uuid, integer, jsonb, uuid[]) owner to postgres;
alter function public.create_event_milestone(uuid, text, date, text) owner to postgres;
alter function public.toggle_event_milestone(uuid, integer, boolean) owner to postgres;
alter function public.create_context_task(uuid, text, uuid, text, uuid, public.task_priority, date, uuid) owner to postgres;

revoke all on function private.portfolio_can_manage(uuid) from public, anon, authenticated;
revoke all on function private.portfolio_member_is_active(uuid, uuid) from public, anon, authenticated;
revoke all on function private.portfolio_slug(text, uuid) from public, anon, authenticated;
revoke all on function private.event_health(text, date, date, integer, integer, integer, integer, date) from public, anon, authenticated;
revoke all on function private.portfolio_members_valid(uuid, uuid[]) from public, anon, authenticated;
revoke all on function private.products_before_write() from public, anon, authenticated;
revoke all on function private.events_before_write() from public, anon, authenticated;
revoke all on function private.event_milestones_before_write() from public, anon, authenticated;

revoke all on function public.list_products_operational(uuid) from public, anon, authenticated;
revoke all on function public.list_events_operational(uuid) from public, anon, authenticated;
revoke all on function public.get_product_operational(uuid) from public, anon, authenticated;
revoke all on function public.get_event_operational(uuid) from public, anon, authenticated;
revoke all on function public.create_product_operational(uuid, text, uuid, text, text, uuid[]) from public, anon, authenticated;
revoke all on function public.update_product_operational(uuid, integer, jsonb, uuid[]) from public, anon, authenticated;
revoke all on function public.create_event_operational(uuid, text, uuid, uuid, text, date, date, text, text, text, uuid[]) from public, anon, authenticated;
revoke all on function public.update_event_operational(uuid, integer, jsonb, uuid[]) from public, anon, authenticated;
revoke all on function public.create_event_milestone(uuid, text, date, text) from public, anon, authenticated;
revoke all on function public.toggle_event_milestone(uuid, integer, boolean) from public, anon, authenticated;
revoke all on function public.create_context_task(uuid, text, uuid, text, uuid, public.task_priority, date, uuid) from public, anon, authenticated;

grant execute on function public.list_products_operational(uuid) to authenticated;
grant execute on function public.list_events_operational(uuid) to authenticated;
grant execute on function public.get_product_operational(uuid) to authenticated;
grant execute on function public.get_event_operational(uuid) to authenticated;
grant execute on function public.create_product_operational(uuid, text, uuid, text, text, uuid[]) to authenticated;
grant execute on function public.update_product_operational(uuid, integer, jsonb, uuid[]) to authenticated;
grant execute on function public.create_event_operational(uuid, text, uuid, uuid, text, date, date, text, text, text, uuid[]) to authenticated;
grant execute on function public.update_event_operational(uuid, integer, jsonb, uuid[]) to authenticated;
grant execute on function public.create_event_milestone(uuid, text, date, text) to authenticated;
grant execute on function public.toggle_event_milestone(uuid, integer, boolean) to authenticated;
grant execute on function public.create_context_task(uuid, text, uuid, text, uuid, public.task_priority, date, uuid) to authenticated;

commit;
