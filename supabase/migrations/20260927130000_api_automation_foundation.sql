-- Workspace-scoped developer platform and durable task automation outbox.
-- Raw API tokens are returned once and only SHA-256 hashes are persisted.

begin;

create type public.automation_delivery_channel as enum ('slack', 'email', 'webhook');
create type public.automation_delivery_status as enum (
  'pending',
  'processing',
  'sent',
  'failed',
  'skipped'
);
create type public.workspace_integration_provider as enum ('slack', 'resend');
create type public.workspace_integration_status as enum ('active', 'attention', 'disconnected');

create extension if not exists supabase_vault with schema vault;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table public.workspace_api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  token_prefix text not null,
  token_hash bytea not null,
  scopes text[] not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  version integer not null default 1,
  unique (workspace_id, id),
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, revoked_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint workspace_api_keys_name_length
    check (char_length(btrim(name)) between 3 and 80),
  constraint workspace_api_keys_prefix_format
    check (token_prefix ~ '^pta_live_[a-f0-9]{10}$'),
  constraint workspace_api_keys_hash_length
    check (octet_length(token_hash) = 32),
  constraint workspace_api_keys_scopes_valid check (
    cardinality(scopes) between 1 and 8
    and scopes <@ array[
      'tasks:read',
      'tasks:write',
      'projects:read',
      'resources:read',
      'webhooks:manage'
    ]::text[]
  ),
  constraint workspace_api_keys_expiry_valid
    check (expires_at is null or expires_at > created_at),
  constraint workspace_api_keys_revocation_valid check (
    (revoked_at is null and revoked_by is null)
    or (revoked_at is not null and revoked_by is not null)
  ),
  constraint workspace_api_keys_version_valid check (version >= 1)
);

create unique index workspace_api_keys_token_hash_unique
  on public.workspace_api_keys (token_hash);
create index workspace_api_keys_active
  on public.workspace_api_keys (workspace_id, created_at desc)
  where revoked_at is null;

create table public.workspace_automation_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  slack_enabled boolean not null default false,
  email_enabled boolean not null default false,
  webhook_enabled boolean not null default false,
  corporate_email_domain text,
  notify_on_assignment boolean not null default true,
  notify_on_status_change boolean not null default true,
  notify_on_due_change boolean not null default true,
  notify_on_priority_change boolean not null default true,
  notify_on_content_change boolean not null default true,
  notify_on_comment boolean not null default true,
  collapse_window_seconds integer not null default 60,
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  foreign key (workspace_id, updated_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint workspace_automation_domain_format check (
    corporate_email_domain is null
    or corporate_email_domain ~ '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$'
  ),
  constraint workspace_automation_collapse_window
    check (collapse_window_seconds between 0 and 300),
  constraint workspace_automation_version_valid check (version >= 1)
);

create table public.workspace_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  endpoint_url text not null,
  event_types text[] not null,
  signing_secret_id uuid,
  is_active boolean not null default true,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  last_delivery_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failures integer not null default 0,
  version integer not null default 1,
  unique (workspace_id, id),
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, updated_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint workspace_webhook_name_length
    check (char_length(btrim(name)) between 3 and 80),
  constraint workspace_webhook_https_only
    check (endpoint_url ~ '^https://[^[:space:]]+$'),
  constraint workspace_webhook_events_valid check (
    cardinality(event_types) between 1 and 12
    and event_types <@ array[
      'task.assigned',
      'task.updated',
      'task.status_changed',
      'task.completed',
      'task.reopened',
      'task.comment_added',
      'task.archived'
    ]::text[]
  ),
  constraint workspace_webhook_failure_count_valid check (consecutive_failures >= 0),
  constraint workspace_webhook_version_valid check (version >= 1)
);

create index workspace_webhook_endpoints_active
  on public.workspace_webhook_endpoints (workspace_id, created_at desc)
  where is_active;

create table public.workspace_integrations (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider public.workspace_integration_provider not null,
  status public.workspace_integration_status not null default 'active',
  credential_secret_id uuid not null,
  public_config jsonb not null default '{}'::jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  primary key (workspace_id, provider),
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, updated_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint workspace_integrations_config_object
    check (jsonb_typeof(public_config) = 'object' and octet_length(public_config::text) <= 8000),
  constraint workspace_integrations_version_valid check (version >= 1)
);

create table public.task_automation_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_key text not null,
  task_id uuid not null,
  actor_id uuid,
  recipient_id uuid,
  event_type text not null,
  collapse_key text not null,
  payload jsonb not null,
  occurred_at timestamptz not null,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (source_key),
  foreign key (workspace_id, task_id)
    references public.tasks(workspace_id, id) on delete cascade,
  foreign key (workspace_id, actor_id)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, recipient_id)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint task_automation_event_type_valid check (
    event_type = any(array[
      'task.assigned',
      'task.updated',
      'task.status_changed',
      'task.completed',
      'task.reopened',
      'task.comment_added',
      'task.archived'
    ]::text[])
  ),
  constraint task_automation_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint task_automation_no_self_notification
    check (recipient_id is null or actor_id is distinct from recipient_id)
);

create index task_automation_events_available
  on public.task_automation_events (available_at, created_at)
  where recipient_id is not null;
create index task_automation_events_workspace_task
  on public.task_automation_events (workspace_id, task_id, occurred_at desc);

create table public.automation_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null,
  recipient_id uuid,
  channel public.automation_delivery_channel not null,
  status public.automation_delivery_status not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  external_destination_id text,
  external_message_id text,
  response_code integer,
  last_error_code text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, channel, recipient_id),
  foreign key (workspace_id, event_id)
    references public.task_automation_events(workspace_id, id) on delete cascade,
  foreign key (workspace_id, recipient_id)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint automation_delivery_attempts_valid check (attempt_count between 0 and 10),
  constraint automation_delivery_error_code_length
    check (last_error_code is null or char_length(last_error_code) <= 120)
);

