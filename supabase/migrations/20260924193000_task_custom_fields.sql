begin;

create type public.task_custom_field_type as enum (
  'text',
  'number',
  'date',
  'boolean',
  'single_select'
);

create table public.task_custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  field_type public.task_custom_field_type not null,
  position integer not null default 0,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid,
  version integer not null default 1,
  unique (workspace_id, id),
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, updated_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint task_custom_field_name_length
    check (char_length(btrim(name)) between 2 and 60),
  constraint task_custom_field_position_valid check (position >= 0),
  constraint task_custom_field_version_valid check (version >= 1)
);

create unique index task_custom_field_active_name_unique
  on public.task_custom_field_definitions (workspace_id, lower(btrim(name)))
  where archived_at is null;

create table public.task_custom_field_options (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  field_id uuid not null,
  label text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (workspace_id, field_id, id),
  foreign key (workspace_id, field_id)
    references public.task_custom_field_definitions(workspace_id, id) on delete cascade,
  constraint task_custom_field_option_label_length
    check (char_length(btrim(label)) between 1 and 60),
  constraint task_custom_field_option_position_valid check (position >= 0)
);

create table public.task_custom_field_values (
  workspace_id uuid not null,
  task_id uuid not null,
  field_id uuid not null,
  text_value text,
  number_value numeric,
  date_value date,
  boolean_value boolean,
  option_id uuid,
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, task_id, field_id),
  foreign key (workspace_id, task_id)
    references public.tasks(workspace_id, id) on delete cascade,
  foreign key (workspace_id, field_id)
    references public.task_custom_field_definitions(workspace_id, id) on delete cascade,
  foreign key (workspace_id, field_id, option_id)
    references public.task_custom_field_options(workspace_id, field_id, id),
  foreign key (workspace_id, updated_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint task_custom_field_value_one_type
    check (num_nonnulls(text_value, number_value, date_value, boolean_value, option_id) = 1),
  constraint task_custom_field_text_length
    check (text_value is null or char_length(text_value) <= 500)
);

alter table public.task_custom_field_definitions enable row level security;
alter table public.task_custom_field_definitions force row level security;
alter table public.task_custom_field_options enable row level security;
alter table public.task_custom_field_options force row level security;
alter table public.task_custom_field_values enable row level security;
alter table public.task_custom_field_values force row level security;

create policy task_custom_field_definitions_select_member
  on public.task_custom_field_definitions for select to authenticated
  using (private.is_active_workspace_member(workspace_id));

create policy task_custom_field_options_select_member
  on public.task_custom_field_options for select to authenticated
  using (private.is_active_workspace_member(workspace_id));

create policy task_custom_field_values_select_member
  on public.task_custom_field_values for select to authenticated
  using (private.is_active_workspace_member(workspace_id));

