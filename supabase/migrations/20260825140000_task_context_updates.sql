-- Allow inline task context editing without weakening workspace isolation.

begin;

create or replace function public.update_task(
  p_task_id uuid,
  p_expected_version integer,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_current public.tasks%rowtype;
  v_task public.tasks%rowtype;
  v_type_id uuid;
  v_product_id uuid;
  v_event_id uuid;
  v_event_product_id uuid;
begin
  if v_actor is null or not private.can_edit_task(p_task_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;

  select task.*
  into v_current
  from public.tasks task
  where task.id = p_task_id
    and task.archived_at is null
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;

  if v_current.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception using errcode = '22023', message = 'PTA_PATCH_MUST_BE_OBJECT';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_patch) as patch_key(key)
    where patch_key.key <> all (
      array[
        'title',
        'status_id',
        'priority',
        'due_date',
        'due_time',
        'blocked_reason',
        'type_id',
        'product_id',
        'event_id'
      ]::text[]
    )
  ) then
    raise exception using errcode = '22023', message = 'PTA_PATCH_HAS_UNSUPPORTED_FIELDS';
  end if;

  v_type_id := case
    when p_patch ? 'type_id'
      then nullif(p_patch ->> 'type_id', '')::uuid
    else v_current.type_id
  end;
  v_product_id := case
    when p_patch ? 'product_id'
      then nullif(p_patch ->> 'product_id', '')::uuid
    else v_current.product_id
  end;
  v_event_id := case
    when p_patch ? 'event_id'
      then nullif(p_patch ->> 'event_id', '')::uuid
    else v_current.event_id
  end;

  if p_patch ? 'type_id' and v_type_id is not null and not exists (
    select 1
    from public.task_types task_type
    where task_type.workspace_id = v_current.workspace_id
      and task_type.id = v_type_id
      and task_type.is_active
  ) then
    raise exception using errcode = '23514', message = 'PTA_TYPE_NOT_ACTIVE';
  end if;

  if (p_patch ? 'product_id' or p_patch ? 'event_id')
     and v_product_id is not null
     and not exists (
       select 1
       from public.products product
       where product.workspace_id = v_current.workspace_id
         and product.id = v_product_id
         and product.archived_at is null
     ) then
    raise exception using errcode = '23514', message = 'PTA_PRODUCT_NOT_ACTIVE';
  end if;

  if (p_patch ? 'product_id' or p_patch ? 'event_id')
     and v_event_id is not null then
    select event.product_id
    into v_event_product_id
    from public.events event
    where event.workspace_id = v_current.workspace_id
      and event.id = v_event_id
      and event.archived_at is null;

    if not found then
      raise exception using errcode = '23514', message = 'PTA_EVENT_NOT_ACTIVE';
    end if;

    if v_event_product_id is not null then
      if v_product_id is null and not (p_patch ? 'product_id') then
        v_product_id := v_event_product_id;
      elsif v_product_id is distinct from v_event_product_id then
        raise exception using errcode = '23514', message = 'PTA_EVENT_PRODUCT_MISMATCH';
      end if;
    end if;
  end if;

  update public.tasks task
  set
    title = case
      when p_patch ? 'title' then p_patch ->> 'title'
      else task.title
    end,
    status_id = case
      when p_patch ? 'status_id' then (p_patch ->> 'status_id')::uuid
      else task.status_id
    end,
    priority = case
      when p_patch ? 'priority'
        then (p_patch ->> 'priority')::public.task_priority
      else task.priority
    end,
    due_date = case
      when p_patch ? 'due_date'
        then nullif(p_patch ->> 'due_date', '')::date
      else task.due_date
    end,
    due_time = case
      when p_patch ? 'due_time'
        then nullif(p_patch ->> 'due_time', '')::time
      else task.due_time
    end,
    blocked_reason = case
      when p_patch ? 'blocked_reason' then p_patch ->> 'blocked_reason'
      else task.blocked_reason
    end,
    type_id = case
      when p_patch ? 'type_id' then v_type_id
      else task.type_id
    end,
    product_id = case
      when p_patch ? 'product_id' or p_patch ? 'event_id' then v_product_id
      else task.product_id
    end,
    event_id = case
      when p_patch ? 'event_id' then v_event_id
      else task.event_id
    end,
    updated_by = v_actor
  where task.id = p_task_id
    and task.version = p_expected_version
  returning task.* into v_task;

  if not found then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  return jsonb_build_object(
    'id', v_task.id,
    'version', v_task.version,
    'updated_at', v_task.updated_at,
    'type_id', v_task.type_id,
    'product_id', v_task.product_id,
    'event_id', v_task.event_id
  );
