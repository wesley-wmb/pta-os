-- Secure workspace invitations and administrative membership lifecycle.
begin;

alter table public.workspace_members
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references public.profiles(id) on delete restrict,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists version integer not null default 1;

alter table public.workspace_members
  drop constraint if exists workspace_members_removed_consistent,
  add constraint workspace_members_removed_consistent check (
    (removed_at is null and removed_by is null)
    or (
      removed_at is not null
      and removed_by is not null
      and status = 'suspended'::public.membership_status
      and suspended_at is not null
    )
  ),
  drop constraint if exists workspace_members_version_positive,
  add constraint workspace_members_version_positive check (version > 0);

alter table public.workspace_invitations
  add column if not exists accepted_by uuid references public.profiles(id) on delete restrict,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete restrict,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists version integer not null default 1;

update public.workspace_invitations
set
  email = lower(btrim(email)),
  token_hash = case
    when token_hash ~ '^[0-9a-f]{64}$' then token_hash
    else encode(extensions.digest(token_hash, 'sha256'), 'hex')
  end,
  updated_at = now();

alter table public.workspace_invitations
  drop constraint if exists invitations_email_normalized,
  add constraint invitations_email_normalized check (email = lower(btrim(email))),
  drop constraint if exists invitations_token_hash_format,
  add constraint invitations_token_hash_format check (token_hash ~ '^[0-9a-f]{64}$'),
  drop constraint if exists invitations_terminal_state_consistent,
  add constraint invitations_terminal_state_consistent check (
    not (accepted_at is not null and cancelled_at is not null)
    and (accepted_by is null or accepted_at is not null)
    and (
      (cancelled_at is null and cancelled_by is null)
      or (cancelled_at is not null and cancelled_by is not null)
    )
  ),
  drop constraint if exists invitations_version_positive,
  add constraint invitations_version_positive check (version > 0);

drop index if exists public.invitations_open_email;
create unique index invitations_open_email
  on public.workspace_invitations (workspace_id, lower(email))
  where accepted_at is null and cancelled_at is null;

create index if not exists workspace_invitations_management
  on public.workspace_invitations (workspace_id, created_at desc);

create or replace function private.workspace_members_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
     or new.user_id is distinct from old.user_id
     or new.joined_at is distinct from old.joined_at
     or new.created_at is distinct from old.created_at then
    raise exception using errcode = '22023', message = 'PTA_MEMBERSHIP_IDENTITY_IMMUTABLE';
  end if;

  new.updated_at := statement_timestamp();
  new.version := old.version + 1;
  return new;
end;
$$;

alter function private.workspace_members_before_update() owner to postgres;
revoke all on function private.workspace_members_before_update() from public, anon, authenticated;

drop trigger if exists workspace_members_before_update on public.workspace_members;
create trigger workspace_members_before_update
  before update on public.workspace_members
  for each row execute function private.workspace_members_before_update();

create or replace function private.workspace_invitations_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.workspace_id is distinct from old.workspace_id
     or new.created_at is distinct from old.created_at then
    raise exception using errcode = '22023', message = 'PTA_INVITATION_IDENTITY_IMMUTABLE';
  end if;

  new.email := lower(btrim(new.email));
  new.updated_at := statement_timestamp();
  new.version := old.version + 1;
  return new;
end;
$$;

alter function private.workspace_invitations_before_update() owner to postgres;
revoke all on function private.workspace_invitations_before_update() from public, anon, authenticated;

drop trigger if exists workspace_invitations_before_update on public.workspace_invitations;
create trigger workspace_invitations_before_update
  before update on public.workspace_invitations
  for each row execute function private.workspace_invitations_before_update();

create or replace function private.enforce_workspace_active_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
begin
  if tg_op = 'DELETE' then
    v_workspace_id := old.workspace_id;
  else
    v_workspace_id := new.workspace_id;
  end if;

  if exists (
    select 1
    from public.workspaces workspace
    where workspace.id = v_workspace_id
      and workspace.archived_at is null
  ) and not exists (
    select 1
    from public.workspace_members member
    join public.profiles profile
      on profile.id = member.user_id
      and profile.is_active
    where member.workspace_id = v_workspace_id
      and member.role = 'owner'::public.workspace_role
      and member.status = 'active'::public.membership_status
      and member.removed_at is null
  ) then
    raise exception using errcode = '23514', message = 'PTA_LAST_OWNER_REQUIRED';
  end if;

  return null;
end;
$$;

