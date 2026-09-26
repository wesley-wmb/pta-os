-- Small plain-text description excerpt for operational cards.
-- The full rich-text document remains available only in task detail.

begin;

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
  ) as description_preview
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

comment on view public.v_task_overview is
  'RLS-aware task overview with context, card metrics, and a compact description excerpt.';

alter view public.v_task_overview owner to postgres;
revoke all on table public.v_task_overview from public, anon, authenticated;
grant select on table public.v_task_overview to authenticated;

commit;
