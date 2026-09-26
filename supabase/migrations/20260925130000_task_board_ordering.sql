-- Persistent manual ordering for the status Kanban.
-- Board ordering is independent from the weekly planning position.

begin;

alter table public.tasks
  add column if not exists board_position numeric(20, 10);

with ranked as (
  select
    task.id,
    row_number() over (
      partition by task.workspace_id, task.status_id
      order by task.updated_at, task.task_number, task.id
    ) * 1000 as position
  from public.tasks task
)
update public.tasks task
set board_position = ranked.position
from ranked
where ranked.id = task.id
  and task.board_position is null;

alter table public.tasks
  alter column board_position set default 1000,
  alter column board_position set not null;

alter table public.tasks
  drop constraint if exists tasks_board_position_valid;
alter table public.tasks
  add constraint tasks_board_position_valid check (board_position >= 0);

create index if not exists tasks_workspace_status_board_position_idx
  on public.tasks (workspace_id, status_id, board_position, task_number)
  where archived_at is null;

create or replace function public.move_task_in_board(
  p_workspace_id uuid,
  p_task_id uuid,
  p_status_id uuid,
  p_before_task_id uuid,
  p_after_task_id uuid,
  p_expected_version integer,
  p_blocked_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_task public.tasks%rowtype;
  v_status_category public.task_status_category;
  v_before_position numeric(20, 10);
  v_after_position numeric(20, 10);
  v_position numeric(20, 10);
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_workspace_id::text, 713421)
  );

  select task.* into v_task
  from public.tasks task
  where task.workspace_id = p_workspace_id
    and task.id = p_task_id
    and task.archived_at is null
  for update;

  if not found or not private.can_edit_task(p_task_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if v_task.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;
  if p_before_task_id = p_task_id or p_after_task_id = p_task_id
     or (p_before_task_id is not null and p_before_task_id = p_after_task_id) then
    raise exception using errcode = '22023', message = 'PTA_BOARD_NEIGHBOR_INVALID';
  end if;

  select status.system_category into v_status_category
  from public.task_statuses status
  where status.workspace_id = p_workspace_id
    and status.id = p_status_id
    and status.is_active
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'PTA_INVALID_TASK_STATUS';
  end if;

  -- Serialize moves into the destination column. This makes fractional ranks
  -- deterministic and lets the rare rebalance remain atomic.
  perform task.id
  from public.tasks task
  where task.workspace_id = p_workspace_id
    and task.status_id = p_status_id
    and task.archived_at is null
    and task.id <> p_task_id
  order by task.board_position, task.task_number, task.id
  for update;

  if p_before_task_id is not null then
    select task.board_position into v_before_position
    from public.tasks task
    where task.workspace_id = p_workspace_id
      and task.status_id = p_status_id
      and task.id = p_before_task_id
      and task.archived_at is null;
    if not found then
      raise exception using errcode = '40001', message = 'PTA_BOARD_ORDER_CONFLICT';
    end if;
  end if;

  if p_after_task_id is not null then
    select task.board_position into v_after_position
    from public.tasks task
    where task.workspace_id = p_workspace_id
      and task.status_id = p_status_id
      and task.id = p_after_task_id
      and task.archived_at is null;
    if not found then
      raise exception using errcode = '40001', message = 'PTA_BOARD_ORDER_CONFLICT';
    end if;
  end if;

  if v_before_position is not null and v_after_position is not null
     and (
       v_before_position > v_after_position
       or exists (
         select 1
         from public.tasks task
         where task.workspace_id = p_workspace_id
           and task.status_id = p_status_id
           and task.archived_at is null
           and task.id <> p_task_id
           and task.id not in (p_before_task_id, p_after_task_id)
           and task.board_position >= v_before_position
           and task.board_position <= v_after_position
       )
     ) then
    raise exception using errcode = '40001', message = 'PTA_BOARD_ORDER_CONFLICT';
  elsif v_before_position is null and v_after_position is not null
        and exists (
          select 1 from public.tasks task
          where task.workspace_id = p_workspace_id
            and task.status_id = p_status_id
            and task.archived_at is null
            and task.id <> p_task_id
            and task.id <> p_after_task_id
            and task.board_position <= v_after_position
        ) then
    raise exception using errcode = '40001', message = 'PTA_BOARD_ORDER_CONFLICT';
  elsif v_before_position is not null and v_after_position is null
        and exists (
          select 1 from public.tasks task
          where task.workspace_id = p_workspace_id
            and task.status_id = p_status_id
            and task.archived_at is null
            and task.id <> p_task_id
            and task.id <> p_before_task_id
            and task.board_position >= v_before_position
        ) then
    raise exception using errcode = '40001', message = 'PTA_BOARD_ORDER_CONFLICT';
  end if;

  if v_before_position is null and v_after_position is null then
    select coalesce(max(task.board_position), 0) + 1000 into v_position
    from public.tasks task
    where task.workspace_id = p_workspace_id
      and task.status_id = p_status_id
      and task.archived_at is null
      and task.id <> p_task_id;
  elsif v_before_position is null then
    v_position := v_after_position / 2;
  elsif v_after_position is null then
    v_position := v_before_position + 1000;
  else
    v_position := v_before_position + ((v_after_position - v_before_position) / 2);
  end if;

  if v_position < 0
     or v_position = v_before_position
     or v_position = v_after_position then
    with ranked as (
      select
        task.id,
        row_number() over (
          order by task.board_position, task.task_number, task.id
        ) * 1000 as position
      from public.tasks task
      where task.workspace_id = p_workspace_id
        and task.status_id = p_status_id
        and task.archived_at is null
        and task.id <> p_task_id
    )
    update public.tasks task
    set board_position = ranked.position,
        updated_by = v_actor
    from ranked
    where task.id = ranked.id
      and task.board_position is distinct from ranked.position;

    select task.board_position into v_before_position
    from public.tasks task where task.id = p_before_task_id;
    select task.board_position into v_after_position
    from public.tasks task where task.id = p_after_task_id;

    if v_before_position is null and v_after_position is null then
      v_position := 1000;
    elsif v_before_position is null then
      v_position := v_after_position / 2;
    elsif v_after_position is null then
      v_position := v_before_position + 1000;
    else
      v_position := v_before_position + ((v_after_position - v_before_position) / 2);
    end if;
  end if;

  if v_status_category = 'blocked'
     and nullif(btrim(coalesce(p_blocked_reason, v_task.blocked_reason)), '') is null then
    raise exception using errcode = '23514', message = 'PTA_BLOCKED_REASON_REQUIRED';
  end if;

  update public.tasks task
  set
    status_id = p_status_id,
    board_position = v_position,
    blocked_reason = case
      when v_status_category = 'blocked'
        then nullif(btrim(coalesce(p_blocked_reason, v_task.blocked_reason)), '')
      else null
    end,
    updated_by = v_actor
  where task.workspace_id = p_workspace_id
    and task.id = p_task_id
    and task.version = p_expected_version
  returning * into v_task;

  if not found then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  return jsonb_build_object(
    'id', v_task.id,
    'workspace_id', v_task.workspace_id,
    'status_id', v_task.status_id,
    'board_position', v_task.board_position,
    'version', v_task.version,
    'updated_at', v_task.updated_at
  );
end;
$$;

revoke all on function public.move_task_in_board(
  uuid, uuid, uuid, uuid, uuid, integer, text
) from public, anon;
grant execute on function public.move_task_in_board(
  uuid, uuid, uuid, uuid, uuid, integer, text
) to authenticated;

create or replace view public.v_task_overview
with (security_invoker = true)
as
select
  task.id,
  task.workspace_id,
  workspace.task_prefix || '-' || lpad(task.task_number::text, 6, '0') as task_key,
  task.task_number,
  task.title,
  task.priority,
  task.status_id,
  task_status.name as status_name,
  task_status.system_category as status_category,
  task_status.color as status_color,
  task.due_date,
  task.due_time,
  task.due_is_date_only,
  task.week_position,
  task.version,
  task.created_by,
  task.created_at,
  task.updated_at,
  primary_assignee.user_id as primary_assignee_id,
  assignee_profile.full_name as primary_assignee_name,
  task.due_at,
  task.type_id,
  task_type.name as type_name,
  task.product_id,
  product.name as product_name,
  task.event_id,
  event.name as event_name,
  (
    select count(*)::integer
    from public.task_checklist_items checklist_item
    where checklist_item.workspace_id = task.workspace_id
      and checklist_item.task_id = task.id
  ) as checklist_total,
  (
    select count(*)::integer
    from public.task_checklist_items checklist_item
    where checklist_item.workspace_id = task.workspace_id
      and checklist_item.task_id = task.id
      and checklist_item.is_completed
  ) as checklist_completed,
  (
    select count(*)::integer
    from public.task_comments task_comment
    where task_comment.workspace_id = task.workspace_id
      and task_comment.task_id = task.id
      and task_comment.deleted_at is null
  ) as comment_count,
  nullif(
    left(
      coalesce(
        (
          select string_agg(description_node.value #>> '{}', ' ' order by description_node.ordinality)
          from jsonb_path_query(task.description_json, 'strict $.**.text')
            with ordinality as description_node(value, ordinality)
          where jsonb_typeof(description_node.value) = 'string'
        ),
        ''
      ),
      240
    ),
    ''
  ) as description_preview,
  task.week_lane,
  task.board_position
from public.tasks task
join public.workspaces workspace
  on workspace.id = task.workspace_id
join public.task_statuses task_status
  on task_status.workspace_id = task.workspace_id
  and task_status.id = task.status_id
left join public.task_assignees primary_assignee
  on primary_assignee.workspace_id = task.workspace_id
  and primary_assignee.task_id = task.id
  and primary_assignee.is_primary
left join public.profiles assignee_profile
  on assignee_profile.id = primary_assignee.user_id
left join public.task_types task_type
  on task_type.workspace_id = task.workspace_id
  and task_type.id = task.type_id
left join public.products product
  on product.workspace_id = task.workspace_id
  and product.id = task.product_id
left join public.events event
  on event.workspace_id = task.workspace_id
  and event.id = task.event_id
where task.archived_at is null;

comment on column public.tasks.board_position is
  'Persistent manual position inside status Kanban columns; independent from week_position.';
comment on function public.move_task_in_board(uuid, uuid, uuid, uuid, uuid, integer, text) is
  'Moves and orders one task in the status Kanban with membership checks, optimistic concurrency, and atomic rank rebalance.';
comment on view public.v_task_overview is
  'RLS-aware task overview with context, card metrics, weekly placement, and Kanban position.';

alter function public.move_task_in_board(uuid, uuid, uuid, uuid, uuid, integer, text)
  owner to postgres;
alter view public.v_task_overview owner to postgres;
revoke all on table public.v_task_overview from public, anon, authenticated;
grant select on table public.v_task_overview to authenticated;

commit;
