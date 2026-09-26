-- End-to-end context for global task creation and overview reads.

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
  event.name as event_name
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
  'RLS-aware task overview with status, assignee, type, product, event and normalized due context.';

alter view public.v_task_overview owner to postgres;
revoke all on table public.v_task_overview from public, anon, authenticated;
grant select on table public.v_task_overview to authenticated;

create or replace function public.create_global_task(
  p_workspace_id uuid,
  p_title text,
  p_status_id uuid default null,
  p_priority public.task_priority default 'medium',
  p_due_date date default null,
  p_due_time time without time zone default null,
  p_primary_assignee_id uuid default null,
  p_type_id uuid default null,
  p_product_id uuid default null,
  p_event_id uuid default null,
  p_description jsonb default null,
  p_blocked_reason text default null
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
  v_status_category public.task_status_category;
  v_type_id uuid;
  v_product_id uuid;
  v_event_id uuid;
  v_event_product_id uuid;
  v_description_json jsonb := coalesce(
    p_description,
    jsonb_build_object('type', 'doc', 'content', jsonb_build_array())
  );
  v_task public.tasks%rowtype;
begin
  v_role := private.current_workspace_role(p_workspace_id);
  if v_actor is null
     or v_role is null
     or v_role not in (
       'owner'::public.workspace_role,
       'admin'::public.workspace_role,
       'manager'::public.workspace_role,
       'member'::public.workspace_role
     ) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;

  if p_title is null or char_length(btrim(p_title)) not between 3 and 180 then
    raise exception using errcode = '22023', message = 'PTA_TASK_TITLE_INVALID';
  end if;

  if p_due_time is not null and p_due_date is null then
    raise exception using errcode = '22023', message = 'PTA_DUE_DATE_REQUIRED_FOR_TIME';
  end if;

  if p_status_id is null then
    select status.id, status.system_category
    into v_status_id, v_status_category
    from public.task_statuses status
    where status.workspace_id = p_workspace_id
      and status.is_default
      and status.is_active
    order by status.position, status.id
    limit 1;

    if v_status_id is null then
      raise exception using errcode = '23514', message = 'PTA_DEFAULT_STATUS_REQUIRED';
    end if;
  else
    select status.id, status.system_category
    into v_status_id, v_status_category
    from public.task_statuses status
    where status.workspace_id = p_workspace_id
      and status.id = p_status_id
      and status.is_active;

    if v_status_id is null then
      raise exception using errcode = '23514', message = 'PTA_STATUS_NOT_ACTIVE';
    end if;
  end if;

  if v_status_category = 'blocked'::public.task_status_category then
    if nullif(btrim(p_blocked_reason), '') is null then
      raise exception using errcode = '23514', message = 'PTA_BLOCKED_REASON_REQUIRED';
    end if;
    if char_length(btrim(p_blocked_reason)) > 1000 then
      raise exception using errcode = '22023', message = 'PTA_BLOCKED_REASON_TOO_LONG';
    end if;
  end if;

  if p_type_id is not null then
    select task_type.id
    into v_type_id
    from public.task_types task_type
    where task_type.workspace_id = p_workspace_id
      and task_type.id = p_type_id
      and task_type.is_active;

    if v_type_id is null then
      raise exception using errcode = '23514', message = 'PTA_TYPE_NOT_ACTIVE';
    end if;
  end if;

  if p_product_id is not null then
    select product.id
    into v_product_id
    from public.products product
    where product.workspace_id = p_workspace_id
      and product.id = p_product_id
      and product.archived_at is null;

    if v_product_id is null then
      raise exception using errcode = '23514', message = 'PTA_PRODUCT_NOT_ACTIVE';
    end if;
  end if;

  if p_event_id is not null then
    select event.id, event.product_id
    into v_event_id, v_event_product_id
    from public.events event
    where event.workspace_id = p_workspace_id
      and event.id = p_event_id
      and event.archived_at is null;

    if v_event_id is null then
      raise exception using errcode = '23514', message = 'PTA_EVENT_NOT_ACTIVE';
    end if;

    if v_event_product_id is not null then
      if v_product_id is null then
        v_product_id := v_event_product_id;
      elsif v_product_id <> v_event_product_id then
        raise exception using errcode = '23514', message = 'PTA_EVENT_PRODUCT_MISMATCH';
      end if;
    end if;
  end if;

  if v_product_id is not null and not exists (
    select 1
    from public.products product
    where product.workspace_id = p_workspace_id
      and product.id = v_product_id
      and product.archived_at is null
  ) then
    raise exception using errcode = '23514', message = 'PTA_PRODUCT_NOT_ACTIVE';
  end if;

  if p_primary_assignee_id is not null then
    if v_role = 'member'::public.workspace_role
       and p_primary_assignee_id <> v_actor then
      raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
    end if;

    if not exists (
      select 1
      from public.workspace_members member
      join public.profiles profile
        on profile.id = member.user_id
        and profile.is_active
      where member.workspace_id = p_workspace_id
        and member.user_id = p_primary_assignee_id
        and member.status = 'active'
        and member.role <> 'viewer'::public.workspace_role
    ) then
      raise exception using errcode = '23514', message = 'PTA_ASSIGNEE_NOT_ACTIVE_MEMBER';
    end if;
  end if;

  if not private.is_valid_task_description(v_description_json) then
    raise exception using errcode = '22023', message = 'PTA_INVALID_TASK_DESCRIPTION';
  end if;

  if octet_length(v_description_json::text) > 256000 then
    raise exception using errcode = '22023', message = 'PTA_DESCRIPTION_TOO_LARGE';
  end if;

  insert into public.tasks (
    workspace_id,
    title,
    description_json,
    status_id,
    type_id,
    priority,
    product_id,
    event_id,
    due_date,
    due_time,
    blocked_reason,
    created_by,
    updated_by
  ) values (
    p_workspace_id,
    btrim(p_title),
    v_description_json,
    v_status_id,
    v_type_id,
    coalesce(p_priority, 'medium'::public.task_priority),
    v_product_id,
    v_event_id,
    p_due_date,
    p_due_time,
    case
      when v_status_category = 'blocked'::public.task_status_category
        then btrim(p_blocked_reason)
      else null
    end,
    v_actor,
    v_actor
  )
  returning * into v_task;

  if p_primary_assignee_id is not null then
    insert into public.task_assignees (
      workspace_id,
      task_id,
      user_id,
      is_primary,
      assigned_by
    ) values (
      p_workspace_id,
      v_task.id,
      p_primary_assignee_id,
      true,
      v_actor
    );
  end if;

  return jsonb_build_object(
    'id', v_task.id,
    'task_number', v_task.task_number,
    'version', v_task.version,
    'status_id', v_task.status_id,
    'priority', v_task.priority,
    'due_date', v_task.due_date,
    'due_time', v_task.due_time,
    'primary_assignee_id', p_primary_assignee_id,
    'type_id', v_task.type_id,
    'product_id', v_task.product_id,
    'event_id', v_task.event_id
  );
end;
$$;

comment on function public.create_global_task(
  uuid,
  text,
  uuid,
  public.task_priority,
  date,
  time without time zone,
  uuid,
  uuid,
  uuid,
  uuid,
  jsonb,
  text
) is
  'Creates one workspace-scoped task with validated status, assignee, type, product, event and safe structured description.';

alter function public.create_global_task(
  uuid,
  text,
  uuid,
  public.task_priority,
  date,
  time without time zone,
  uuid,
  uuid,
  uuid,
  uuid,
  jsonb,
  text
) owner to postgres;

revoke all on function public.create_global_task(
  uuid,
  text,
  uuid,
  public.task_priority,
  date,
  time without time zone,
  uuid,
  uuid,
  uuid,
  uuid,
  jsonb,
  text
) from public, anon, authenticated;

grant execute on function public.create_global_task(
  uuid,
  text,
  uuid,
  public.task_priority,
  date,
  time without time zone,
  uuid,
  uuid,
  uuid,
  uuid,
  jsonb,
  text
) to authenticated;

commit;
