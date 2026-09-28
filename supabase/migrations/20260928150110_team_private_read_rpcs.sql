-- Read RPCs run as owner: filter before aggregation/pagination, independently of RLS.
-- Requires member-only private.can_read_task / private.can_read_event helpers.
begin;

CREATE OR REPLACE FUNCTION public.get_event_operational(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  select * into v_event from (select * from public.events where private.can_read_event(id)) visible_event where id = p_event_id and archived_at is null;
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
  from (select * from public.tasks where private.can_read_task(id)) task
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
      from (select * from public.tasks where private.can_read_task(id)) task
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
            select 1 from (select * from public.tasks where private.can_read_task(id)) related_task
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
$function$;

CREATE OR REPLACE FUNCTION public.get_product_operational(p_product_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      from (select * from public.events where private.can_read_event(id)) event
      left join public.profiles owner_profile on owner_profile.id = event.owner_id
      where event.product_id = v_product.id and event.archived_at is null), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object(
      'id', task.id, 'task_number', task.task_number, 'title', task.title,
      'priority', task.priority, 'due_date', task.due_date,
      'status_name', status.name, 'status_category', status.system_category,
      'assignee_name', assignee_profile.full_name
    ) order by task.updated_at desc)
      from (select * from public.tasks where private.can_read_task(id)) task
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
            select 1 from (select * from public.events where private.can_read_event(id)) related_event
            where related_event.id = log.entity_id and related_event.product_id = v_product.id
          ))
          or (log.entity_type = 'task' and exists (
            select 1 from (select * from public.tasks where private.can_read_task(id)) related_task
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
$function$;

CREATE OR REPLACE FUNCTION public.get_project_timeline(p_workspace_id uuid, p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role public.workspace_role;
begin
  v_role := private.current_workspace_role(p_workspace_id);
  if auth.uid() is null or v_role is null then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if not exists (
    select 1 from (select * from public.events where private.can_read_event(id)) event
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
      from (select * from public.tasks where private.can_read_task(id)) task
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
$function$;

CREATE OR REPLACE FUNCTION public.get_resource_detail(p_resource_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_resource public.resources%rowtype;
  v_role public.workspace_role;
  v_result jsonb;
begin
  if p_resource_id is null or not private.can_view_resource(p_resource_id) then
    raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_NOT_FOUND';
  end if;

  select * into v_resource from public.resources where id = p_resource_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_NOT_FOUND';
  end if;

  v_role := private.current_workspace_role(v_resource.workspace_id);

  select jsonb_build_object(
    'resource', jsonb_build_object(
      'id', v_resource.id,
      'workspace_id', v_resource.workspace_id,
      'title', v_resource.title,
      'description', v_resource.description,
      'resource_type', v_resource.resource_type,
      'external_url', v_resource.external_url,
      'is_restricted', v_resource.is_restricted,
      'version', v_resource.version,
      'created_by', v_resource.created_by,
      'created_at', v_resource.created_at,
      'updated_at', v_resource.updated_at,
      'archived_at', v_resource.archived_at,
      'category', (
        select jsonb_build_object('id', rc.id, 'name', rc.name, 'color', rc.color)
        from public.resource_categories rc
        where rc.workspace_id = v_resource.workspace_id and rc.id = v_resource.category_id
      ),
      'is_favorite', exists (
        select 1 from public.resource_favorites favorite
        where favorite.workspace_id = v_resource.workspace_id
          and favorite.resource_id = v_resource.id
          and favorite.user_id = (select auth.uid())
      ),
      'last_visited_at', (
        select visit.last_visited_at from public.resource_visits visit
        where visit.workspace_id = v_resource.workspace_id
          and visit.resource_id = v_resource.id
          and visit.user_id = (select auth.uid())
      )
    ),
    'relations', jsonb_build_object(
      'tasks', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', task.id,
          'task_key', workspace.task_prefix || '-' || lpad(task.task_number::text, 6, '0'),
          'title', task.title
        ) order by task.task_number)
        from public.resource_tasks relation
        join (select * from public.tasks where private.can_read_task(id)) task
          on task.workspace_id = relation.workspace_id and task.id = relation.task_id
        join public.workspaces workspace on workspace.id = task.workspace_id
        where relation.workspace_id = v_resource.workspace_id
          and relation.resource_id = v_resource.id
      ), '[]'::jsonb),
      'products', coalesce((
        select jsonb_agg(jsonb_build_object('id', product.id, 'name', product.name) order by product.name)
        from public.resource_products relation
        join public.products product
          on product.workspace_id = relation.workspace_id and product.id = relation.product_id
        where relation.workspace_id = v_resource.workspace_id
          and relation.resource_id = v_resource.id
      ), '[]'::jsonb),
      'events', coalesce((
        select jsonb_agg(jsonb_build_object('id', event.id, 'name', event.name) order by event.name)
        from public.resource_events relation
        join (select * from public.events where private.can_read_event(id)) event
          on event.workspace_id = relation.workspace_id and event.id = relation.event_id
        where relation.workspace_id = v_resource.workspace_id
          and relation.resource_id = v_resource.id
      ), '[]'::jsonb),
      'tags', coalesce((
        select jsonb_agg(jsonb_build_object('id', tag.id, 'name', tag.name, 'color', tag.color) order by tag.name)
        from public.resource_tags relation
        join public.tags tag
          on tag.workspace_id = relation.workspace_id and tag.id = relation.tag_id
        where relation.workspace_id = v_resource.workspace_id
          and relation.resource_id = v_resource.id
      ), '[]'::jsonb)
    ),
    'permissions', case
      when v_role in ('owner'::public.workspace_role, 'admin'::public.workspace_role) then coalesce((
        select jsonb_agg(jsonb_build_object(
          'user_id', permission.user_id,
          'full_name', profile.full_name,
          'permission', permission.permission
        ) order by profile.full_name)
        from public.resource_permissions permission
        join public.profiles profile on profile.id = permission.user_id
        where permission.workspace_id = v_resource.workspace_id
          and permission.resource_id = v_resource.id
      ), '[]'::jsonb)
      else '[]'::jsonb
    end,
    'capabilities', jsonb_build_object(
      'can_edit', private.can_edit_resource(v_resource.id),
      'can_manage_permissions', v_role in (
        'owner'::public.workspace_role,
        'admin'::public.workspace_role
      ),
      'can_archive', private.can_edit_resource(v_resource.id)
    )
  ) into v_result;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_task_detail(p_task_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_workspace_id uuid;
  v_role public.workspace_role;
  v_task jsonb;
  v_activity jsonb;
  v_collaboration jsonb;
  v_custom_fields jsonb;
  v_subtasks jsonb;
  v_parent_task jsonb;
  v_can_edit boolean;
  v_can_collaborate boolean;
begin
  select task.workspace_id into v_workspace_id
  from (select * from public.tasks where private.can_read_task(id)) task
  where task.id = p_task_id and task.archived_at is null;

  if v_workspace_id is null or not private.is_active_workspace_member(v_workspace_id) then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;

  select to_jsonb(overview) || jsonb_build_object(
    'description_json', task.description_json,
    'requester_id', coalesce(task.requester_id, task.created_by),
    'requester_name', requester.full_name
  ) into v_task
  from (select * from public.v_task_overview where private.can_read_task(id)) overview
  join (select * from public.tasks where private.can_read_task(id)) task on task.workspace_id = overview.workspace_id and task.id = overview.id
  left join public.profiles requester on requester.id = coalesce(task.requester_id, task.created_by)
  where overview.id = p_task_id;

  if v_task is null then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', field.id,
    'name', field.name,
    'type', field.field_type,
    'position', field.position,
    'version', field.version,
    'options', coalesce(options.items, '[]'::jsonb),
    'value', case field.field_type
      when 'text' then to_jsonb(value.text_value)
      when 'number' then to_jsonb(value.number_value)
      when 'date' then to_jsonb(value.date_value)
      when 'boolean' then to_jsonb(value.boolean_value)
      when 'single_select' then to_jsonb(value.option_id)
    end
  ) order by field.position, field.id), '[]'::jsonb)
  into v_custom_fields
  from public.task_custom_field_definitions field
  left join public.task_custom_field_values value
    on value.workspace_id = field.workspace_id and value.field_id = field.id and value.task_id = p_task_id
  left join lateral (
    select jsonb_agg(jsonb_build_object('id', option.id, 'label', option.label)
      order by option.position, option.id) as items
    from public.task_custom_field_options option
    where option.workspace_id = field.workspace_id
      and option.field_id = field.id
      and option.archived_at is null
  ) options on true
  where field.workspace_id = v_workspace_id and field.archived_at is null;

  select coalesce(jsonb_agg(to_jsonb(child) order by relation.created_at, child.id), '[]'::jsonb)
  into v_subtasks
  from public.task_subtasks relation
  join (select * from public.v_task_overview where private.can_read_task(id)) child
    on child.workspace_id = relation.workspace_id and child.id = relation.child_task_id
  where relation.workspace_id = v_workspace_id and relation.parent_task_id = p_task_id;

  select to_jsonb(parent)
  into v_parent_task
  from public.task_subtasks relation
  join (select * from public.v_task_overview where private.can_read_task(id)) parent
    on parent.workspace_id = relation.workspace_id and parent.id = relation.parent_task_id
  where relation.workspace_id = v_workspace_id and relation.child_task_id = p_task_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', activity.id,
    'actor_id', activity.actor_id,
    'action', activity.action,
    'changes_json', activity.changes_json,
    'metadata_json', activity.metadata_json,
    'created_at', activity.created_at
  ) order by activity.created_at desc, activity.id desc), '[]'::jsonb)
  into v_activity
  from (
    select id, actor_id, action, changes_json, metadata_json, created_at
    from public.activity_logs
    where workspace_id = v_workspace_id and entity_type = 'task' and entity_id = p_task_id
    order by created_at desc, id desc limit 50
  ) activity;

  v_role := private.task_collaboration_role(p_task_id);
  v_can_edit := private.can_edit_task(p_task_id);
  v_can_collaborate := v_role in ('owner', 'admin', 'manager', 'member');
  v_collaboration := private.task_collaboration_payload(p_task_id);

  return jsonb_build_object(
    'task', v_task,
    'activity', v_activity,
    'collaboration', v_collaboration,
    'custom_fields', v_custom_fields,
    'subtasks', v_subtasks,
    'parent_task', v_parent_task,
    'capabilities', jsonb_build_object(
      'can_edit', v_can_edit,
      'can_manage_assignees', v_role in ('owner', 'admin', 'manager'),
      'can_manage_custom_fields', v_role in ('owner', 'admin', 'manager'),
      'can_edit_custom_field_values', v_can_edit,
      'can_edit_description', v_can_edit,
      'can_manage_checklist_structure', v_can_edit,
      'can_toggle_checklist', v_can_collaborate,
      'can_comment', v_can_collaborate,
      'can_add_link', v_can_collaborate,
      'can_remove_any_link', v_role in ('owner', 'admin', 'manager'),
      'can_create_subtask', v_can_edit and v_can_collaborate,
      'can_manage_task_steps',
        to_regprocedure('public.remove_task_checklist_item(uuid,timestamp with time zone)') is not null
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_events_operational(p_workspace_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    left join (select * from public.tasks where private.can_read_task(id)) task on task.event_id = event.id and task.workspace_id = event.workspace_id and task.archived_at is null
    left join public.task_statuses status on status.id = task.status_id and status.workspace_id = task.workspace_id
    where event.workspace_id = p_workspace_id and event.archived_at is null
      and private.can_read_event(event.id)
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
$function$;

CREATE OR REPLACE FUNCTION public.list_products_operational(p_workspace_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      'event_count', (select count(*) from (select * from public.events where private.can_read_event(id)) event where event.product_id = product.id and event.archived_at is null),
      'upcoming_event_count', (select count(*) from (select * from public.events where private.can_read_event(id)) event where event.product_id = product.id and event.archived_at is null and event.end_date >= v_today),
      'task_count', (select count(*) from (select * from public.tasks where private.can_read_task(id)) task join public.task_statuses status on status.id = task.status_id and status.workspace_id = task.workspace_id where task.product_id = product.id and task.archived_at is null and status.system_category <> 'cancelled'),
      'open_task_count', (select count(*) from (select * from public.tasks where private.can_read_task(id)) task join public.task_statuses status on status.id = task.status_id and status.workspace_id = task.workspace_id where task.product_id = product.id and task.archived_at is null and status.system_category not in ('done', 'cancelled')),
      'overdue_task_count', (select count(*) from (select * from public.tasks where private.can_read_task(id)) task join public.task_statuses status on status.id = task.status_id and status.workspace_id = task.workspace_id where task.product_id = product.id and task.archived_at is null and status.system_category not in ('done', 'cancelled') and task.due_at < now()),
      'resource_count', (select count(*) from public.resource_products relation join public.resources resource on resource.id = relation.resource_id and resource.workspace_id = relation.workspace_id where relation.product_id = product.id and resource.archived_at is null and private.can_view_resource(resource.id)),
      'team_count', (select count(*) from public.product_members member where member.product_id = product.id),
      'health', case
        when exists (select 1 from (select * from public.tasks where private.can_read_task(id)) task join public.task_statuses status on status.id = task.status_id and status.workspace_id = task.workspace_id where task.product_id = product.id and task.archived_at is null and status.system_category not in ('done', 'cancelled') and task.due_at < now() and task.priority in ('high', 'urgent')) then 'risk'
        when exists (select 1 from (select * from public.tasks where private.can_read_task(id)) task join public.task_statuses status on status.id = task.status_id and status.workspace_id = task.workspace_id where task.product_id = product.id and task.archived_at is null and status.system_category not in ('done', 'cancelled') and task.due_at < now()) then 'attention'
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
$function$;

CREATE OR REPLACE FUNCTION public.list_task_activity(p_workspace_id uuid)
 RETURNS TABLE(activity_id uuid, actor_id uuid, actor_name text, task_id uuid, action text, created_at timestamp with time zone, subject_user_id uuid, subject_name text, task_number bigint, task_title text, task_archived boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_workspace_id is null
    or not private.is_active_workspace_member(p_workspace_id) then
    raise exception using
      errcode = 'P0002',
      message = 'PTA_WORKSPACE_NOT_FOUND';
  end if;

  return query
  select
    al.id as activity_id,
    al.actor_id,
    actor_profile.full_name as actor_name,
    al.entity_id as task_id,
    al.action,
    al.created_at,
    metadata.subject_user_id,
    subject_profile.full_name as subject_name,
    coalesce(task.task_number, metadata.task_number) as task_number,
    task.title as task_title,
    task.archived_at is not null as task_archived
  from public.activity_logs al
  left join (select * from public.tasks where private.can_read_task(id)) task
    on task.workspace_id = al.workspace_id
    and task.id = al.entity_id
  left join public.profiles actor_profile on actor_profile.id = al.actor_id
  left join lateral (
    select
      case
        when jsonb_typeof(al.metadata_json -> 'user_id') = 'string'
          and (al.metadata_json ->> 'user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (al.metadata_json ->> 'user_id')::uuid
        else null
      end as subject_user_id,
      case
        when jsonb_typeof(al.metadata_json -> 'task_number') = 'number'
          and (al.metadata_json ->> 'task_number') ~ '^[0-9]+$'
        then (al.metadata_json ->> 'task_number')::bigint
        else null
      end as task_number
  ) metadata on true
  left join public.profiles subject_profile
    on subject_profile.id = metadata.subject_user_id
  where al.workspace_id = p_workspace_id
    and al.entity_type = 'task'
    and private.can_read_task(al.entity_id)
  order by al.created_at desc, al.id desc
  limit 50;
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_task_attachments(p_task_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_role public.workspace_role;
  v_result jsonb;
begin
  if not private.can_read_task(p_task_id) then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;
  v_role := private.task_collaboration_role(p_task_id);
  if p_task_id is null or v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;

  select jsonb_build_object(
    'attachments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', attachment.id,
          'object_path', attachment.object_path,
          'file_name', attachment.file_name, 'description', attachment.description, 'version', attachment.version,
          'file_extension', attachment.file_extension,
          'mime_type', attachment.mime_type,
          'file_size', attachment.file_size,
          'uploaded_by', attachment.uploaded_by,
          'author_name', author.full_name,
          'state', attachment.state,
          'created_at', attachment.created_at,
          'ready_at', attachment.ready_at,
          'can_remove',
            v_role in (
              'owner'::public.workspace_role,
              'admin'::public.workspace_role,
              'manager'::public.workspace_role
            )
            or (
              v_role = 'member'::public.workspace_role
              and attachment.uploaded_by = v_actor
            )
        ) order by attachment.created_at, attachment.id
      )
      from public.task_attachments attachment
      left join public.profiles author on author.id = attachment.uploaded_by
      where attachment.task_id = p_task_id
        and attachment.deleted_at is null
        and (
          attachment.state = 'ready'::public.task_attachment_state
          or attachment.uploaded_by = v_actor
          or attachment.delete_requested_by = v_actor
          or v_role in (
            'owner'::public.workspace_role,
            'admin'::public.workspace_role,
            'manager'::public.workspace_role
          )
        )
    ), '[]'::jsonb),
    'capabilities', jsonb_build_object(
      'can_upload_attachment', v_role in (
        'owner'::public.workspace_role,
        'admin'::public.workspace_role,
        'manager'::public.workspace_role,
        'member'::public.workspace_role
      )
    )
  ) into v_result;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_task_comments(p_task_id uuid, p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_workspace_id uuid;
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 20));
  v_result jsonb;
begin
  if (p_cursor_created_at is null) <> (p_cursor_id is null) then
    raise exception using errcode = '22023', message = 'PTA_INVALID_COMMENT_CURSOR';
  end if;

  select task.workspace_id
  into v_workspace_id
  from (select * from public.tasks where private.can_read_task(id)) task
  where task.id = p_task_id
    and task.archived_at is null;

  v_role := private.task_collaboration_role(p_task_id);
  if v_workspace_id is null or v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;

  with page as (
    select
      task_comment.id,
      task_comment.parent_comment_id,
      task_comment.body,
      task_comment.created_by,
      comment_author.full_name as author_name,
      task_comment.created_at,
      task_comment.updated_at,
      task_comment.edited_at,
      task_comment.deleted_at,
      row_number() over (
        order by task_comment.created_at desc, task_comment.id desc
      ) as row_number
    from public.task_comments task_comment
    left join public.profiles comment_author
      on comment_author.id = task_comment.created_by
    where task_comment.workspace_id = v_workspace_id
      and task_comment.task_id = p_task_id
      and (
        p_cursor_created_at is null
        or (task_comment.created_at, task_comment.id)
          < (p_cursor_created_at, p_cursor_id)
      )
    order by task_comment.created_at desc, task_comment.id desc
    limit v_limit + 1
  ),
  visible as (
    select *
    from page
    where row_number <= v_limit
  ),
  last_visible as (
    select created_at, id
    from visible
    order by row_number desc
    limit 1
  )
  select jsonb_build_object(
    'comments', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', comment_row.id,
            'parent_comment_id', comment_row.parent_comment_id,
            'body', comment_row.body,
            'created_by', comment_row.created_by,
            'author_name', comment_row.author_name,
            'created_at', comment_row.created_at,
            'updated_at', comment_row.updated_at,
            'edited_at', comment_row.edited_at,
            'is_deleted', comment_row.deleted_at is not null,
            'deleted_at', comment_row.deleted_at,
            'can_edit_comment',
              comment_row.deleted_at is null
              and comment_row.created_by = v_actor
              and v_role in (
                'owner'::public.workspace_role,
                'admin'::public.workspace_role,
                'manager'::public.workspace_role,
                'member'::public.workspace_role
              ),
            'can_delete_comment',
              comment_row.deleted_at is null
              and (
                v_role in (
                  'owner'::public.workspace_role,
                  'admin'::public.workspace_role,
                  'manager'::public.workspace_role
                )
                or (
                  v_role = 'member'::public.workspace_role
                  and comment_row.created_by = v_actor
                )
              )
          ) order by comment_row.row_number desc
        )
        from visible comment_row
      ),
      '[]'::jsonb
    ),
    'has_more', (select count(*) > v_limit from page),
    'next_cursor', case
      when (select count(*) > v_limit from page) then (
        select jsonb_build_object(
          'created_at', cursor_row.created_at,
          'id', cursor_row.id
        )
        from last_visible cursor_row
      )
      else null
    end
  )
  into v_result;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.search_resource_relation_options(p_workspace_id uuid, p_entity_type text, p_query text DEFAULT NULL::text, p_limit integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_query text := nullif(btrim(p_query), '');
  v_normalized_query text;
  v_limit integer := coalesce(p_limit, 30);
  v_result jsonb;
begin
  if p_workspace_id is null
    or private.current_workspace_role(p_workspace_id) is null then
    raise exception using errcode = 'P0002', message = 'PTA_WORKSPACE_NOT_FOUND';
  end if;

  if p_entity_type is null
    or p_entity_type not in ('task', 'product', 'event', 'tag') then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_RELATION_TYPE';
  end if;

  if v_query is not null and char_length(v_query) > 100 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_SEARCH_QUERY';
  end if;

  if v_limit < 1 or v_limit > 50 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_RELATION_LIMIT';
  end if;

  v_normalized_query := lower(extensions.unaccent(coalesce(v_query, '')));

  if p_entity_type = 'task' then
    select coalesce(
      jsonb_agg(option - 'sort' order by option ->> 'sort' desc),
      '[]'::jsonb
    )
    into v_result
    from (
      select jsonb_build_object(
        'id', task.id,
        'label', task.title,
        'meta', workspace.task_prefix || '-' || lpad(task.task_number::text, 6, '0'),
        'color', null,
        'sort', lpad(task.task_number::text, 20, '0')
      ) as option
      from (select * from public.tasks where private.can_read_task(id)) task
      join public.workspaces workspace on workspace.id = task.workspace_id
      where task.workspace_id = p_workspace_id
        and task.archived_at is null
        and (
          v_query is null
          or lower(extensions.unaccent(task.title)) like '%' || v_normalized_query || '%'
          or lower(workspace.task_prefix || '-' || lpad(task.task_number::text, 6, '0')) like '%' || v_normalized_query || '%'
        )
      order by task.updated_at desc, task.id
      limit v_limit
    ) options;
  elsif p_entity_type = 'product' then
    select coalesce(jsonb_agg(option order by option ->> 'label'), '[]'::jsonb)
    into v_result
    from (
      select jsonb_build_object(
        'id', product.id,
        'label', product.name,
        'meta', null,
        'color', null
      ) as option
      from public.products product
      where product.workspace_id = p_workspace_id
        and product.archived_at is null
        and (
          v_query is null
          or lower(extensions.unaccent(product.name)) like '%' || v_normalized_query || '%'
        )
      order by product.name, product.id
      limit v_limit
    ) options;
  elsif p_entity_type = 'event' then
    select coalesce(jsonb_agg(option order by option ->> 'label'), '[]'::jsonb)
    into v_result
    from (
      select jsonb_build_object(
        'id', event.id,
        'label', event.name,
        'meta', case
          when event.start_date is null then null
          else to_char(event.start_date, 'DD/MM/YYYY')
        end,
        'color', null
      ) as option
      from (select * from public.events where private.can_read_event(id)) event
      where event.workspace_id = p_workspace_id
        and event.archived_at is null
        and (
          v_query is null
          or lower(extensions.unaccent(event.name)) like '%' || v_normalized_query || '%'
        )
      order by event.start_date desc nulls last, event.name, event.id
      limit v_limit
    ) options;
  else
    select coalesce(jsonb_agg(option order by option ->> 'label'), '[]'::jsonb)
    into v_result
    from (
      select jsonb_build_object(
        'id', tag.id,
        'label', tag.name,
        'meta', null,
        'color', tag.color
      ) as option
      from public.tags tag
      where tag.workspace_id = p_workspace_id
        and tag.archived_at is null
        and (
          v_query is null
          or lower(extensions.unaccent(tag.name)) like '%' || v_normalized_query || '%'
        )
      order by tag.name, tag.id
      limit v_limit
    ) options;
  end if;

  return jsonb_build_object('items', v_result);
end;
$function$;

CREATE OR REPLACE FUNCTION public.search_workspace(p_workspace_id uuid, p_query text, p_limit_per_group integer DEFAULT 8)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_query text := btrim(coalesce(p_query, ''));
  v_normalized_query text;
  v_tsquery tsquery;
  v_prefix_lexemes text[];
  v_prefix_tsquery tsquery;
  v_allow_lexeme_prefix boolean;
  v_allow_task_key_prefix boolean;
  v_limit_per_group integer := coalesce(p_limit_per_group, 8);
  v_role public.workspace_role;
  v_result jsonb;
begin
  v_role := private.current_workspace_role(p_workspace_id);

  if p_workspace_id is null or v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_WORKSPACE_NOT_FOUND';
  end if;

  if char_length(v_query) < 2 or char_length(v_query) > 100 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_SEARCH_QUERY';
  end if;

  if v_limit_per_group < 1 or v_limit_per_group > 20 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_SEARCH_LIMIT';
  end if;

  v_normalized_query := lower(extensions.unaccent(v_query));
  v_tsquery := websearch_to_tsquery(
    'pg_catalog.portuguese'::regconfig,
    extensions.unaccent(v_query)
  );
  v_prefix_lexemes := tsvector_to_array(
    to_tsvector(
      'pg_catalog.portuguese'::regconfig,
      extensions.unaccent(v_query)
    )
  );
  v_allow_lexeme_prefix :=
    v_normalized_query ~ '^[[:alnum:][:space:]]+$'
    and v_normalized_query !~ '(^|[[:space:]])or([[:space:]]|$)';
  v_allow_task_key_prefix :=
    v_normalized_query ~ '^[[:alnum:]-]+$';

  if v_allow_lexeme_prefix and cardinality(v_prefix_lexemes) > 0 then
    select to_tsquery(
      'pg_catalog.simple'::regconfig,
      string_agg(
        quote_literal(prefix_lexeme.value) || ':*',
        ' & '
        order by prefix_lexeme.value
      )
    )
    into v_prefix_tsquery
    from unnest(v_prefix_lexemes) as prefix_lexeme(value);
  end if;

  with candidates as (
    select
      'task'::text as entity_type,
      'Demandas'::text as group_label,
      1 as group_order,
      task.id as entity_id,
      task.title,
      workspace.task_prefix || '-' || lpad(task.task_number::text, 6, '0')
        || ' · ' || status.name as subtitle,
      '/tarefa/' || task.id::text as href,
      (
        case
          when lower(extensions.unaccent(task.title)) = v_normalized_query then 100
          when lower(workspace.task_prefix || '-' || lpad(task.task_number::text, 6, '0')) = v_normalized_query then 100
          when starts_with(lower(extensions.unaccent(task.title)), v_normalized_query) then 50
          when v_allow_task_key_prefix
            and starts_with(
              lower(workspace.task_prefix || '-' || lpad(task.task_number::text, 6, '0')),
              v_normalized_query
            ) then 50
          when v_prefix_tsquery is not null
            and task.search_vector @@ v_prefix_tsquery then 20
          else 0
        end
        + ts_rank_cd(task.search_vector, v_tsquery) * 10
        + case
            when v_prefix_tsquery is null then 0
            else ts_rank_cd(task.search_vector, v_prefix_tsquery) * 5
          end
      )::real as score
    from (select * from public.tasks where private.can_read_task(id)) task
    join public.workspaces workspace on workspace.id = task.workspace_id
    join public.task_statuses status
      on status.workspace_id = task.workspace_id and status.id = task.status_id
    where task.workspace_id = p_workspace_id
      and task.archived_at is null
      and (
        task.search_vector @@ v_tsquery
        or (v_prefix_tsquery is not null and task.search_vector @@ v_prefix_tsquery)
        or (
          v_prefix_tsquery is null
          and starts_with(lower(extensions.unaccent(task.title)), v_normalized_query)
        )
        or lower(workspace.task_prefix || '-' || lpad(task.task_number::text, 6, '0')) = v_normalized_query
        or (
          v_allow_task_key_prefix
          and starts_with(
            lower(workspace.task_prefix || '-' || lpad(task.task_number::text, 6, '0')),
            v_normalized_query
          )
        )
        or lpad(task.task_number::text, 6, '0') = v_normalized_query
        or task.task_number::text = v_normalized_query
      )

    union all

    select
      'event'::text,
      'Eventos'::text,
      2,
      event.id,
      event.name,
      case
        when event.start_date is null then 'Evento'
        else 'Evento · ' || to_char(event.start_date, 'DD/MM/YYYY')
      end,
      '/eventos?evento=' || event.id::text,
      (
        case
          when lower(extensions.unaccent(event.name)) = v_normalized_query then 100
          when starts_with(lower(extensions.unaccent(event.name)), v_normalized_query) then 50
          when v_prefix_tsquery is not null
            and event.search_vector @@ v_prefix_tsquery then 20
          else 0
        end
        + ts_rank_cd(event.search_vector, v_tsquery) * 10
        + case
            when v_prefix_tsquery is null then 0
            else ts_rank_cd(event.search_vector, v_prefix_tsquery) * 5
          end
      )::real
    from (select * from public.events where private.can_read_event(id)) event
    where event.workspace_id = p_workspace_id
      and event.archived_at is null
      and (
        event.search_vector @@ v_tsquery
        or (v_prefix_tsquery is not null and event.search_vector @@ v_prefix_tsquery)
        or (
          v_prefix_tsquery is null
          and starts_with(lower(extensions.unaccent(event.name)), v_normalized_query)
        )
      )

    union all

    select
      'product'::text,
      'Produtos'::text,
      3,
      product.id,
      product.name,
      'Produto'::text,
      '/produtos?produto=' || product.id::text,
      (
        case
          when lower(extensions.unaccent(product.name)) = v_normalized_query then 100
          when starts_with(lower(extensions.unaccent(product.name)), v_normalized_query) then 50
          when v_prefix_tsquery is not null
            and product.search_vector @@ v_prefix_tsquery then 20
          else 0
        end
        + ts_rank_cd(product.search_vector, v_tsquery) * 10
        + case
            when v_prefix_tsquery is null then 0
            else ts_rank_cd(product.search_vector, v_prefix_tsquery) * 5
          end
      )::real
    from public.products product
    where product.workspace_id = p_workspace_id
      and product.archived_at is null
      and (
        product.search_vector @@ v_tsquery
        or (v_prefix_tsquery is not null and product.search_vector @@ v_prefix_tsquery)
        or (
          v_prefix_tsquery is null
          and starts_with(lower(extensions.unaccent(product.name)), v_normalized_query)
        )
      )

    union all

    select
      'resource'::text,
      'Recursos'::text,
      4,
      resource.id,
      resource.title,
      coalesce(category.name || ' · ', '') || resource.resource_type::text,
      '/recursos?recurso=' || resource.id::text,
      (
        case
          when lower(extensions.unaccent(resource.title)) = v_normalized_query then 100
          when starts_with(lower(extensions.unaccent(resource.title)), v_normalized_query) then 50
          when v_prefix_tsquery is not null
            and resource.search_vector @@ v_prefix_tsquery then 20
          else 0
        end
        + ts_rank_cd(resource.search_vector, v_tsquery) * 10
        + case
            when v_prefix_tsquery is null then 0
            else ts_rank_cd(resource.search_vector, v_prefix_tsquery) * 5
          end
      )::real
    from public.resources resource
    left join public.resource_categories category
      on category.workspace_id = resource.workspace_id and category.id = resource.category_id
    where resource.workspace_id = p_workspace_id
      and resource.archived_at is null
      and private.can_view_resource(resource.id)
      and (
        resource.search_vector @@ v_tsquery
        or (v_prefix_tsquery is not null and resource.search_vector @@ v_prefix_tsquery)
        or (
          v_prefix_tsquery is null
          and starts_with(lower(extensions.unaccent(resource.title)), v_normalized_query)
        )
      )

    union all

    select
      'person'::text,
      'Pessoas'::text,
      5,
      profile.id,
      profile.full_name,
      case member.role
        when 'owner'::public.workspace_role then 'Proprietário'
        when 'admin'::public.workspace_role then 'Administrador'
        when 'manager'::public.workspace_role then 'Gestor'
        when 'member'::public.workspace_role then 'Membro'
        else 'Visualizador'
      end,
      '/equipe?membro=' || profile.id::text,
      (
        case
          when lower(extensions.unaccent(profile.full_name)) = v_normalized_query then 100
          when starts_with(lower(extensions.unaccent(profile.full_name)), v_normalized_query) then 50
          when v_prefix_tsquery is not null
            and profile.search_vector @@ v_prefix_tsquery then 20
          else 0
        end
        + ts_rank_cd(profile.search_vector, v_tsquery) * 10
        + case
            when v_prefix_tsquery is null then 0
            else ts_rank_cd(profile.search_vector, v_prefix_tsquery) * 5
          end
      )::real
    from public.workspace_members member
    join public.profiles profile on profile.id = member.user_id and profile.is_active
    where member.workspace_id = p_workspace_id
      and member.status = 'active'::public.membership_status
      and (
        profile.search_vector @@ v_tsquery
        or (v_prefix_tsquery is not null and profile.search_vector @@ v_prefix_tsquery)
        or (
          v_prefix_tsquery is null
          and starts_with(lower(extensions.unaccent(profile.full_name)), v_normalized_query)
        )
      )
      and (
        v_role in (
          'owner'::public.workspace_role,
          'admin'::public.workspace_role,
          'manager'::public.workspace_role
        )
        or (
          v_role = 'member'::public.workspace_role
          and member.user_id = (select auth.uid())
        )
      )
  ), ranked as (
    select
      candidates.*,
      row_number() over (
        partition by candidates.entity_type
        order by candidates.score desc, candidates.title, candidates.entity_id
      ) as group_position
    from candidates
  ), groups as (
    select
      ranked.entity_type,
      ranked.group_label,
      ranked.group_order,
      jsonb_agg(
        jsonb_build_object(
          'id', ranked.entity_id,
          'title', ranked.title,
          'subtitle', ranked.subtitle,
          'href', ranked.href,
          'score', ranked.score
        ) order by ranked.score desc, ranked.title, ranked.entity_id
      ) as items
    from ranked
    where ranked.group_position <= v_limit_per_group
    group by ranked.entity_type, ranked.group_label, ranked.group_order
  )
  select jsonb_build_object(
    'query', v_query,
    'groups', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'entity_type', groups.entity_type,
          'label', groups.group_label,
          'items', groups.items
        ) order by groups.group_order
      ),
      '[]'::jsonb
    ),
    'total', (select count(*) from ranked)
  ) into v_result
  from groups;

  return v_result;
end;
$function$;

commit;