alter function private.enforce_workspace_active_owner() owner to postgres;
revoke all on function private.enforce_workspace_active_owner() from public, anon, authenticated;

drop trigger if exists workspace_members_require_active_owner on public.workspace_members;
create constraint trigger workspace_members_require_active_owner
  after insert or update or delete on public.workspace_members
  deferrable initially deferred
  for each row execute function private.enforce_workspace_active_owner();

create or replace function private.enforce_profile_active_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.profiles profile
    join public.workspace_members member
      on member.user_id = profile.id
      and member.role = 'owner'::public.workspace_role
      and member.status = 'active'::public.membership_status
      and member.removed_at is null
    join public.workspaces workspace
      on workspace.id = member.workspace_id
      and workspace.archived_at is null
    where profile.id = old.id
      and not profile.is_active
  ) then
    raise exception using errcode = '23514', message = 'PTA_LAST_OWNER_REQUIRED';
  end if;

  return null;
end;
$$;

alter function private.enforce_profile_active_ownership() owner to postgres;
revoke all on function private.enforce_profile_active_ownership() from public, anon, authenticated;

drop trigger if exists profiles_require_active_workspace_owner on public.profiles;
create constraint trigger profiles_require_active_workspace_owner
  after update on public.profiles
  deferrable initially deferred
  for each row
  when (old.is_active is distinct from new.is_active)
  execute function private.enforce_profile_active_ownership();

create or replace function private.workspace_member_management_json(
  p_workspace_id uuid,
  p_user_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', member.user_id,
    'role', member.role,
    'membership_state', case
      when member.removed_at is not null then 'removed'
      else member.status::text
    end,
    'suspended_at', member.suspended_at,
    'removed_at', member.removed_at,
    'version', member.version
  )
  from public.workspace_members member
  where member.workspace_id = p_workspace_id
    and member.user_id = p_user_id;
$$;

alter function private.workspace_member_management_json(uuid, uuid) owner to postgres;
revoke all on function private.workspace_member_management_json(uuid, uuid) from public, anon, authenticated;

create or replace function private.workspace_invitation_management_json(p_invitation_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', invitation.id,
    'email', invitation.email,
    'role', invitation.role,
    'status', case
      when invitation.accepted_at is not null then 'accepted'
      when invitation.cancelled_at is not null then 'cancelled'
      when invitation.expires_at <= statement_timestamp() then 'expired'
      else 'pending'
    end,
    'expires_at', invitation.expires_at,
    'created_at', invitation.created_at,
    'updated_at', invitation.updated_at,
    'accepted_at', invitation.accepted_at,
    'cancelled_at', invitation.cancelled_at,
    'version', invitation.version
  )
  from public.workspace_invitations invitation
  where invitation.id = p_invitation_id;
$$;

alter function private.workspace_invitation_management_json(uuid) owner to postgres;
revoke all on function private.workspace_invitation_management_json(uuid) from public, anon, authenticated;

create or replace function public.list_workspace_team_management(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_members jsonb;
  v_invitations jsonb;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;

  v_role := private.current_workspace_role(p_workspace_id);
  if v_role is null or v_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role
  ) then
    raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', member.user_id,
        'full_name', profile.full_name,
        'email', profile.email,
        'initials', coalesce(
          nullif(btrim(profile.initials), ''),
          upper(left(btrim(profile.full_name), 1))
        ),
        'avatar_path', profile.avatar_path,
        'role', member.role,
        'membership_state', case
          when member.removed_at is not null then 'removed'
          else member.status::text
        end,
        'weekly_capacity_minutes', member.weekly_capacity_minutes,
        'joined_at', member.joined_at,
        'suspended_at', member.suspended_at,
        'removed_at', member.removed_at,
        'version', member.version,
        'is_self', member.user_id = v_actor
      )
      order by
        case when member.status = 'active'::public.membership_status then 0 else 1 end,
        lower(profile.full_name),
        member.user_id
    ),
    '[]'::jsonb
  )
  into v_members
  from public.workspace_members member
  join public.profiles profile on profile.id = member.user_id
  where member.workspace_id = p_workspace_id;

  select coalesce(
    jsonb_agg(
      private.workspace_invitation_management_json(invitation.id)
      order by invitation.created_at desc, invitation.id
    ),
    '[]'::jsonb
  )
  into v_invitations
  from public.workspace_invitations invitation
  where invitation.workspace_id = p_workspace_id;

  return jsonb_build_object(
    'workspace_id', p_workspace_id,
    'members', v_members,
    'invitations', v_invitations,
    'permissions', jsonb_build_object(
      'can_invite', true,
      'can_manage_members', true,
      'can_transfer_ownership', v_role = 'owner'::public.workspace_role
    )
  );