create index automation_deliveries_pending
  on public.automation_deliveries (next_attempt_at, created_at)
  where status in ('pending', 'failed');

create or replace function private.require_workspace_admin(p_workspace_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
begin
  select member.role into v_role
  from public.workspace_members member
  where member.workspace_id = p_workspace_id
    and member.user_id = v_actor
    and member.status = 'active';

  if v_actor is null or v_role not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;

  return v_actor;
end;
$$;

create or replace function public.list_workspace_api_keys(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_workspace_admin(p_workspace_id);

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', key.id,
      'name', key.name,
      'prefix', key.token_prefix,
      'scopes', key.scopes,
      'created_at', key.created_at,
      'last_used_at', key.last_used_at,
      'expires_at', key.expires_at,
      'revoked_at', key.revoked_at,
      'version', key.version
    ) order by key.created_at desc)
    from public.workspace_api_keys key
    where key.workspace_id = p_workspace_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.create_workspace_api_key(
  p_workspace_id uuid,
  p_name text,
  p_scopes text[],
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_workspace_admin(p_workspace_id);
  v_secret text := encode(gen_random_bytes(32), 'hex');
  v_prefix text := 'pta_live_' || substr(v_secret, 1, 10);
  v_token text := v_prefix || '_' || v_secret;
  v_key public.workspace_api_keys%rowtype;
begin
  if p_name is null or char_length(btrim(p_name)) not between 3 and 80 then
    raise exception using errcode = '22023', message = 'PTA_API_KEY_NAME_INVALID';
  end if;
  if p_scopes is null
     or cardinality(p_scopes) not between 1 and 8
     or not p_scopes <@ array[
       'tasks:read', 'tasks:write', 'projects:read', 'resources:read', 'webhooks:manage'
     ]::text[] then
    raise exception using errcode = '22023', message = 'PTA_API_KEY_SCOPES_INVALID';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception using errcode = '22023', message = 'PTA_API_KEY_EXPIRY_INVALID';
  end if;

  insert into public.workspace_api_keys (
    workspace_id, name, token_prefix, token_hash, scopes, created_by, expires_at
  ) values (
    p_workspace_id,
    btrim(p_name),
    v_prefix,
    digest(v_token, 'sha256'),
    array(select distinct unnest(p_scopes) order by 1),
    v_actor,
    p_expires_at
  ) returning * into v_key;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, metadata_json
  ) values (
    p_workspace_id,
    v_actor,
    'workspace_api_key',
    v_key.id,
    'workspace_api_key.created',
    jsonb_build_object('prefix', v_prefix, 'scopes', v_key.scopes)
  );

  return jsonb_build_object(
    'id', v_key.id,
    'name', v_key.name,
    'prefix', v_key.token_prefix,
    'token', v_token,
    'scopes', v_key.scopes,
    'created_at', v_key.created_at,
    'expires_at', v_key.expires_at,
    'version', v_key.version
  );
end;
$$;

create or replace function public.revoke_workspace_api_key(
  p_workspace_id uuid,
  p_key_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_workspace_admin(p_workspace_id);
  v_key public.workspace_api_keys%rowtype;
begin
  update public.workspace_api_keys key
  set revoked_at = coalesce(key.revoked_at, clock_timestamp()),
      revoked_by = coalesce(key.revoked_by, v_actor),
      version = key.version + 1
  where key.workspace_id = p_workspace_id
    and key.id = p_key_id
    and key.version = p_expected_version
  returning * into v_key;

  if not found then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, metadata_json
  ) values (
    p_workspace_id,
    v_actor,
    'workspace_api_key',
    v_key.id,
    'workspace_api_key.revoked',
    jsonb_build_object('prefix', v_key.token_prefix)
  );

  return jsonb_build_object(
    'id', v_key.id,
    'revoked_at', v_key.revoked_at,
    'version', v_key.version
  );
end;
$$;