create or replace function public.create_task_custom_field(
  p_workspace_id uuid,
  p_name text,
  p_field_type public.task_custom_field_type,
  p_options text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_field public.task_custom_field_definitions%rowtype;
  v_option text;
  v_index integer := 0;
begin
  if v_actor is null
    or private.current_workspace_role(p_workspace_id) not in ('owner', 'admin', 'manager') then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 2 and 60 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_CUSTOM_FIELD_NAME';
  end if;
  if (
    select count(*)
    from public.task_custom_field_definitions field
    where field.workspace_id = p_workspace_id and field.archived_at is null
  ) >= 12 then
    raise exception using errcode = '23514', message = 'PTA_CUSTOM_FIELD_LIMIT';
  end if;
  if p_field_type = 'single_select' and coalesce(array_length(p_options, 1), 0) not between 1 and 30 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_CUSTOM_FIELD_OPTIONS';
  end if;
  if p_field_type <> 'single_select' and coalesce(array_length(p_options, 1), 0) > 0 then
    raise exception using errcode = '22023', message = 'PTA_OPTIONS_NOT_ALLOWED';
  end if;

  insert into public.task_custom_field_definitions (
    workspace_id, name, field_type, position, created_by, updated_by
  ) values (
    p_workspace_id,
    btrim(p_name),
    p_field_type,
    coalesce((select max(field.position) + 1000 from public.task_custom_field_definitions field where field.workspace_id = p_workspace_id), 1000),
    v_actor,
    v_actor
  ) returning * into v_field;

  foreach v_option in array coalesce(p_options, '{}'::text[]) loop
    v_index := v_index + 1;
    if char_length(btrim(v_option)) not between 1 and 60 then
      raise exception using errcode = '22023', message = 'PTA_INVALID_CUSTOM_FIELD_OPTION';
    end if;
    insert into public.task_custom_field_options (workspace_id, field_id, label, position)
    values (p_workspace_id, v_field.id, btrim(v_option), v_index * 1000);
  end loop;

  return jsonb_build_object('id', v_field.id, 'name', v_field.name, 'type', v_field.field_type);
end;
$$;

create or replace function public.set_task_custom_field_value(
  p_task_id uuid,
  p_field_id uuid,
  p_expected_task_version integer,
  p_value jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_task public.tasks%rowtype;
  v_field public.task_custom_field_definitions%rowtype;
  v_text text;
  v_option_id uuid;
begin
  select task.* into v_task
  from public.tasks task
  where task.id = p_task_id and task.archived_at is null
  for update;

  if not found or v_actor is null or not private.can_edit_task(p_task_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if v_task.version <> p_expected_task_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  select field.* into v_field
  from public.task_custom_field_definitions field
  where field.id = p_field_id
    and field.workspace_id = v_task.workspace_id
    and field.archived_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_CUSTOM_FIELD_NOT_FOUND';
  end if;

  if p_value is null or p_value = 'null'::jsonb then
    delete from public.task_custom_field_values value
    where value.workspace_id = v_task.workspace_id
      and value.task_id = p_task_id
      and value.field_id = p_field_id;
  else
    if v_field.field_type = 'text' then
      if jsonb_typeof(p_value) <> 'string' or char_length(p_value #>> '{}') > 500 then
        raise exception using errcode = '22023', message = 'PTA_INVALID_CUSTOM_FIELD_VALUE';
      end if;
    elsif v_field.field_type = 'number' then
      if jsonb_typeof(p_value) <> 'number' then
        raise exception using errcode = '22023', message = 'PTA_INVALID_CUSTOM_FIELD_VALUE';
      end if;
    elsif v_field.field_type = 'date' then
      v_text := p_value #>> '{}';
      if jsonb_typeof(p_value) <> 'string' or v_text !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception using errcode = '22023', message = 'PTA_INVALID_CUSTOM_FIELD_VALUE';
      end if;
    elsif v_field.field_type = 'boolean' then
      if jsonb_typeof(p_value) <> 'boolean' then
        raise exception using errcode = '22023', message = 'PTA_INVALID_CUSTOM_FIELD_VALUE';
      end if;
    elsif v_field.field_type = 'single_select' then
      if jsonb_typeof(p_value) <> 'string' then
        raise exception using errcode = '22023', message = 'PTA_INVALID_CUSTOM_FIELD_VALUE';
      end if;
      begin
        v_option_id := (p_value #>> '{}')::uuid;
      exception when invalid_text_representation then
        raise exception using errcode = '22023', message = 'PTA_INVALID_CUSTOM_FIELD_VALUE';
      end;
      if not exists (
        select 1 from public.task_custom_field_options option
        where option.workspace_id = v_task.workspace_id
          and option.field_id = p_field_id
          and option.id = v_option_id
          and option.archived_at is null
      ) then
        raise exception using errcode = '22023', message = 'PTA_INVALID_CUSTOM_FIELD_VALUE';
      end if;
    end if;

    insert into public.task_custom_field_values (
      workspace_id, task_id, field_id, text_value, number_value,
      date_value, boolean_value, option_id, updated_by
    ) values (
      v_task.workspace_id,
      p_task_id,
      p_field_id,
      case when v_field.field_type = 'text' then p_value #>> '{}' end,
      case when v_field.field_type = 'number' then (p_value #>> '{}')::numeric end,
      case when v_field.field_type = 'date' then (p_value #>> '{}')::date end,
      case when v_field.field_type = 'boolean' then (p_value #>> '{}')::boolean end,
      case when v_field.field_type = 'single_select' then v_option_id end,
      v_actor
    )
    on conflict (workspace_id, task_id, field_id) do update set
      text_value = excluded.text_value,
      number_value = excluded.number_value,
      date_value = excluded.date_value,
      boolean_value = excluded.boolean_value,
      option_id = excluded.option_id,
      updated_by = excluded.updated_by,
      updated_at = clock_timestamp();
  end if;

  update public.tasks task
  set updated_by = v_actor
  where task.id = p_task_id and task.version = p_expected_task_version
  returning * into v_task;
  if not found then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, metadata_json
  ) values (
    v_task.workspace_id, v_actor, 'task', v_task.id, 'task.custom_field_updated',
    jsonb_build_object('field_id', p_field_id)
  );

  return jsonb_build_object('id', v_task.id, 'version', v_task.version, 'updated_at', v_task.updated_at);
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
    'requester_id', task.created_by,
    'requester_name', requester.full_name
  ) into v_task
  from public.v_task_overview overview
  join public.tasks task on task.workspace_id = overview.workspace_id and task.id = overview.id
  left join public.profiles requester on requester.id = task.created_by
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
    on value.workspace_id = field.workspace_id
    and value.field_id = field.id
    and value.task_id = p_task_id
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', option.id, 'label', option.label
    ) order by option.position, option.id) as items
    from public.task_custom_field_options option
    where option.workspace_id = field.workspace_id
      and option.field_id = field.id
      and option.archived_at is null
  ) options on true
  where field.workspace_id = v_workspace_id and field.archived_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', activity.id,
    'actor_id', activity.actor_id,
    'action', activity.action,
    'changes_json', '{}'::jsonb,
    'metadata_json', '{}'::jsonb,
    'created_at', activity.created_at
  ) order by activity.created_at desc, activity.id desc), '[]'::jsonb)
  into v_activity
  from (
    select id, actor_id, action, created_at
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
      'can_remove_any_link', v_role in ('owner', 'admin', 'manager')
    )
  );