end;
$$;

create or replace function public.create_workspace_invitation(
  p_workspace_id uuid,
  p_email text,
  p_role public.workspace_role,
  p_expires_in_days integer default 7
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.workspace_role;
  v_email text := lower(btrim(p_email));
  v_raw_token text;
  v_token_hash text;
  v_invitation public.workspace_invitations%rowtype;
  v_was_existing boolean := false;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;
  if p_workspace_id is null
     or v_email is null
     or char_length(v_email) not between 3 and 320
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'PTA_INVALID_INVITATION_EMAIL';
  end if;
  if p_role is null or p_role = 'owner'::public.workspace_role then
    raise exception using errcode = '22023', message = 'PTA_INVALID_INVITATION_ROLE';
  end if;
  if p_expires_in_days is null or p_expires_in_days not between 1 and 30 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_INVITATION_EXPIRY';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('pta:workspace-team:' || p_workspace_id::text, 0)
  );
  v_actor_role := private.current_workspace_role(p_workspace_id);
  if v_actor_role is null or v_actor_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role
  ) then
    raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
  end if;

  if exists (
    select 1
    from public.workspace_members member
    join public.profiles profile on profile.id = member.user_id
    where member.workspace_id = p_workspace_id
      and member.status = 'active'::public.membership_status
      and member.removed_at is null
      and lower(btrim(profile.email)) = v_email
  ) then
    raise exception using errcode = '23514', message = 'PTA_MEMBER_ALREADY_ACTIVE';
  end if;

  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

  select invitation.*
  into v_invitation
  from public.workspace_invitations invitation
  where invitation.workspace_id = p_workspace_id
    and invitation.email = v_email
    and invitation.accepted_at is null
    and invitation.cancelled_at is null
  for update;

  if found then
    v_was_existing := true;
    update public.workspace_invitations invitation
    set
      role = p_role,
      token_hash = v_token_hash,
      invited_by = v_actor,
      expires_at = statement_timestamp() + make_interval(days => p_expires_in_days)
    where invitation.id = v_invitation.id
    returning invitation.* into v_invitation;
  else
    insert into public.workspace_invitations (
      workspace_id,
      email,
      role,
      token_hash,
      invited_by,
      expires_at
    ) values (
      p_workspace_id,
      v_email,
      p_role,
      v_token_hash,
      v_actor,
      statement_timestamp() + make_interval(days => p_expires_in_days)
    )
    returning * into v_invitation;
  end if;

  insert into public.activity_logs (
    workspace_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata_json
  ) values (
    p_workspace_id,
    v_actor,
    'workspace_invitation',
    v_invitation.id,
    case when v_was_existing then 'workspace.invitation_refreshed' else 'workspace.invitation_created' end,
    jsonb_build_object(
      'role', p_role,
      'expires_at', v_invitation.expires_at
    )
  );

  return jsonb_build_object(
    'invitation', private.workspace_invitation_management_json(v_invitation.id),
    'raw_token', v_raw_token
  );
end;
$$;

create or replace function public.cancel_workspace_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_workspace_id uuid;
  v_actor_role public.workspace_role;
  v_invitation public.workspace_invitations%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;

  select invitation.workspace_id
  into v_workspace_id
  from public.workspace_invitations invitation
  where invitation.id = p_invitation_id;

  if v_workspace_id is null then
    raise exception using errcode = 'P0002', message = 'PTA_INVITATION_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('pta:workspace-team:' || v_workspace_id::text, 0)
  );

  select invitation.*
  into v_invitation
  from public.workspace_invitations invitation
  where invitation.id = p_invitation_id
  for update;

  v_actor_role := private.current_workspace_role(v_workspace_id);
  if v_actor_role is null or v_actor_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role
  ) then
    raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
  end if;

  if v_invitation.accepted_at is not null then
    raise exception using errcode = '23514', message = 'PTA_INVITATION_ALREADY_ACCEPTED';
  end if;
  if v_invitation.cancelled_at is not null then
    return jsonb_build_object(
      'invitation', private.workspace_invitation_management_json(v_invitation.id)
    );
  end if;

  update public.workspace_invitations invitation
  set
    cancelled_at = statement_timestamp(),
    cancelled_by = v_actor
  where invitation.id = v_invitation.id
  returning invitation.* into v_invitation;

  insert into public.activity_logs (
    workspace_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata_json
  ) values (
    v_workspace_id,
    v_actor,
    'workspace_invitation',
    v_invitation.id,
    'workspace.invitation_cancelled',
    jsonb_build_object('role', v_invitation.role)
  );

  return jsonb_build_object(
    'invitation', private.workspace_invitation_management_json(v_invitation.id)
  );
