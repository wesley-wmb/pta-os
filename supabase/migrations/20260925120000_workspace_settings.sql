begin;

alter table public.workspaces
  add column if not exists version integer not null default 1;

alter table public.workspaces
  drop constraint if exists workspaces_version_positive;
alter table public.workspaces
  add constraint workspaces_version_positive check (version > 0);

create or replace function public.get_workspace_settings(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.workspace_role;
  v_workspace public.workspaces%rowtype;
  v_digest boolean;
  v_role_counts jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;

  v_role := private.current_workspace_role(p_workspace_id);
  if v_role is null then
    raise exception using errcode = '42501', message = 'PTA_WORKSPACE_FORBIDDEN';
  end if;

  select workspace.*
  into v_workspace
  from public.workspaces workspace
  where workspace.id = p_workspace_id
    and workspace.archived_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_WORKSPACE_NOT_FOUND';
  end if;

  select coalesce(preference.notification_digest, true)
  into v_digest
  from (select 1) seed
  left join public.workspace_preferences preference
    on preference.workspace_id = p_workspace_id;

  select coalesce(
    jsonb_object_agg(summary.role::text, summary.member_count),
    '{}'::jsonb
  )
  into v_role_counts
  from (
    select member.role, count(*)::integer as member_count
    from public.workspace_members member
    join public.profiles profile
      on profile.id = member.user_id
      and profile.is_active
    where member.workspace_id = p_workspace_id
      and member.status = 'active'::public.membership_status
      and member.removed_at is null
    group by member.role
  ) summary;

  return jsonb_build_object(
    'workspace_id', v_workspace.id,
    'name', v_workspace.name,
    'task_prefix', v_workspace.task_prefix,
    'accent_color', v_workspace.accent_color,
    'timezone', v_workspace.timezone,
    'locale', v_workspace.locale,
    'week_starts_on', v_workspace.week_starts_on,
    'working_days', to_jsonb(v_workspace.working_days),
    'default_due_time', to_char(v_workspace.default_due_time, 'HH24:MI'),
    'notification_digest', v_digest,
    'version', v_workspace.version,
    'role', v_role,
    'role_counts', v_role_counts,
    'permissions', jsonb_build_object(
      'can_edit', v_role in ('owner'::public.workspace_role, 'admin'::public.workspace_role),
      'can_manage_members', v_role in ('owner'::public.workspace_role, 'admin'::public.workspace_role),
      'can_transfer_ownership', v_role = 'owner'::public.workspace_role
    )
  );
end;
$$;

create or replace function public.update_workspace_settings(
  p_workspace_id uuid,
  p_expected_version integer,
  p_name text,
  p_task_prefix text,
  p_accent_color text,
  p_timezone text,
  p_week_starts_on smallint,
  p_working_days smallint[],
  p_default_due_time time without time zone,
  p_notification_digest boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_workspace public.workspaces%rowtype;
  v_working_days smallint[];
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;

  v_role := private.current_workspace_role(p_workspace_id);
  if v_role is null or v_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role
  ) then
    raise exception using errcode = '42501', message = 'PTA_WORKSPACE_SETTINGS_FORBIDDEN';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_WORKSPACE_NAME';
  end if;
  if upper(btrim(coalesce(p_task_prefix, ''))) !~ '^[A-Z0-9]{2,8}$' then
    raise exception using errcode = '22023', message = 'PTA_INVALID_TASK_PREFIX';
  end if;
  if coalesce(p_accent_color, '') !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception using errcode = '22023', message = 'PTA_INVALID_ACCENT_COLOR';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names zone where zone.name = p_timezone
  ) then
    raise exception using errcode = '22023', message = 'PTA_INVALID_TIMEZONE';
  end if;
  if p_week_starts_on not between 0 and 6 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_WEEK_START';
  end if;

  select array_agg(day order by day)::smallint[]
  into v_working_days
  from (
    select distinct unnest(p_working_days) as day
  ) normalized;

  if coalesce(cardinality(v_working_days), 0) = 0
    or not (v_working_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]) then
    raise exception using errcode = '22023', message = 'PTA_INVALID_WORKING_DAYS';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pta:workspace-settings:' || p_workspace_id::text, 0)
  );

  select workspace.*
  into v_workspace
  from public.workspaces workspace
  where workspace.id = p_workspace_id
    and workspace.archived_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_WORKSPACE_NOT_FOUND';
  end if;
  if v_workspace.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  update public.workspaces workspace
  set name = btrim(p_name),
      task_prefix = upper(btrim(p_task_prefix)),
      accent_color = upper(p_accent_color),
      timezone = p_timezone,
      week_starts_on = p_week_starts_on,
      working_days = v_working_days,
      default_due_time = p_default_due_time,
      version = workspace.version + 1
  where workspace.id = p_workspace_id;

  insert into public.workspace_preferences (
    workspace_id,
    notification_digest,
    updated_at
  ) values (
    p_workspace_id,
    p_notification_digest,
    statement_timestamp()
  )
  on conflict (workspace_id) do update
    set notification_digest = excluded.notification_digest,
        updated_at = excluded.updated_at;

  insert into public.activity_logs (
    workspace_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    changes_json
  ) values (
    p_workspace_id,
    v_actor,
    'workspace',
    p_workspace_id,
    'workspace.settings_updated',
    jsonb_build_object(
      'previous_version', v_workspace.version,
      'version', v_workspace.version + 1
    )
  );

  return public.get_workspace_settings(p_workspace_id);
end;
$$;

alter function public.get_workspace_settings(uuid) owner to postgres;
alter function public.update_workspace_settings(
  uuid, integer, text, text, text, text, smallint, smallint[],
  time without time zone, boolean
) owner to postgres;

revoke all on function public.get_workspace_settings(uuid)
  from public, anon, authenticated;
revoke all on function public.update_workspace_settings(
  uuid, integer, text, text, text, text, smallint, smallint[],
  time without time zone, boolean
) from public, anon, authenticated;

grant execute on function public.get_workspace_settings(uuid) to authenticated;
grant execute on function public.update_workspace_settings(
  uuid, integer, text, text, text, text, smallint, smallint[],
  time without time zone, boolean
) to authenticated;

revoke insert, update, delete, truncate on table public.workspaces
  from public, anon, authenticated;
revoke insert, update, delete, truncate on table public.workspace_preferences
  from public, anon, authenticated;

commit;