end;
$$;

alter function public.create_task_custom_field(uuid, text, public.task_custom_field_type, text[]) owner to postgres;
alter function public.set_task_custom_field_value(uuid, uuid, integer, jsonb) owner to postgres;
alter function public.get_task_detail(uuid) owner to postgres;

revoke all on table public.task_custom_field_definitions from public, anon, authenticated;
revoke all on table public.task_custom_field_options from public, anon, authenticated;
revoke all on table public.task_custom_field_values from public, anon, authenticated;
grant select on table public.task_custom_field_definitions to authenticated;
grant select on table public.task_custom_field_options to authenticated;
grant select on table public.task_custom_field_values to authenticated;

revoke all on function public.create_task_custom_field(uuid, text, public.task_custom_field_type, text[]) from public, anon, authenticated;
revoke all on function public.set_task_custom_field_value(uuid, uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.get_task_detail(uuid) from public, anon, authenticated;
grant execute on function public.create_task_custom_field(uuid, text, public.task_custom_field_type, text[]) to authenticated;
grant execute on function public.set_task_custom_field_value(uuid, uuid, integer, jsonb) to authenticated;
grant execute on function public.get_task_detail(uuid) to authenticated;

comment on table public.task_custom_field_definitions is
  'Workspace-scoped task property definitions. Active fields are limited to twelve per workspace.';
comment on function public.set_task_custom_field_value(uuid, uuid, integer, jsonb) is
  'Validates and writes one custom task value with optimistic concurrency.';

commit;
