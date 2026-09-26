-- Persistent operational lanes for the weekly board.
-- Tasks remain the central entity; the lane only controls weekly placement.

begin;

alter table public.tasks
  add column if not exists week_lane text;

update public.tasks
set week_lane = case
  when due_date is null then 'backlog'
  else 'scheduled'
end
where week_lane is null;

alter table public.tasks
  alter column week_lane set default 'scheduled',
  alter column week_lane set not null;

alter table public.tasks
  drop constraint if exists tasks_week_lane_valid;

alter table public.tasks
  add constraint tasks_week_lane_valid check (
    week_lane in (
      'backlog',
      'emergency',
      'important',
      'scheduled',
      'delivered',
      'revision',
      'ideas',
      'discarded'
    )
  );

create index if not exists tasks_workspace_week_lane_position_idx
  on public.tasks (workspace_id, week_lane, week_position)
  where archived_at is null;

create or replace function public.move_task_in_week(
  p_task_id uuid,
  p_week_lane text,
  p_due_date date,
  p_position numeric,
  p_expected_version integer
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

  if p_week_lane not in (
    'backlog',
    'emergency',
    'important',
    'scheduled',
    'delivered',
    'revision',
    'ideas',
    'discarded'
  ) then
    raise exception using errcode = '22023', message = 'PTA_WEEK_LANE_INVALID';
  end if;

  if p_week_lane = 'scheduled' and p_due_date is null then
    raise exception using errcode = '22023', message = 'PTA_WEEK_DATE_REQUIRED';
  end if;

  if p_position is null or p_position < 0 then
    raise exception using errcode = '22023', message = 'PTA_WEEK_POSITION_INVALID';
  end if;

  update public.tasks task
  set
    week_lane = p_week_lane,
    due_date = case
      when p_week_lane = 'scheduled' then p_due_date
      when p_week_lane = 'backlog' then null
      else task.due_date
    end,
    due_time = case
      when p_week_lane = 'backlog' then null
      else task.due_time
    end,
    week_position = p_position,
    updated_by = v_actor
  where task.id = p_task_id
    and task.version = p_expected_version
  returning * into v_task;

  if not found then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  return jsonb_build_object(
    'id', v_task.id,
    'version', v_task.version,
    'week_lane', v_task.week_lane,
    'due_date', v_task.due_date,
    'week_position', v_task.week_position,
    'updated_at', v_task.updated_at
  );
end;
$$;

revoke all on function public.move_task_in_week(uuid, text, date, numeric, integer)
  from public, anon;
grant execute on function public.move_task_in_week(uuid, text, date, numeric, integer)
  to authenticated;

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
  task.week_lane
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

comment on column public.tasks.week_lane is
  'Persistent operational placement in the weekly board. Scheduled tasks use due_date for the weekday lane.';

comment on function public.move_task_in_week(uuid, text, date, numeric, integer) is
  'Moves a task between weekly operational lanes with optimistic concurrency.';

comment on view public.v_task_overview is
  'RLS-aware task overview with context, card metrics, description excerpt, and weekly operational placement.';

alter view public.v_task_overview owner to postgres;
revoke all on table public.v_task_overview from public, anon, authenticated;
grant select on table public.v_task_overview to authenticated;

commit;