end;
$$;

comment on function public.update_task(uuid, integer, jsonb) is
  'Updates supported task fields atomically with optimistic concurrency and workspace-scoped context validation.';

create or replace function private.tasks_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.activity_logs (
      workspace_id,
      actor_id,
      entity_type,
      entity_id,
      action,
      metadata_json
    ) values (
      new.workspace_id,
      new.created_by,
      'task',
      new.id,
      'task.created',
      jsonb_build_object('task_number', new.task_number)
    );

    insert into public.notifications (
      workspace_id,
      user_id,
      actor_id,
      notification_type,
      entity_type,
      entity_id,
      title,
      body,
      dedupe_key
    ) values (
      new.workspace_id,
      new.created_by,
      new.created_by,
      'task_created',
      'task',
      new.id,
      'Demanda criada',
      new.title,
      format('task_created:%s:%s', new.id, new.created_by)
    ) on conflict do nothing;

    return new;
  end if;

  if new.title is distinct from old.title then
    v_changes := v_changes || jsonb_build_object(
      'title',
      jsonb_build_object('old', old.title, 'new', new.title)
    );
  end if;

  if new.status_id is distinct from old.status_id then
    v_changes := v_changes || jsonb_build_object(
      'status_id',
      jsonb_build_object('old', old.status_id, 'new', new.status_id)
    );
  end if;

  if new.priority is distinct from old.priority then
    v_changes := v_changes || jsonb_build_object(
      'priority',
      jsonb_build_object('old', old.priority, 'new', new.priority)
    );
  end if;

  if new.due_date is distinct from old.due_date
     or new.due_time is distinct from old.due_time then
    v_changes := v_changes || jsonb_build_object(
      'due',
      jsonb_build_object(
        'old', jsonb_build_object('date', old.due_date, 'time', old.due_time),
        'new', jsonb_build_object('date', new.due_date, 'time', new.due_time)
      )
    );
  end if;

  if new.type_id is distinct from old.type_id then
    v_changes := v_changes || jsonb_build_object(
      'type_id',
      jsonb_build_object('old', old.type_id, 'new', new.type_id)
    );
  end if;

  if new.product_id is distinct from old.product_id then
    v_changes := v_changes || jsonb_build_object(
      'product_id',
      jsonb_build_object('old', old.product_id, 'new', new.product_id)
    );
  end if;

  if new.event_id is distinct from old.event_id then
    v_changes := v_changes || jsonb_build_object(
      'event_id',
      jsonb_build_object('old', old.event_id, 'new', new.event_id)
    );
  end if;

  if v_changes <> '{}'::jsonb then
    insert into public.activity_logs (
      workspace_id,
      actor_id,
      entity_type,
      entity_id,
      action,
      changes_json
    ) values (
      new.workspace_id,
      new.updated_by,
      'task',
      new.id,
      'task.updated',
      v_changes
    );
  end if;

  return new;
end;
$$;

alter function public.update_task(uuid, integer, jsonb) owner to postgres;
alter function private.tasks_after_write() owner to postgres;

revoke all on function public.update_task(uuid, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.update_task(uuid, integer, jsonb)
  to authenticated;

commit;