end;
$$;

create or replace function public.inspect_workspace_invitation(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_email text;
  v_token_hash text;
  v_invitation public.workspace_invitations%rowtype;
  v_workspace_name text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;

  select lower(btrim(auth_user.email))
  into v_actor_email
  from auth.users auth_user
  join public.profiles profile
    on profile.id = auth_user.id
    and profile.is_active
  where auth_user.id = v_actor;

  if v_actor_email is null then
    raise exception using errcode = '42501', message = 'PTA_PROFILE_INACTIVE';
  end if;
  if p_token is null or btrim(p_token) !~* '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'invalid');
  end if;

  v_token_hash := encode(extensions.digest(lower(btrim(p_token)), 'sha256'), 'hex');
  select invitation.*
  into v_invitation
  from public.workspace_invitations invitation
  where invitation.token_hash = v_token_hash;

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  if v_invitation.email <> v_actor_email then
    return jsonb_build_object('status', 'email_mismatch');
  end if;
  if v_invitation.accepted_at is not null then
    return jsonb_build_object('status', 'accepted');
  end if;
  if v_invitation.cancelled_at is not null then
    return jsonb_build_object('status', 'cancelled');
  end if;
  if v_invitation.expires_at <= statement_timestamp() then
    return jsonb_build_object('status', 'expired');
  end if;

  select workspace.name
  into v_workspace_name
  from public.workspaces workspace
  where workspace.id = v_invitation.workspace_id
    and workspace.archived_at is null;

  if v_workspace_name is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  return jsonb_build_object(
    'status', 'pending',
    'workspace_id', v_invitation.workspace_id,
    'workspace_name', v_workspace_name,
    'role', v_invitation.role,
    'expires_at', v_invitation.expires_at
  );
end;
$$;

create or replace function public.accept_workspace_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_email text;
  v_token_hash text;
  v_workspace_id uuid;
  v_workspace_name text;
  v_invitation public.workspace_invitations%rowtype;
  v_member public.workspace_members%rowtype;
  v_already_accepted boolean := false;
  v_member_existed boolean := false;
  v_membership_activated boolean := false;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;

  select lower(btrim(auth_user.email))
  into v_actor_email
  from auth.users auth_user
  join public.profiles profile
    on profile.id = auth_user.id
    and profile.is_active
  where auth_user.id = v_actor;

  if v_actor_email is null then
    raise exception using errcode = '42501', message = 'PTA_PROFILE_INACTIVE';
  end if;
  if p_token is null or btrim(p_token) !~* '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'PTA_INVITATION_INVALID';
  end if;

  v_token_hash := encode(extensions.digest(lower(btrim(p_token)), 'sha256'), 'hex');
  select invitation.workspace_id
  into v_workspace_id
  from public.workspace_invitations invitation
  where invitation.token_hash = v_token_hash;

  if v_workspace_id is null then
    raise exception using errcode = '22023', message = 'PTA_INVITATION_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('pta:workspace-team:' || v_workspace_id::text, 0)
  );

  select invitation.*
  into v_invitation
  from public.workspace_invitations invitation
  where invitation.token_hash = v_token_hash
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'PTA_INVITATION_INVALID';
  end if;
  if v_invitation.email <> v_actor_email then
    raise exception using errcode = '42501', message = 'PTA_INVITATION_EMAIL_MISMATCH';
  end if;

  select workspace.name
  into v_workspace_name
  from public.workspaces workspace
  where workspace.id = v_workspace_id
    and workspace.archived_at is null;

  if v_workspace_name is null then
    raise exception using errcode = '22023', message = 'PTA_INVITATION_INVALID';
  end if;

  if v_invitation.accepted_at is not null then
    if v_invitation.accepted_by is distinct from v_actor then
      raise exception using errcode = '42501', message = 'PTA_INVITATION_ALREADY_USED';
    end if;
    v_already_accepted := true;
  else
    if v_invitation.cancelled_at is not null then
      raise exception using errcode = '23514', message = 'PTA_INVITATION_CANCELLED';
    end if;
    if v_invitation.expires_at <= statement_timestamp() then
      raise exception using errcode = '23514', message = 'PTA_INVITATION_EXPIRED';
    end if;
  end if;

  select member.*
  into v_member
  from public.workspace_members member
  where member.workspace_id = v_workspace_id
    and member.user_id = v_actor
  for update;
  v_member_existed := found;

  if v_already_accepted then
    if not v_member_existed then
      raise exception using errcode = '23514', message = 'PTA_INVITATION_STATE_INVALID';
    end if;
    if v_member.status <> 'active'::public.membership_status
       or v_member.removed_at is not null then
      raise exception using errcode = '23514', message = 'PTA_INVITATION_ALREADY_USED';
    end if;
  elsif not v_member_existed then
    insert into public.workspace_members (
      workspace_id,
      user_id,
      role,
      status,
      joined_at
    ) values (
      v_workspace_id,
      v_actor,
      v_invitation.role,
      'active'::public.membership_status,
      statement_timestamp()
    )
    returning * into v_member;
    v_membership_activated := true;
  elsif v_member.status = 'suspended'::public.membership_status
        or v_member.removed_at is not null then
    update public.workspace_members member
    set
      role = v_invitation.role,
      status = 'active'::public.membership_status,
      suspended_at = null,
      removed_at = null,
      removed_by = null
    where member.workspace_id = v_workspace_id
      and member.user_id = v_actor
    returning member.* into v_member;
    v_membership_activated := true;
  end if;

  if not v_already_accepted then
    update public.workspace_invitations invitation
    set
      accepted_at = statement_timestamp(),
      accepted_by = v_actor
    where invitation.id = v_invitation.id;

    insert into public.activity_logs (
      workspace_id,
      actor_id,
      entity_type,
      entity_id,
      action,
      metadata_json
    ) values (
      v_workspace_id,
      v_actor,
      'workspace_invitation',
      v_invitation.id,
      'workspace.invitation_accepted',
      jsonb_build_object('role', v_member.role)
    );

    if v_membership_activated then
      insert into public.activity_logs (
        workspace_id,
        actor_id,
        entity_type,
        entity_id,
        action,
        changes_json
      ) values (
        v_workspace_id,
        v_actor,
        'workspace_member',
        v_actor,
        case when v_member_existed then 'workspace.member_reactivated' else 'workspace.member_joined' end,
        jsonb_build_object(
          'role', jsonb_build_object('to', v_member.role),
          'status', jsonb_build_object('to', 'active')
        )
      );
    end if;
  end if;

  return jsonb_build_object(
    'workspace_id', v_workspace_id,
    'workspace_name', v_workspace_name,
    'user_id', v_actor,
    'role', v_member.role,
    'status', v_member.status,
    'membership_state', case
      when v_member.removed_at is not null then 'removed'
      else v_member.status::text
    end,
    'version', v_member.version,
    'already_accepted', v_already_accepted
  );
