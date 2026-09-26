create or replace view public.v_task_overview with (security_invoker = true) as
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
  p.full_name as primary_assignee_name,
  t.due_at
from public.tasks t
join public.workspaces w on w.id = t.workspace_id
join public.task_statuses ts
  on ts.workspace_id = t.workspace_id
  and ts.id = t.status_id
left join public.task_assignees ta
  on ta.workspace_id = t.workspace_id
  and ta.task_id = t.id
  and ta.is_primary
left join public.profiles p on p.id = ta.user_id
where t.archived_at is null;

comment on view public.v_task_overview is
  'Authenticated task overview with normalized due_at for exact overdue calculations.';
