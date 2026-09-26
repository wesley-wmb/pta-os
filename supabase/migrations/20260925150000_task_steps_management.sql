-- Complete checklist lifecycle and allow a delegated task to be detached safely.

begin;

create or replace function public.remove_task_checklist_item(
  p_item_id uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_item public.task_checklist_items%rowtype;
begin
  select item.* into v_item
  from public.task_checklist_items item
  where item.id = p_item_id
  for update;

  if not found or v_actor is null or not private.can_edit_task(v_item.task_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if v_item.updated_at <> p_expected_updated_at then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  delete from public.task_checklist_items item where item.id = v_item.id;
  update public.task_checklists checklist
  set updated_at = now()
  where checklist.id = v_item.checklist_id;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, metadata_json
  ) values (
    v_item.workspace_id, v_actor, 'task', v_item.task_id,
    'task.checklist_item_removed',
    jsonb_build_object('item_id', v_item.id, 'checklist_id', v_item.checklist_id)
  );

  return jsonb_build_object('id', v_item.id, 'removed', true);
end;
$$;

create or replace function public.remove_task_checklist(
  p_checklist_id uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_checklist public.task_checklists%rowtype;
  v_item_count integer;
begin
  select checklist.* into v_checklist
  from public.task_checklists checklist
  where checklist.id = p_checklist_id
  for update;

  if not found or v_actor is null or not private.can_edit_task(v_checklist.task_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if v_checklist.updated_at <> p_expected_updated_at then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  select count(*)::integer into v_item_count
  from public.task_checklist_items item
  where item.workspace_id = v_checklist.workspace_id
    and item.task_id = v_checklist.task_id
    and item.checklist_id = v_checklist.id;

  delete from public.task_checklists checklist where checklist.id = v_checklist.id;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, metadata_json
  ) values (
    v_checklist.workspace_id, v_actor, 'task', v_checklist.task_id,
    'task.checklist_removed',
    jsonb_build_object(
      'checklist_id', v_checklist.id,
      'title', v_checklist.title,
      'item_count', v_item_count
    )
  );

  return jsonb_build_object(
    'id', v_checklist.id,
    'removed', true,
    'item_count', v_item_count
  );
end;
$$;

create or replace function public.unlink_task_subtask(
  p_parent_task_id uuid,
  p_child_task_id uuid,
  p_expected_parent_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_parent public.tasks%rowtype;
begin
  select task.* into v_parent
  from public.tasks task
  where task.id = p_parent_task_id and task.archived_at is null
  for update;

  if not found or v_actor is null or not private.can_edit_task(p_parent_task_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if v_parent.version <> p_expected_parent_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;
  if not exists (
    select 1 from public.task_subtasks relation
    where relation.workspace_id = v_parent.workspace_id
      and relation.parent_task_id = p_parent_task_id
      and relation.child_task_id = p_child_task_id
  ) then
    raise exception using errcode = 'P0002', message = 'PTA_SUBTASK_NOT_FOUND';
  end if;

  delete from public.task_subtasks relation
  where relation.workspace_id = v_parent.workspace_id
    and relation.parent_task_id = p_parent_task_id
    and relation.child_task_id = p_child_task_id;

  update public.tasks task
  set version = task.version + 1, updated_at = now()
  where task.id = v_parent.id
  returning task.* into v_parent;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, metadata_json
  ) values (
    v_parent.workspace_id, v_actor, 'task', v_parent.id,
    'task.subtask_unlinked', jsonb_build_object('child_task_id', p_child_task_id)
  );

  return jsonb_build_object(
    'parent_task_id', v_parent.id,
    'child_task_id', p_child_task_id,
    'parent_version', v_parent.version,
    'unlinked', true
  );
end;
$$;

alter function public.remove_task_checklist_item(uuid, timestamptz) owner to postgres;
alter function public.remove_task_checklist(uuid, timestamptz) owner to postgres;
alter function public.unlink_task_subtask(uuid, uuid, integer) owner to postgres;

revoke all on function public.remove_task_checklist_item(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.remove_task_checklist(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.unlink_task_subtask(uuid, uuid, integer) from public, anon, authenticated;

grant execute on function public.remove_task_checklist_item(uuid, timestamptz) to authenticated;
grant execute on function public.remove_task_checklist(uuid, timestamptz) to authenticated;
grant execute on function public.unlink_task_subtask(uuid, uuid, integer) to authenticated;

commit;