end;
$$;

create or replace function public.change_workspace_member_role(
  p_workspace_id uuid,
  p_user_id uuid,
  p_role public.workspace_role,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.workspace_role;
  v_member public.workspace_members%rowtype;
  v_old_role public.workspace_role;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_EXPECTED_VERSION';
  end if;
  if p_role is null or p_role = 'owner'::public.workspace_role then
    raise exception using errcode = '22023', message = 'PTA_INVALID_MEMBER_ROLE';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('pta:workspace-team:' || p_workspace_id::text, 0)
  );
  v_actor_role := private.current_workspace_role(p_workspace_id);
  if v_actor_role is null or v_actor_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role
  ) then
    raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
  end if;

  select member.*
  into v_member
  from public.workspace_members member
  where member.workspace_id = p_workspace_id
    and member.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_MEMBER_NOT_FOUND';
  end if;
  if v_member.role = 'owner'::public.workspace_role then
    raise exception using errcode = '23514', message = 'PTA_LAST_OWNER_REQUIRED';
  end if;
  if v_member.removed_at is not null then
    raise exception using errcode = '23514', message = 'PTA_MEMBER_REMOVED';
  end if;
  if v_member.role = p_role then
    return jsonb_build_object(
      'member', private.workspace_member_management_json(p_workspace_id, p_user_id)
    );
  end if;
  if v_member.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  v_old_role := v_member.role;
  update public.workspace_members member
  set role = p_role
  where member.workspace_id = p_workspace_id
    and member.user_id = p_user_id
  returning member.* into v_member;

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
    'workspace_member',
    p_user_id,
    'workspace.member_role_changed',
    jsonb_build_object(
      'role', jsonb_build_object('from', v_old_role, 'to', p_role)
    )
  );

  return jsonb_build_object(
    'member', private.workspace_member_management_json(p_workspace_id, p_user_id)
  );
