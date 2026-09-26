-- Make lightweight checklist steps frictionless and add full delegated subtasks.

begin;

alter table public.task_checklists
  add column is_default boolean not null default false;

create unique index task_checklists_one_default_per_task
  on public.task_checklists (workspace_id, task_id)
  where is_default;

create table public.task_subtasks (
  workspace_id uuid not null,
  parent_task_id uuid not null,
  child_task_id uuid not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, parent_task_id, child_task_id),
  unique (workspace_id, child_task_id),
  foreign key (workspace_id, parent_task_id)
    references public.tasks(workspace_id, id) on delete cascade,
  foreign key (workspace_id, child_task_id)
    references public.tasks(workspace_id, id) on delete cascade,
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint task_subtasks_distinct_tasks check (parent_task_id <> child_task_id)
);

create index task_subtasks_parent_created
  on public.task_subtasks (workspace_id, parent_task_id, created_at, child_task_id);

alter table public.task_subtasks enable row level security;
alter table public.task_subtasks force row level security;

create policy task_subtasks_select_workspace_member
on public.task_subtasks
for select
to authenticated
using (private.is_active_workspace_member(workspace_id));

revoke all on table public.task_subtasks from public, anon, authenticated;
grant select on table public.task_subtasks to authenticated;

create or replace function public.add_task_checklist_item_to_task(
  p_task_id uuid,
  p_content text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_workspace_id uuid;
  v_checklist public.task_checklists%rowtype;
  v_item public.task_checklist_items%rowtype;
  v_position numeric;
begin
  select task.workspace_id
  into v_workspace_id
  from public.tasks task
  where task.id = p_task_id
    and task.archived_at is null;

  if v_workspace_id is null or not private.can_edit_task(p_task_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if p_content is null or char_length(btrim(p_content)) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_CHECKLIST_ITEM';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('pta:task-default-checklist:' || p_task_id::text, 0)
  );

  select checklist.*
  into v_checklist
  from public.task_checklists checklist
  where checklist.workspace_id = v_workspace_id
    and checklist.task_id = p_task_id
    and checklist.is_default
  for update;

  if not found then
    insert into public.task_checklists (
      workspace_id, task_id, title, position, created_by, is_default
    ) values (
      v_workspace_id, p_task_id, 'Checklist', 0, v_actor, true
    )
    returning * into v_checklist;
  end if;

  select coalesce(max(item.position), 0) + 1000
  into v_position
  from public.task_checklist_items item
  where item.workspace_id = v_workspace_id
    and item.task_id = p_task_id
    and item.checklist_id = v_checklist.id;

  insert into public.task_checklist_items (
    workspace_id, task_id, checklist_id, content, position, created_by
  ) values (
    v_workspace_id, p_task_id, v_checklist.id, btrim(p_content), v_position, v_actor
  )
  returning * into v_item;

  update public.task_checklists checklist
  set updated_at = clock_timestamp()
  where checklist.workspace_id = v_workspace_id
    and checklist.task_id = p_task_id
    and checklist.id = v_checklist.id;

  return jsonb_build_object(
    'id', v_item.id,
    'checklist_id', v_item.checklist_id,
    'task_id', v_item.task_id,
    'content', v_item.content,
    'position', v_item.position,
    'is_completed', v_item.is_completed,
    'created_by', v_item.created_by,
    'created_at', v_item.created_at,
    'updated_at', v_item.updated_at
  );
end;
$$;

create or replace function public.update_task_checklist(
  p_checklist_id uuid,
  p_title text,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checklist public.task_checklists%rowtype;
begin
  select checklist.* into v_checklist
  from public.task_checklists checklist
  where checklist.id = p_checklist_id
  for update;

  if not found or not private.can_edit_task(v_checklist.task_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if v_checklist.updated_at <> p_expected_updated_at then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;
  if v_checklist.is_default then
    raise exception using errcode = '23514', message = 'PTA_DEFAULT_CHECKLIST_IMMUTABLE';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_CHECKLIST_TITLE';
  end if;

  update public.task_checklists checklist
  set title = btrim(p_title), updated_at = clock_timestamp()
  where checklist.id = p_checklist_id
  returning checklist.* into v_checklist;

  return jsonb_build_object(
    'id', v_checklist.id,
    'title', v_checklist.title,
    'updated_at', v_checklist.updated_at
  );
end;
$$;

create or replace function public.update_task_checklist_item(
  p_item_id uuid,
  p_content text,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.task_checklist_items%rowtype;
begin
  select item.* into v_item
  from public.task_checklist_items item
  where item.id = p_item_id
  for update;

  if not found or not private.can_edit_task(v_item.task_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if v_item.updated_at <> p_expected_updated_at then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;
  if p_content is null or char_length(btrim(p_content)) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_CHECKLIST_ITEM';
  end if;

  update public.task_checklist_items item
  set content = btrim(p_content), updated_at = clock_timestamp()
  where item.id = p_item_id
  returning item.* into v_item;

  update public.task_checklists checklist
  set updated_at = clock_timestamp()
  where checklist.workspace_id = v_item.workspace_id
    and checklist.task_id = v_item.task_id
    and checklist.id = v_item.checklist_id;

  return jsonb_build_object(
    'id', v_item.id,
    'content', v_item.content,
    'updated_at', v_item.updated_at
  );
end;
$$;

create or replace function public.create_task_subtask(
  p_parent_task_id uuid,
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
  v_parent public.tasks%rowtype;
  v_created jsonb;
  v_child_id uuid;
begin
  select task.* into v_parent
  from public.tasks task
  where task.id = p_parent_task_id
    and task.archived_at is null
  for update;

  if not found or v_actor is null or not private.can_edit_task(p_parent_task_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;

  if p_primary_assignee_id is not null and not exists (
    select 1
    from public.workspace_members member
    join public.profiles profile
      on profile.id = member.user_id and profile.is_active
    where member.workspace_id = v_parent.workspace_id
      and member.user_id = p_primary_assignee_id
      and member.status = 'active'
      and member.removed_at is null
      and member.role <> 'viewer'::public.workspace_role
  ) then
    raise exception using errcode = '23514', message = 'PTA_ASSIGNEE_NOT_ACTIVE_MEMBER';
  end if;

  v_created := public.create_global_task(
    p_workspace_id => v_parent.workspace_id,
    p_title => p_title,
    p_status_id => p_status_id,
    p_priority => p_priority,
    p_due_date => p_due_date,
    p_due_time => p_due_time,
    p_primary_assignee_id => null,
    p_type_id => p_type_id,
    p_product_id => p_product_id,
    p_event_id => p_event_id,
    p_description => p_description,
    p_blocked_reason => p_blocked_reason
  );
  v_child_id := (v_created ->> 'id')::uuid;

  if p_primary_assignee_id is not null then
    insert into public.task_assignees (
      workspace_id, task_id, user_id, is_primary, assigned_by
    ) values (
      v_parent.workspace_id, v_child_id, p_primary_assignee_id, true, v_actor
    );
  end if;

  insert into public.task_subtasks (
    workspace_id, parent_task_id, child_task_id, created_by
  ) values (
    v_parent.workspace_id, v_parent.id, v_child_id, v_actor
  );

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, metadata_json
  ) values (
    v_parent.workspace_id,
    v_actor,
    'task',
    v_parent.id,
    'task.subtask_created',
    jsonb_build_object('child_task_id', v_child_id, 'title', btrim(p_title))
  );

  return v_created || jsonb_build_object(
    'parent_task_id', v_parent.id,
    'primary_assignee_id', p_primary_assignee_id
  );
end;
$$;

create or replace function private.task_collaboration_payload(p_task_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_workspace_id uuid;
  v_role public.workspace_role;
  v_checklists jsonb;
  v_comments_page jsonb;
  v_links jsonb;
begin
  select task.workspace_id into v_workspace_id
  from public.tasks task
  where task.id = p_task_id and task.archived_at is null;

  v_role := private.task_collaboration_role(p_task_id);
  if v_workspace_id is null or v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', checklist.id,
    'title', checklist.title,
    'is_default', checklist.is_default,
    'position', checklist.position,
    'created_by', checklist.created_by,
    'creator_name', checklist_creator.full_name,
    'created_at', checklist.created_at,
    'updated_at', checklist.updated_at,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', item.id,
        'content', item.content,
        'position', item.position,
        'is_completed', item.is_completed,
        'completed_by', item.completed_by,
        'completed_by_name', item_completer.full_name,
        'completed_at', item.completed_at,
        'created_by', item.created_by,
        'creator_name', item_creator.full_name,
        'created_at', item.created_at,
        'updated_at', item.updated_at
      ) order by item.position, item.created_at, item.id), '[]'::jsonb)
      from public.task_checklist_items item
      left join public.profiles item_creator on item_creator.id = item.created_by
      left join public.profiles item_completer on item_completer.id = item.completed_by
      where item.workspace_id = checklist.workspace_id
        and item.task_id = checklist.task_id
        and item.checklist_id = checklist.id
    )
  ) order by checklist.position, checklist.created_at, checklist.id), '[]'::jsonb)
  into v_checklists
  from public.task_checklists checklist
  left join public.profiles checklist_creator on checklist_creator.id = checklist.created_by
  where checklist.workspace_id = v_workspace_id and checklist.task_id = p_task_id;

  v_comments_page := public.list_task_comments(p_task_id, null, null, 20);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', link.id,
    'url', link.url,
    'label', link.label,
    'provider', link.provider,
    'created_by', link.created_by,
    'author_name', link_author.full_name,
    'created_at', link.created_at,
    'updated_at', link.updated_at,
    'can_edit_link', v_role in ('owner', 'admin', 'manager') or (v_role = 'member' and link.created_by = v_actor),
    'can_delete_link', v_role in ('owner', 'admin', 'manager') or (v_role = 'member' and link.created_by = v_actor)
  ) order by link.created_at, link.id), '[]'::jsonb)
  into v_links
  from public.task_links link
  left join public.profiles link_author on link_author.id = link.created_by
  where link.workspace_id = v_workspace_id
    and link.task_id = p_task_id
    and link.deleted_at is null;

  return jsonb_build_object(
    'checklists', v_checklists,
    'comments', v_comments_page -> 'comments',
    'comments_page', jsonb_build_object(
      'has_more', v_comments_page -> 'has_more',
      'next_cursor', v_comments_page -> 'next_cursor'
    ),
    'links', v_links
  );