create or replace function public.get_workspace_automation_settings(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.workspace_automation_settings%rowtype;
begin
  if not private.is_active_workspace_member(p_workspace_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;

  select * into v_settings
  from public.workspace_automation_settings settings
  where settings.workspace_id = p_workspace_id;

  return jsonb_build_object(
    'slack_enabled', coalesce(v_settings.slack_enabled, false),
    'email_enabled', coalesce(v_settings.email_enabled, false),
    'webhook_enabled', coalesce(v_settings.webhook_enabled, false),
    'corporate_email_domain', v_settings.corporate_email_domain,
    'notify_on_assignment', coalesce(v_settings.notify_on_assignment, true),
    'notify_on_status_change', coalesce(v_settings.notify_on_status_change, true),
    'notify_on_due_change', coalesce(v_settings.notify_on_due_change, true),
    'notify_on_priority_change', coalesce(v_settings.notify_on_priority_change, true),
    'notify_on_content_change', coalesce(v_settings.notify_on_content_change, true),
    'notify_on_comment', coalesce(v_settings.notify_on_comment, true),
    'collapse_window_seconds', coalesce(v_settings.collapse_window_seconds, 60),
    'version', coalesce(v_settings.version, 0)
  );
end;
$$;

create or replace function public.list_workspace_integrations(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_workspace_admin(p_workspace_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'provider', integration.provider,
      'status', integration.status,
      'public_config', integration.public_config,
      'updated_at', integration.updated_at,
      'version', integration.version
    ) order by integration.provider)
    from public.workspace_integrations integration
    where integration.workspace_id = p_workspace_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.configure_workspace_integration(
  p_workspace_id uuid,
  p_provider public.workspace_integration_provider,
  p_credential text,
  p_public_config jsonb,
  p_expected_version integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_workspace_admin(p_workspace_id);
  v_current public.workspace_integrations%rowtype;
  v_integration public.workspace_integrations%rowtype;
  v_secret_id uuid;
begin
  if p_credential is null or char_length(p_credential) not between 20 and 10000 then
    raise exception using errcode = '22023', message = 'PTA_INTEGRATION_CREDENTIAL_INVALID';
  end if;
  if p_public_config is null or jsonb_typeof(p_public_config) <> 'object'
     or octet_length(p_public_config::text) > 8000 then
    raise exception using errcode = '22023', message = 'PTA_INTEGRATION_CONFIG_INVALID';
  end if;

  select * into v_current
  from public.workspace_integrations integration
  where integration.workspace_id = p_workspace_id
    and integration.provider = p_provider
  for update;

  if found and v_current.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  elsif not found and p_expected_version <> 0 then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  if v_current.credential_secret_id is null then
    select vault.create_secret(
      p_credential,
      concat('pta:', p_workspace_id, ':', p_provider),
      concat('PTA OS ', p_provider, ' integration')
    ) into v_secret_id;
  else
    v_secret_id := v_current.credential_secret_id;
    perform vault.update_secret(v_secret_id, p_credential);
  end if;

  insert into public.workspace_integrations (
    workspace_id, provider, status, credential_secret_id, public_config,
    created_by, updated_by
  ) values (
    p_workspace_id, p_provider, 'active', v_secret_id, p_public_config,
    v_actor, v_actor
  )
  on conflict (workspace_id, provider) do update set
    status = 'active',
    credential_secret_id = excluded.credential_secret_id,
    public_config = excluded.public_config,
    updated_by = excluded.updated_by,
    updated_at = clock_timestamp(),
    version = public.workspace_integrations.version + 1
  returning * into v_integration;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, metadata_json
  ) values (
    p_workspace_id,
    v_actor,
    'workspace_integration',
    p_workspace_id,
    'workspace_integration.configured',
    jsonb_build_object('provider', p_provider, 'status', v_integration.status)
  );

  return jsonb_build_object(
    'provider', v_integration.provider,
    'status', v_integration.status,
    'public_config', v_integration.public_config,
    'updated_at', v_integration.updated_at,
    'version', v_integration.version
  );
end;
$$;

create or replace function public.update_workspace_automation_settings(
  p_workspace_id uuid,
  p_expected_version integer,
  p_slack_enabled boolean,
  p_email_enabled boolean,
  p_webhook_enabled boolean,
  p_corporate_email_domain text,
  p_notify_on_assignment boolean,
  p_notify_on_status_change boolean,
  p_notify_on_due_change boolean,
  p_notify_on_priority_change boolean,
  p_notify_on_content_change boolean,
  p_notify_on_comment boolean,
  p_collapse_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_workspace_admin(p_workspace_id);
  v_current public.workspace_automation_settings%rowtype;
  v_settings public.workspace_automation_settings%rowtype;
  v_domain text := nullif(lower(btrim(p_corporate_email_domain)), '');
begin
  if p_collapse_window_seconds not between 0 and 300 then
    raise exception using errcode = '22023', message = 'PTA_AUTOMATION_WINDOW_INVALID';
  end if;
  if p_webhook_enabled then
    raise exception using errcode = '0A000', message = 'PTA_WEBHOOKS_NOT_AVAILABLE';
  end if;
  if p_slack_enabled and not exists (
    select 1 from public.workspace_integrations integration
    where integration.workspace_id = p_workspace_id
      and integration.provider = 'slack'
      and integration.status = 'active'
  ) then
    raise exception using errcode = '23514', message = 'PTA_SLACK_INTEGRATION_REQUIRED';
  end if;
  if p_email_enabled and not exists (
    select 1 from public.workspace_integrations integration
    where integration.workspace_id = p_workspace_id
      and integration.provider = 'resend'
      and integration.status = 'active'
  ) then
    raise exception using errcode = '23514', message = 'PTA_EMAIL_INTEGRATION_REQUIRED';
  end if;
  if v_domain is not null
     and v_domain !~ '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$' then
    raise exception using errcode = '22023', message = 'PTA_AUTOMATION_DOMAIN_INVALID';
  end if;

  select * into v_current
  from public.workspace_automation_settings settings
  where settings.workspace_id = p_workspace_id
  for update;

  if found and v_current.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  elsif not found and p_expected_version <> 0 then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  insert into public.workspace_automation_settings (
    workspace_id,
    slack_enabled,
    email_enabled,
    webhook_enabled,
    corporate_email_domain,
    notify_on_assignment,
    notify_on_status_change,
    notify_on_due_change,
    notify_on_priority_change,
    notify_on_content_change,
    notify_on_comment,
    collapse_window_seconds,
    updated_by,
    version
  ) values (
    p_workspace_id,
    p_slack_enabled,
    p_email_enabled,
    p_webhook_enabled,
    v_domain,
    p_notify_on_assignment,
    p_notify_on_status_change,
    p_notify_on_due_change,
    p_notify_on_priority_change,
    p_notify_on_content_change,
    p_notify_on_comment,
    p_collapse_window_seconds,
    v_actor,
    1
  )
  on conflict (workspace_id) do update set
    slack_enabled = excluded.slack_enabled,
    email_enabled = excluded.email_enabled,
    webhook_enabled = excluded.webhook_enabled,
    corporate_email_domain = excluded.corporate_email_domain,
    notify_on_assignment = excluded.notify_on_assignment,
    notify_on_status_change = excluded.notify_on_status_change,
    notify_on_due_change = excluded.notify_on_due_change,
    notify_on_priority_change = excluded.notify_on_priority_change,
    notify_on_content_change = excluded.notify_on_content_change,
    notify_on_comment = excluded.notify_on_comment,
    collapse_window_seconds = excluded.collapse_window_seconds,
    updated_by = excluded.updated_by,
    updated_at = clock_timestamp(),
    version = public.workspace_automation_settings.version + 1
  returning * into v_settings;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, metadata_json
  ) values (
    p_workspace_id,
    v_actor,
    'workspace',
    p_workspace_id,
    'workspace.automation_settings_updated',
    jsonb_build_object(
      'slack_enabled', v_settings.slack_enabled,
      'email_enabled', v_settings.email_enabled,
      'webhook_enabled', v_settings.webhook_enabled,
      'collapse_window_seconds', v_settings.collapse_window_seconds
    )
  );

  return public.get_workspace_automation_settings(p_workspace_id);
end;
$$;

create or replace function private.authenticate_workspace_api_key(
  p_token text,
  p_required_scope text
)
returns table (key_id uuid, workspace_id uuid, actor_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null or p_token !~ '^pta_live_[a-f0-9]{10}_[a-f0-9]{64}$' then
    return;
  end if;

  return query
  update public.workspace_api_keys key
  set last_used_at = clock_timestamp()
  from public.workspace_members member
  where key.token_hash = digest(p_token, 'sha256')
    and key.revoked_at is null
    and (key.expires_at is null or key.expires_at > now())
    and p_required_scope = any(key.scopes)
    and member.workspace_id = key.workspace_id
    and member.user_id = key.created_by
    and member.status = 'active'
    and member.role in ('owner', 'admin')
  returning key.id, key.workspace_id, key.created_by;
end;
$$;

create or replace function private.assume_api_actor(p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_actor_id, 'role', 'authenticated')::text,
    true
  );
end;
$$;

create or replace function public.api_list_tasks(
  p_token text,
  p_limit integer default 50,
  p_before_updated_at timestamptz default null,
  p_before_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth record;
  v_items jsonb;
  v_next_updated_at timestamptz;
  v_next_id uuid;
  v_has_more boolean;
begin
  select * into v_auth
  from private.authenticate_workspace_api_key(p_token, 'tasks:read');
  if not found then
    raise exception using errcode = '28000', message = 'PTA_API_KEY_INVALID';
  end if;
  if p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'PTA_API_LIMIT_INVALID';
  end if;

  with page as (
    select task.*
    from public.v_task_overview task
    where task.workspace_id = v_auth.workspace_id
      and (
        p_before_updated_at is null
        or (task.updated_at, task.id) < (p_before_updated_at, p_before_id)
      )
    order by task.updated_at desc, task.id desc
    limit p_limit + 1
  ), visible as (
    select * from page
    order by updated_at desc, id desc
    limit p_limit
  )
  select
    coalesce(jsonb_agg(to_jsonb(visible) order by updated_at desc, id desc), '[]'::jsonb),
    (select count(*) > p_limit from page),
    (select updated_at from visible order by updated_at desc, id desc offset greatest(p_limit - 1, 0) limit 1),
    (select id from visible order by updated_at desc, id desc offset greatest(p_limit - 1, 0) limit 1)
  into v_items, v_has_more, v_next_updated_at, v_next_id
  from visible;

  return jsonb_build_object(
    'data', v_items,
    'next_cursor', case
      when not v_has_more or v_next_id is null then null
      else jsonb_build_object('updated_at', v_next_updated_at, 'id', v_next_id)
    end
  );
end;
$$;

create or replace function public.api_get_task(p_token text, p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth record;
  v_task jsonb;
begin
  select * into v_auth
  from private.authenticate_workspace_api_key(p_token, 'tasks:read');
  if not found then
    raise exception using errcode = '28000', message = 'PTA_API_KEY_INVALID';
  end if;

  select to_jsonb(task) into v_task
  from public.v_task_overview task
  where task.workspace_id = v_auth.workspace_id and task.id = p_task_id;
  if v_task is null then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;
  return jsonb_build_object('data', v_task);
end;
$$;

create or replace function public.api_create_task(
  p_token text,
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
  v_auth record;
begin
  select * into v_auth
  from private.authenticate_workspace_api_key(p_token, 'tasks:write');
  if not found then
    raise exception using errcode = '28000', message = 'PTA_API_KEY_INVALID';
  end if;
  perform private.assume_api_actor(v_auth.actor_id);
  return public.create_global_task(
    v_auth.workspace_id,
    p_title,
    p_status_id,
    p_priority,
    p_due_date,
    p_due_time,
    p_primary_assignee_id,
    p_type_id,
    p_product_id,
    p_event_id,
    p_description,
    p_blocked_reason
  );
end;
$$;

create or replace function public.api_update_task(
  p_token text,
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
  v_auth record;
begin
  select * into v_auth
  from private.authenticate_workspace_api_key(p_token, 'tasks:write');
  if not found then
    raise exception using errcode = '28000', message = 'PTA_API_KEY_INVALID';
  end if;
  if not exists (
    select 1 from public.tasks task
    where task.workspace_id = v_auth.workspace_id and task.id = p_task_id
  ) then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;
  perform private.assume_api_actor(v_auth.actor_id);
  return public.update_task(p_task_id, p_expected_version, p_patch);
end;
$$;

create or replace function public.api_set_task_assignee(
  p_token text,
  p_task_id uuid,
  p_user_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth record;
begin
  select * into v_auth
  from private.authenticate_workspace_api_key(p_token, 'tasks:write');
  if not found then
    raise exception using errcode = '28000', message = 'PTA_API_KEY_INVALID';
  end if;
  if not exists (
    select 1 from public.tasks task
    where task.workspace_id = v_auth.workspace_id and task.id = p_task_id
  ) then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;
  perform private.assume_api_actor(v_auth.actor_id);
  return public.set_task_primary_assignee(p_task_id, p_user_id, p_expected_version);
end;
$$;

create or replace function public.api_add_task_comment(
  p_token text,
  p_task_id uuid,
  p_body text,
  p_parent_comment_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth record;
begin
  select * into v_auth
  from private.authenticate_workspace_api_key(p_token, 'tasks:write');
  if not found then
    raise exception using errcode = '28000', message = 'PTA_API_KEY_INVALID';
  end if;
  if not exists (
    select 1 from public.tasks task
    where task.workspace_id = v_auth.workspace_id and task.id = p_task_id
  ) then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;
  perform private.assume_api_actor(v_auth.actor_id);
  return public.add_task_comment(p_task_id, p_body, p_parent_comment_id);
end;
$$;

create or replace function private.enqueue_task_automation_event(
  p_workspace_id uuid,
  p_task_id uuid,
  p_actor_id uuid,
  p_event_type text,
  p_source_key text,
  p_changes jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.workspace_automation_settings%rowtype;
  v_task public.tasks%rowtype;
  v_assignee_id uuid;
  v_assigned_by uuid;
  v_recipient_id uuid;
  v_event_type text;
  v_status_name text;
  v_status_category public.task_status_category;
  v_project_name text;
  v_recipient_email text;
  v_payload jsonb;
  v_event_id uuid;
begin
  select * into v_settings
  from public.workspace_automation_settings settings
  where settings.workspace_id = p_workspace_id;

  if not found or not (
    v_settings.slack_enabled or v_settings.email_enabled or v_settings.webhook_enabled
  ) then
    return null;
  end if;

  select task.* into v_task
  from public.tasks task
  where task.workspace_id = p_workspace_id and task.id = p_task_id;
  if not found then return null; end if;

  select assignee.user_id, assignee.assigned_by
  into v_assignee_id, v_assigned_by
  from public.task_assignees assignee
  where assignee.workspace_id = p_workspace_id
    and assignee.task_id = p_task_id
    and assignee.is_primary
  limit 1;

  if p_event_type = 'task.assigned' and v_settings.notify_on_assignment then
    v_event_type := p_event_type;
    v_recipient_id := nullif(p_metadata ->> 'user_id', '')::uuid;
  elsif p_event_type = 'task.comment_added' and v_settings.notify_on_comment then
    v_event_type := p_event_type;
    v_recipient_id := case
      when p_actor_id = v_assignee_id then coalesce(v_task.created_by, v_assigned_by)
      else v_assignee_id
    end;
  elsif p_event_type = 'task.archived' then
    v_event_type := p_event_type;
    v_recipient_id := case
      when p_actor_id = v_assignee_id then coalesce(v_task.created_by, v_assigned_by)
      else v_assignee_id
    end;
  elsif p_event_type in ('task.updated', 'task.status_changed', 'task.completed', 'task.reopened') then
    if p_event_type in ('task.status_changed', 'task.completed', 'task.reopened')
       and v_settings.notify_on_status_change then
      select status.name, status.system_category into v_status_name, v_status_category
      from public.task_statuses status
      where status.workspace_id = p_workspace_id and status.id = v_task.status_id;
      v_event_type := p_event_type;
    elsif p_changes ? 'due' and v_settings.notify_on_due_change then
      v_event_type := p_event_type;
    elsif p_changes ? 'priority' and v_settings.notify_on_priority_change then
      v_event_type := p_event_type;
    elsif (p_changes ? 'title' or p_changes ? 'description' or p_changes ? 'project')
          and v_settings.notify_on_content_change then
      v_event_type := p_event_type;
    else
      return null;
    end if;
    v_recipient_id := case
      when p_actor_id = v_assignee_id then coalesce(v_task.created_by, v_assigned_by)
      else v_assignee_id
    end;
  else
    return null;
  end if;

  if p_event_type <> 'task.assigned' and p_actor_id = v_assignee_id then
    select candidate.user_id, lower(profile.email)
    into v_recipient_id, v_recipient_email
    from (
      values (v_task.created_by, 1), (v_assigned_by, 2)
    ) as candidate(user_id, preference)
    join public.workspace_members member
      on member.workspace_id = p_workspace_id
      and member.user_id = candidate.user_id
      and member.status = 'active'
    join public.profiles profile
      on profile.id = candidate.user_id
      and profile.is_active
    where candidate.user_id is distinct from p_actor_id
      and (
        v_settings.corporate_email_domain is null
        or lower(split_part(profile.email, '@', 2)) = v_settings.corporate_email_domain
      )
    order by candidate.preference
    limit 1;
  else
    select lower(profile.email) into v_recipient_email
    from public.workspace_members member
    join public.profiles profile
      on profile.id = member.user_id
      and profile.is_active
    where member.workspace_id = p_workspace_id
      and member.user_id = v_recipient_id
      and member.status = 'active'
      and v_recipient_id is distinct from p_actor_id
      and (
        v_settings.corporate_email_domain is null
        or lower(split_part(profile.email, '@', 2)) = v_settings.corporate_email_domain
      );
  end if;

  if v_recipient_id is null or v_recipient_email is null then return null; end if;

  if v_status_name is null then
    select status.name into v_status_name
    from public.task_statuses status
    where status.workspace_id = p_workspace_id and status.id = v_task.status_id;
  end if;
  select project.name into v_project_name
  from public.events project
  where project.workspace_id = p_workspace_id and project.id = v_task.event_id;

  v_payload := jsonb_build_object(
    'task_id', v_task.id,
    'task_number', v_task.task_number,
    'task_title', v_task.title,
    'project_id', v_task.event_id,
    'project_name', coalesce(v_project_name, 'Sem projeto'),
    'status_id', v_task.status_id,
    'status_name', v_status_name,
    'due_date', v_task.due_date,
    'recipient_email', lower(v_recipient_email),
    'changes', p_changes,
    'metadata', p_metadata
  );

  insert into public.task_automation_events (
    workspace_id, source_key, task_id, actor_id, recipient_id,
    event_type, collapse_key, payload, occurred_at
  ) values (
    p_workspace_id,
    p_source_key,
    p_task_id,
    p_actor_id,
    v_recipient_id,
    v_event_type,
    concat(p_workspace_id, ':', p_task_id, ':', v_recipient_id),
    v_payload,
    p_occurred_at
  )
  on conflict (source_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then return null; end if;

  if v_settings.slack_enabled then
    insert into public.automation_deliveries (
      workspace_id, event_id, recipient_id, channel
    ) values (p_workspace_id, v_event_id, v_recipient_id, 'slack')
    on conflict do nothing;
  end if;
  if v_settings.email_enabled then
    insert into public.automation_deliveries (
      workspace_id, event_id, recipient_id, channel, next_attempt_at
    ) values (
      p_workspace_id,
      v_event_id,
      v_recipient_id,
      'email',
      p_occurred_at + make_interval(secs => v_settings.collapse_window_seconds)
    )
    on conflict do nothing;
  end if;
  if v_settings.webhook_enabled then
    insert into public.automation_deliveries (
      workspace_id, event_id, recipient_id, channel
    ) values (p_workspace_id, v_event_id, v_recipient_id, 'webhook')
    on conflict do nothing;
  end if;

  return v_event_id;
end;
$$;

create or replace function public.claim_automation_deliveries(p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'PTA_DELIVERY_LIMIT_INVALID';
  end if;

  update public.automation_deliveries stale
  set status = 'skipped',
      last_error_code = 'COLLAPSED_INTO_NEWER_EVENT',
      locked_at = null,
      updated_at = clock_timestamp()
  from public.task_automation_events stale_event
  left join public.workspace_automation_settings settings
    on settings.workspace_id = stale_event.workspace_id
  where stale.event_id = stale_event.id
    and stale.channel in ('slack', 'email')
    and stale.status in ('pending', 'failed')
    and exists (
      select 1
      from public.automation_deliveries newer
      join public.task_automation_events newer_event
        on newer_event.id = newer.event_id
      where newer.workspace_id = stale.workspace_id
        and newer.channel = stale.channel
        and newer.recipient_id = stale.recipient_id
        and newer.status in ('pending', 'failed')
        and newer_event.collapse_key = stale_event.collapse_key
        and newer_event.occurred_at > stale_event.occurred_at
        and newer_event.occurred_at <= stale_event.occurred_at + make_interval(
          secs => coalesce(settings.collapse_window_seconds, 60)
        )
    );

  with candidates as (
    select delivery.id
    from public.automation_deliveries delivery
    join public.workspace_integrations integration
      on integration.workspace_id = delivery.workspace_id
      and integration.provider = case delivery.channel
        when 'slack' then 'slack'::public.workspace_integration_provider
        when 'email' then 'resend'::public.workspace_integration_provider
        else null
      end
      and integration.status = 'active'
    where delivery.channel in ('slack', 'email')
      and delivery.status in ('pending', 'failed')
      and delivery.next_attempt_at <= now()
      and (delivery.locked_at is null or delivery.locked_at < now() - interval '5 minutes')
    order by delivery.next_attempt_at, delivery.created_at
    for update of delivery skip locked
    limit p_limit
  ), claimed as (
    update public.automation_deliveries delivery
    set status = 'processing',
        attempt_count = delivery.attempt_count + 1,
        locked_at = clock_timestamp(),
        updated_at = clock_timestamp()
    from candidates
    where delivery.id = candidates.id
    returning delivery.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'delivery_id', claimed.id,
    'workspace_id', claimed.workspace_id,
    'channel', claimed.channel,
    'attempt_count', claimed.attempt_count,
    'event_type', event.event_type,
    'collapse_key', event.collapse_key,
    'occurred_at', event.occurred_at,
    'payload', event.payload,
    'credential', secret.decrypted_secret,
    'public_config', integration.public_config,
    'previous_destination_id', (
      select previous.external_destination_id
      from public.automation_deliveries previous
      join public.task_automation_events previous_event
        on previous_event.id = previous.event_id
      where previous.channel = claimed.channel
        and previous.status = 'sent'
        and previous_event.collapse_key = event.collapse_key
        and previous.sent_at >= event.occurred_at - make_interval(
          secs => coalesce(settings.collapse_window_seconds, 60)
        )
      order by previous.sent_at desc
      limit 1
    ),
    'previous_message_id', (
      select previous.external_message_id
      from public.automation_deliveries previous
      join public.task_automation_events previous_event
        on previous_event.id = previous.event_id
      where previous.channel = claimed.channel
        and previous.status = 'sent'
        and previous_event.collapse_key = event.collapse_key
        and previous.sent_at >= event.occurred_at - make_interval(
          secs => coalesce(settings.collapse_window_seconds, 60)
        )
      order by previous.sent_at desc
      limit 1
    )
  ) order by claimed.created_at), '[]'::jsonb)
  into v_result
  from claimed
  join public.task_automation_events event on event.id = claimed.event_id
  join public.workspace_integrations integration
    on integration.workspace_id = claimed.workspace_id
    and integration.provider = case claimed.channel
      when 'slack' then 'slack'::public.workspace_integration_provider
      else 'resend'::public.workspace_integration_provider
    end
  join vault.decrypted_secrets secret on secret.id = integration.credential_secret_id
  left join public.workspace_automation_settings settings
    on settings.workspace_id = claimed.workspace_id;

  return v_result;
end;
$$;

create or replace function public.complete_automation_delivery(
  p_delivery_id uuid,
  p_success boolean,
  p_external_destination_id text default null,
  p_external_message_id text default null,
  p_response_code integer default null,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.automation_deliveries delivery
  set status = case
        when p_success then 'sent'::public.automation_delivery_status
        when delivery.attempt_count >= 5 then 'skipped'::public.automation_delivery_status
        else 'failed'::public.automation_delivery_status
      end,
      external_destination_id = coalesce(p_external_destination_id, delivery.external_destination_id),
      external_message_id = coalesce(p_external_message_id, delivery.external_message_id),
      response_code = p_response_code,
      last_error_code = case when p_success then null else left(p_error_code, 120) end,
      sent_at = case when p_success then clock_timestamp() else delivery.sent_at end,
      next_attempt_at = case
        when p_success or delivery.attempt_count >= 5 then delivery.next_attempt_at
        else clock_timestamp() + make_interval(
          secs => least(21600, (30 * power(4, greatest(delivery.attempt_count - 1, 0)))::integer)
        )
      end,
      locked_at = null,
      updated_at = clock_timestamp()
  where delivery.id = p_delivery_id
    and delivery.status = 'processing';
end;
$$;

create or replace function private.invoke_automation_dispatcher()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_dispatch_secret text;
  v_request_id bigint;
begin
  select secret.decrypted_secret into v_url
  from vault.decrypted_secrets secret
  where secret.name = 'pta_automation_dispatcher_url'
  order by secret.created_at desc
  limit 1;

  select secret.decrypted_secret into v_dispatch_secret
  from vault.decrypted_secrets secret
  where secret.name = 'pta_dispatch_secret'
  order by secret.created_at desc
  limit 1;

  if v_url is null or v_dispatch_secret is null then
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-dispatch-secret', v_dispatch_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  ) into v_request_id;

  return v_request_id;
end;
$$;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'pta-automation-dispatcher-every-minute'
  ) then
    perform cron.schedule(
      'pta-automation-dispatcher-every-minute',
      '* * * * *',
      'select private.invoke_automation_dispatcher();'
    );
  end if;
end;
$$;

create or replace function private.tasks_enqueue_automation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes jsonb := '{}'::jsonb;
  v_event_type text := 'task.updated';
  v_old_category public.task_status_category;
  v_new_category public.task_status_category;
begin
  if tg_op <> 'UPDATE' then return new; end if;

  if old.archived_at is null and new.archived_at is not null then
    v_event_type := 'task.archived';
  elsif new.status_id is distinct from old.status_id then
    select status.system_category into v_old_category
    from public.task_statuses status
    where status.workspace_id = new.workspace_id and status.id = old.status_id;
    select status.system_category into v_new_category
    from public.task_statuses status
    where status.workspace_id = new.workspace_id and status.id = new.status_id;
    v_event_type := case
      when v_new_category = 'done' then 'task.completed'
      when v_old_category = 'done' then 'task.reopened'
      else 'task.status_changed'
    end;
    v_changes := v_changes || jsonb_build_object(
      'status_id', jsonb_build_object('old', old.status_id, 'new', new.status_id)
    );
  end if;
  if new.title is distinct from old.title then
    v_changes := v_changes || jsonb_build_object(
      'title', jsonb_build_object('old', old.title, 'new', new.title)
    );
  end if;
  if new.description_json is distinct from old.description_json then
    v_changes := v_changes || jsonb_build_object('description', true);
  end if;
  if new.priority is distinct from old.priority then
    v_changes := v_changes || jsonb_build_object(
      'priority', jsonb_build_object('old', old.priority, 'new', new.priority)
    );
  end if;
  if new.due_date is distinct from old.due_date or new.due_time is distinct from old.due_time then
    v_changes := v_changes || jsonb_build_object('due', jsonb_build_object(
      'old', jsonb_build_object('date', old.due_date, 'time', old.due_time),
      'new', jsonb_build_object('date', new.due_date, 'time', new.due_time)
    ));
  end if;
  if new.event_id is distinct from old.event_id then
    v_changes := v_changes || jsonb_build_object(
      'project', jsonb_build_object('old', old.event_id, 'new', new.event_id)
    );
  end if;

  if v_event_type = 'task.updated' and v_changes = '{}'::jsonb then return new; end if;

  perform private.enqueue_task_automation_event(
    new.workspace_id,
    new.id,
    new.updated_by,
    v_event_type,
    concat('tasks:', new.id, ':', new.version),
    v_changes,
    '{}'::jsonb,
    new.updated_at
  );
  return new;
end;
$$;

create or replace function private.assignees_enqueue_automation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or not new.is_primary then return null; end if;
  if tg_op = 'UPDATE' and old.user_id = new.user_id and old.is_primary = new.is_primary then
    return null;
  end if;

  perform private.enqueue_task_automation_event(
    new.workspace_id,
    new.task_id,
    coalesce(auth.uid(), new.assigned_by),
    'task.assigned',
    concat('assignee:', new.task_id, ':', new.user_id, ':', extract(epoch from new.assigned_at)::numeric),
    '{}'::jsonb,
    jsonb_build_object('user_id', new.user_id),
    new.assigned_at
  );
  return null;
end;
$$;

create or replace function private.comments_enqueue_automation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue_task_automation_event(
    new.workspace_id,
    new.task_id,
    new.created_by,
    'task.comment_added',
    concat('comment:', new.id),
    '{}'::jsonb,
    jsonb_build_object('comment_id', new.id),
    new.created_at
  );
  return new;
end;
$$;

create trigger tasks_enqueue_automation
after update on public.tasks
for each row execute function private.tasks_enqueue_automation();

create trigger assignees_enqueue_automation
after insert or update on public.task_assignees
for each row execute function private.assignees_enqueue_automation();

create trigger comments_enqueue_automation
after insert on public.task_comments
for each row execute function private.comments_enqueue_automation();

alter table public.workspace_api_keys enable row level security;
alter table public.workspace_api_keys force row level security;
alter table public.workspace_automation_settings enable row level security;
alter table public.workspace_automation_settings force row level security;
alter table public.workspace_webhook_endpoints enable row level security;
alter table public.workspace_webhook_endpoints force row level security;
alter table public.workspace_integrations enable row level security;
alter table public.workspace_integrations force row level security;
alter table public.task_automation_events enable row level security;
alter table public.task_automation_events force row level security;
alter table public.automation_deliveries enable row level security;
alter table public.automation_deliveries force row level security;

create policy workspace_api_keys_admin_select
on public.workspace_api_keys for select to authenticated
using (
  private.current_workspace_role(workspace_id) in ('owner', 'admin')
);
create policy workspace_automation_settings_member_select
on public.workspace_automation_settings for select to authenticated
using (private.is_active_workspace_member(workspace_id));
create policy workspace_webhook_endpoints_admin_select
on public.workspace_webhook_endpoints for select to authenticated
using (
  private.current_workspace_role(workspace_id) in ('owner', 'admin')
);
create policy workspace_integrations_admin_select
on public.workspace_integrations for select to authenticated
using (
  private.current_workspace_role(workspace_id) in ('owner', 'admin')
);

revoke all on
  public.workspace_api_keys,
  public.workspace_automation_settings,
  public.workspace_webhook_endpoints,
  public.workspace_integrations,
  public.task_automation_events,
  public.automation_deliveries
from public, anon, authenticated;
grant select on public.workspace_api_keys, public.workspace_webhook_endpoints
  to authenticated;
grant select on public.workspace_integrations to authenticated;
grant select on public.workspace_automation_settings to authenticated;

revoke all on function private.require_workspace_admin(uuid) from public, anon, authenticated;
revoke all on function private.authenticate_workspace_api_key(text, text) from public, anon, authenticated;
revoke all on function private.assume_api_actor(uuid) from public, anon, authenticated;
revoke all on function private.invoke_automation_dispatcher()
  from public, anon, authenticated;
revoke all on function public.claim_automation_deliveries(integer)
  from public, anon, authenticated;
revoke all on function public.complete_automation_delivery(
  uuid, boolean, text, text, integer, text
) from public, anon, authenticated;
grant execute on function public.claim_automation_deliveries(integer) to service_role;
grant execute on function public.complete_automation_delivery(
  uuid, boolean, text, text, integer, text
) to service_role;
revoke all on function public.list_workspace_api_keys(uuid) from public, anon, authenticated;
revoke all on function public.create_workspace_api_key(uuid, text, text[], timestamptz)
  from public, anon, authenticated;
revoke all on function public.revoke_workspace_api_key(uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.get_workspace_automation_settings(uuid)
  from public, anon, authenticated;
revoke all on function public.list_workspace_integrations(uuid)
  from public, anon, authenticated;
revoke all on function public.configure_workspace_integration(
  uuid, public.workspace_integration_provider, text, jsonb, integer
) from public, anon, authenticated;
revoke all on function public.update_workspace_automation_settings(
  uuid, integer, boolean, boolean, boolean, text,
  boolean, boolean, boolean, boolean, boolean, boolean, integer
) from public, anon, authenticated;
grant execute on function public.list_workspace_api_keys(uuid) to authenticated;
grant execute on function public.create_workspace_api_key(uuid, text, text[], timestamptz)
  to authenticated;
grant execute on function public.revoke_workspace_api_key(uuid, uuid, integer)
  to authenticated;
grant execute on function public.get_workspace_automation_settings(uuid)
  to authenticated;
grant execute on function public.list_workspace_integrations(uuid)
  to authenticated;
grant execute on function public.configure_workspace_integration(
  uuid, public.workspace_integration_provider, text, jsonb, integer
) to authenticated;
grant execute on function public.update_workspace_automation_settings(
  uuid, integer, boolean, boolean, boolean, text,
  boolean, boolean, boolean, boolean, boolean, boolean, integer
) to authenticated;

revoke all on function public.api_list_tasks(text, integer, timestamptz, uuid)
  from public, anon, authenticated;
revoke all on function public.api_get_task(text, uuid)
  from public, anon, authenticated;
revoke all on function public.api_create_task(
  text, text, uuid, public.task_priority, date, time without time zone,
  uuid, uuid, uuid, uuid, jsonb, text
) from public, anon, authenticated;
revoke all on function public.api_update_task(text, uuid, integer, jsonb)
  from public, anon, authenticated;
revoke all on function public.api_set_task_assignee(text, uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.api_add_task_comment(text, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.api_list_tasks(text, integer, timestamptz, uuid)
  to service_role;
grant execute on function public.api_get_task(text, uuid) to service_role;
grant execute on function public.api_create_task(
  text, text, uuid, public.task_priority, date, time without time zone,
  uuid, uuid, uuid, uuid, jsonb, text
) to service_role;
grant execute on function public.api_update_task(text, uuid, integer, jsonb)
  to service_role;
grant execute on function public.api_set_task_assignee(text, uuid, uuid, integer)
  to service_role;
grant execute on function public.api_add_task_comment(text, uuid, text, uuid)
  to service_role;

comment on table public.workspace_api_keys is
  'Workspace-scoped personal access keys. Only SHA-256 hashes are stored; raw tokens are returned once.';
comment on table public.task_automation_events is
  'Durable, idempotent outbox derived from append-only task activity.';
comment on table public.automation_deliveries is
  'Per-channel delivery attempts for Slack, email and webhooks; clients have no direct access.';

commit;