end;
$$;

create or replace function public.suspend_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.workspace_role;
  v_member public.workspace_members%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_EXPECTED_VERSION';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('pta:workspace-team:' || p_workspace_id::text, 0)
  );
  v_actor_role := private.current_workspace_role(p_workspace_id);
  if v_actor_role is null or v_actor_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role
  ) then
    raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
  end if;

  select member.*
  into v_member
  from public.workspace_members member
  where member.workspace_id = p_workspace_id
    and member.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_MEMBER_NOT_FOUND';
  end if;
  if v_member.role = 'owner'::public.workspace_role then
    raise exception using errcode = '23514', message = 'PTA_LAST_OWNER_REQUIRED';
  end if;
  if v_member.removed_at is not null then
    raise exception using errcode = '23514', message = 'PTA_MEMBER_REMOVED';
  end if;
  if v_member.status = 'suspended'::public.membership_status then
    return jsonb_build_object(
      'member', private.workspace_member_management_json(p_workspace_id, p_user_id)
    );
  end if;
  if v_member.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  update public.workspace_members member
  set
    status = 'suspended'::public.membership_status,
    suspended_at = statement_timestamp()
  where member.workspace_id = p_workspace_id
    and member.user_id = p_user_id;

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
    'workspace_member',
    p_user_id,
    'workspace.member_suspended',
    jsonb_build_object(
      'status', jsonb_build_object('from', 'active', 'to', 'suspended')
    )
  );

  return jsonb_build_object(
    'member', private.workspace_member_management_json(p_workspace_id, p_user_id)
  );
end;
$$;

create or replace function public.reactivate_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.workspace_role;
  v_member public.workspace_members%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_EXPECTED_VERSION';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('pta:workspace-team:' || p_workspace_id::text, 0)
  );
  v_actor_role := private.current_workspace_role(p_workspace_id);
  if v_actor_role is null or v_actor_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role
  ) then
    raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
  end if;

  select member.*
  into v_member
  from public.workspace_members member
  where member.workspace_id = p_workspace_id
    and member.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_MEMBER_NOT_FOUND';
  end if;
  if v_member.removed_at is not null then
    raise exception using errcode = '23514', message = 'PTA_MEMBER_REMOVED';
  end if;
  if v_member.status = 'active'::public.membership_status then
    return jsonb_build_object(
      'member', private.workspace_member_management_json(p_workspace_id, p_user_id)
    );
  end if;
  if v_member.role = 'owner'::public.workspace_role then
    raise exception using errcode = '23514', message = 'PTA_OWNER_REACTIVATION_REQUIRES_TRANSFER';
  end if;
  if v_member.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_user_id
      and profile.is_active
  ) then
    raise exception using errcode = '23514', message = 'PTA_PROFILE_INACTIVE';
  end if;

  update public.workspace_members member
  set
    status = 'active'::public.membership_status,
    suspended_at = null
  where member.workspace_id = p_workspace_id
    and member.user_id = p_user_id;

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
    'workspace_member',
    p_user_id,
    'workspace.member_reactivated',
    jsonb_build_object(
      'status', jsonb_build_object('from', 'suspended', 'to', 'active')
    )
  );

  return jsonb_build_object(
    'member', private.workspace_member_management_json(p_workspace_id, p_user_id)
  );
end;
$$;