end;
$$;

create or replace function public.get_task_detail(p_task_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
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
  from public.tasks task
  where task.id = p_task_id and task.archived_at is null;

  if v_workspace_id is null or not private.is_active_workspace_member(v_workspace_id) then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;

  select to_jsonb(overview) || jsonb_build_object(
    'description_json', task.description_json,
    'requester_id', coalesce(task.requester_id, task.created_by),
    'requester_name', requester.full_name
  ) into v_task
  from public.v_task_overview overview
  join public.tasks task on task.workspace_id = overview.workspace_id and task.id = overview.id
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
  join public.v_task_overview child
    on child.workspace_id = relation.workspace_id and child.id = relation.child_task_id
  where relation.workspace_id = v_workspace_id and relation.parent_task_id = p_task_id;

  select to_jsonb(parent)
  into v_parent_task
  from public.task_subtasks relation
  join public.v_task_overview parent
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
$$;

alter function public.add_task_checklist_item_to_task(uuid, text) owner to postgres;
alter function public.update_task_checklist(uuid, text, timestamptz) owner to postgres;
alter function public.update_task_checklist_item(uuid, text, timestamptz) owner to postgres;
alter function public.create_task_subtask(uuid, text, uuid, public.task_priority, date, time without time zone, uuid, uuid, uuid, uuid, jsonb, text) owner to postgres;
alter function private.task_collaboration_payload(uuid) owner to postgres;
alter function public.get_task_detail(uuid) owner to postgres;

revoke all on function public.add_task_checklist_item_to_task(uuid, text) from public, anon, authenticated;
revoke all on function public.update_task_checklist(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.update_task_checklist_item(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.create_task_subtask(uuid, text, uuid, public.task_priority, date, time without time zone, uuid, uuid, uuid, uuid, jsonb, text) from public, anon, authenticated;

grant execute on function public.add_task_checklist_item_to_task(uuid, text) to authenticated;
grant execute on function public.update_task_checklist(uuid, text, timestamptz) to authenticated;
grant execute on function public.update_task_checklist_item(uuid, text, timestamptz) to authenticated;
grant execute on function public.create_task_subtask(uuid, text, uuid, public.task_priority, date, time without time zone, uuid, uuid, uuid, uuid, jsonb, text) to authenticated;

commit;