create or replace function public.remove_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.workspace_role;
  v_member public.workspace_members%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_EXPECTED_VERSION';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('pta:workspace-team:' || p_workspace_id::text, 0)
  );
  v_actor_role := private.current_workspace_role(p_workspace_id);
  if v_actor_role is null or v_actor_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role
  ) then
    raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
  end if;

  select member.*
  into v_member
  from public.workspace_members member
  where member.workspace_id = p_workspace_id
    and member.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_MEMBER_NOT_FOUND';
  end if;
  if v_member.role = 'owner'::public.workspace_role then
    raise exception using errcode = '23514', message = 'PTA_LAST_OWNER_REQUIRED';
  end if;
  if v_member.removed_at is not null then
    return jsonb_build_object(
      'member', private.workspace_member_management_json(p_workspace_id, p_user_id)
    );
  end if;
  if v_member.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  update public.workspace_members member
  set
    status = 'suspended'::public.membership_status,
    suspended_at = coalesce(member.suspended_at, statement_timestamp()),
    removed_at = statement_timestamp(),
    removed_by = v_actor
  where member.workspace_id = p_workspace_id
    and member.user_id = p_user_id;

  with cancelled as (
    update public.workspace_invitations invitation
    set
      cancelled_at = statement_timestamp(),
      cancelled_by = v_actor
    where invitation.workspace_id = p_workspace_id
      and invitation.accepted_at is null
      and invitation.cancelled_at is null
      and invitation.email = (
        select lower(btrim(profile.email))
        from public.profiles profile
        where profile.id = p_user_id
      )
    returning invitation.id, invitation.role
  )
  insert into public.activity_logs (
    workspace_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata_json
  )
  select
    p_workspace_id,
    v_actor,
    'workspace_invitation',
    cancelled.id,
    'workspace.invitation_cancelled',
    jsonb_build_object('role', cancelled.role, 'reason', 'member_removed')
  from cancelled;

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
    'workspace_member',
    p_user_id,
    'workspace.member_removed',
    jsonb_build_object(
      'status', jsonb_build_object('from', v_member.status, 'to', 'removed')
    )
  );

  return jsonb_build_object(
    'member', private.workspace_member_management_json(p_workspace_id, p_user_id)
  );
end;
$$;

create or replace function public.transfer_workspace_ownership(
  p_workspace_id uuid,
  p_new_owner_id uuid,
  p_expected_owner_version integer,
  p_expected_new_owner_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.workspace_role;
  v_owner public.workspace_members%rowtype;
  v_new_owner public.workspace_members%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;
  if p_expected_owner_version is null or p_expected_owner_version < 1
     or p_expected_new_owner_version is null or p_expected_new_owner_version < 1 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_EXPECTED_VERSION';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('pta:workspace-team:' || p_workspace_id::text, 0)
  );
  v_actor_role := private.current_workspace_role(p_workspace_id);
  if v_actor_role is distinct from 'owner'::public.workspace_role then
    raise exception using errcode = '42501', message = 'PTA_OWNER_REQUIRED';
  end if;

  perform 1
  from public.workspace_members member
  where member.workspace_id = p_workspace_id
    and member.user_id in (v_actor, p_new_owner_id)
  order by member.user_id
  for update;

  select member.*
  into v_owner
  from public.workspace_members member
  where member.workspace_id = p_workspace_id
    and member.user_id = v_actor;

  select member.*
  into v_new_owner
  from public.workspace_members member
  where member.workspace_id = p_workspace_id
    and member.user_id = p_new_owner_id;

  if v_new_owner.user_id is null then
    raise exception using errcode = 'P0002', message = 'PTA_MEMBER_NOT_FOUND';
  end if;
  if p_new_owner_id = v_actor then
    return jsonb_build_object(
      'previous_owner', private.workspace_member_management_json(p_workspace_id, v_actor),
      'new_owner', private.workspace_member_management_json(p_workspace_id, v_actor)
    );
  end if;
  if v_owner.version <> p_expected_owner_version
     or v_new_owner.version <> p_expected_new_owner_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;
  if v_new_owner.status <> 'active'::public.membership_status
     or v_new_owner.removed_at is not null then
    raise exception using errcode = '23514', message = 'PTA_NEW_OWNER_MUST_BE_ACTIVE';
  end if;
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_new_owner_id
      and profile.is_active
  ) then
    raise exception using errcode = '23514', message = 'PTA_NEW_OWNER_MUST_BE_ACTIVE';
  end if;

  update public.workspace_members member
  set role = 'admin'::public.workspace_role
  where member.workspace_id = p_workspace_id
    and member.user_id = v_actor;

  update public.workspace_members member
  set role = 'owner'::public.workspace_role
  where member.workspace_id = p_workspace_id
    and member.user_id = p_new_owner_id;

  if (
    select count(*)
    from public.workspace_members member
    join public.profiles profile
      on profile.id = member.user_id
      and profile.is_active
    where member.workspace_id = p_workspace_id
      and member.role = 'owner'::public.workspace_role
      and member.status = 'active'::public.membership_status
      and member.removed_at is null
  ) <> 1 then
    raise exception using errcode = '23514', message = 'PTA_LAST_OWNER_REQUIRED';
  end if;

  insert into public.activity_logs (
    workspace_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    changes_json,
    metadata_json
  ) values (
    p_workspace_id,
    v_actor,
    'workspace_member',
    p_new_owner_id,
    'workspace.ownership_transferred',
    jsonb_build_object(
      'previous_owner_role', jsonb_build_object('from', 'owner', 'to', 'admin'),
      'new_owner_role', jsonb_build_object('from', v_new_owner.role, 'to', 'owner')
    ),
    jsonb_build_object('previous_owner_id', v_actor)
  );

  return jsonb_build_object(
    'previous_owner', private.workspace_member_management_json(p_workspace_id, v_actor),
    'new_owner', private.workspace_member_management_json(p_workspace_id, p_new_owner_id)
  );
end;
$$;

alter table public.workspace_members enable row level security;
alter table public.workspace_members force row level security;
alter table public.workspace_invitations enable row level security;
alter table public.workspace_invitations force row level security;

drop policy if exists invitations_select_managers on public.workspace_invitations;
create policy invitations_select_managers
on public.workspace_invitations
for select
to authenticated
using (
  private.current_workspace_role(workspace_id) in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role
  )
);

revoke all on table public.workspace_invitations from public, anon, authenticated;
revoke insert, update, delete, truncate on table public.workspace_members from public, anon, authenticated;

alter function public.list_workspace_team_management(uuid) owner to postgres;
alter function public.create_workspace_invitation(uuid, text, public.workspace_role, integer) owner to postgres;
alter function public.cancel_workspace_invitation(uuid) owner to postgres;
alter function public.inspect_workspace_invitation(text) owner to postgres;
alter function public.accept_workspace_invitation(text) owner to postgres;
alter function public.change_workspace_member_role(uuid, uuid, public.workspace_role, integer) owner to postgres;
alter function public.suspend_workspace_member(uuid, uuid, integer) owner to postgres;
alter function public.reactivate_workspace_member(uuid, uuid, integer) owner to postgres;
alter function public.remove_workspace_member(uuid, uuid, integer) owner to postgres;
alter function public.transfer_workspace_ownership(uuid, uuid, integer, integer) owner to postgres;

revoke all on function public.list_workspace_team_management(uuid) from public, anon, authenticated;
revoke all on function public.create_workspace_invitation(uuid, text, public.workspace_role, integer) from public, anon, authenticated;
revoke all on function public.cancel_workspace_invitation(uuid) from public, anon, authenticated;
revoke all on function public.inspect_workspace_invitation(text) from public, anon, authenticated;
revoke all on function public.accept_workspace_invitation(text) from public, anon, authenticated;
revoke all on function public.change_workspace_member_role(uuid, uuid, public.workspace_role, integer) from public, anon, authenticated;
revoke all on function public.suspend_workspace_member(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.reactivate_workspace_member(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.remove_workspace_member(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.transfer_workspace_ownership(uuid, uuid, integer, integer) from public, anon, authenticated;

grant execute on function public.list_workspace_team_management(uuid) to authenticated;
grant execute on function public.create_workspace_invitation(uuid, text, public.workspace_role, integer) to authenticated;
grant execute on function public.cancel_workspace_invitation(uuid) to authenticated;
grant execute on function public.inspect_workspace_invitation(text) to authenticated;
grant execute on function public.accept_workspace_invitation(text) to authenticated;
grant execute on function public.change_workspace_member_role(uuid, uuid, public.workspace_role, integer) to authenticated;
grant execute on function public.suspend_workspace_member(uuid, uuid, integer) to authenticated;
grant execute on function public.reactivate_workspace_member(uuid, uuid, integer) to authenticated;
grant execute on function public.remove_workspace_member(uuid, uuid, integer) to authenticated;
grant execute on function public.transfer_workspace_ownership(uuid, uuid, integer, integer) to authenticated;

comment on function public.list_workspace_team_management(uuid) is
  'Returns the complete sanitized membership and invitation management view to active owners and admins.';
comment on function public.create_workspace_invitation(uuid, text, public.workspace_role, integer) is
  'Creates or refreshes one open invitation and returns its raw token exactly once without persisting it.';
comment on function public.inspect_workspace_invitation(text) is
  'Returns a non-sensitive invitation state to an authenticated user and reveals workspace context only for a matching pending invitation.';
comment on function public.accept_workspace_invitation(text) is
  'Accepts an invitation for the authenticated matching email and atomically creates or reactivates its membership.';
comment on function public.remove_workspace_member(uuid, uuid, integer) is
  'Logically removes a non-owner member so historical foreign keys and audit records remain intact.';
comment on function public.transfer_workspace_ownership(uuid, uuid, integer, integer) is
  'Transfers the single active owner role atomically while enforcing optimistic versions for both memberships.';

commit;
