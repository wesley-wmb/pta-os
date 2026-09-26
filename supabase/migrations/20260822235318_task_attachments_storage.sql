-- PTA OS task attachments backed by the hosted private Storage bucket.
-- Hosted migration version: 20260822235318.
begin;

create type public.task_attachment_state as enum (
  'pending',
  'ready',
  'deleting',
  'deleted'
);

create or replace function private.is_valid_task_attachment_type(
  p_extension text,
  p_mime_type text
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select case lower(p_extension)
    when 'pdf' then lower(p_mime_type) = 'application/pdf'
    when 'png' then lower(p_mime_type) = 'image/png'
    when 'jpg' then lower(p_mime_type) = 'image/jpeg'
    when 'jpeg' then lower(p_mime_type) = 'image/jpeg'
    when 'webp' then lower(p_mime_type) = 'image/webp'
    when 'docx' then lower(p_mime_type) =
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    when 'xlsx' then lower(p_mime_type) =
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    when 'csv' then lower(p_mime_type) in ('text/csv', 'application/csv')
    when 'txt' then lower(p_mime_type) = 'text/plain'
    when 'zip' then lower(p_mime_type) in (
      'application/zip',
      'application/x-zip-compressed'
    )
    when 'mp4' then lower(p_mime_type) = 'video/mp4'
    else false
  end;
$$;

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null,
  bucket_id text not null default 'task-attachments',
  object_path text not null,
  file_name text not null,
  file_extension text not null,
  mime_type text not null,
  file_size bigint not null,
  uploaded_by uuid not null,
  state public.task_attachment_state not null default 'pending',
  ready_at timestamptz,
  delete_requested_by uuid,
  delete_requested_at timestamptz,
  removal_token uuid,
  removal_lease_expires_at timestamptz,
  deleted_by uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, task_id, id),
  unique (bucket_id, object_path),
  foreign key (workspace_id, task_id)
    references public.tasks(workspace_id, id) on delete cascade,
  foreign key (workspace_id, uploaded_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, delete_requested_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, deleted_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint task_attachments_bucket_fixed check (bucket_id = 'task-attachments'),
  constraint task_attachments_path_canonical check (
    object_path = workspace_id::text
      || '/tasks/' || task_id::text
      || '/' || id::text || '.' || file_extension
  ),
  constraint task_attachments_file_name_valid check (
    file_name = btrim(file_name)
    and char_length(file_name) between 1 and 255
    and file_name !~ '[[:cntrl:]/\\]'
    and lower(file_name) like '%.' || file_extension
  ),
  constraint task_attachments_file_extension_valid check (
    file_extension = lower(file_extension)
    and file_extension in (
      'pdf', 'png', 'jpg', 'jpeg', 'webp', 'docx', 'xlsx', 'csv', 'txt', 'zip', 'mp4'
    )
  ),
  constraint task_attachments_mime_type_valid check (
    mime_type = lower(mime_type)
    and private.is_valid_task_attachment_type(file_extension, mime_type)
  ),
  constraint task_attachments_file_size_valid check (
    file_size between 1 and 26214400
  ),
  constraint task_attachments_lifecycle_consistent check (
    (
      state = 'pending'::public.task_attachment_state
      and ready_at is null
      and delete_requested_by is null
      and delete_requested_at is null
      and removal_token is null
      and removal_lease_expires_at is null
      and deleted_by is null
      and deleted_at is null
    )
    or (
      state = 'ready'::public.task_attachment_state
      and ready_at is not null
      and delete_requested_by is null
      and delete_requested_at is null
      and removal_token is null
      and removal_lease_expires_at is null
      and deleted_by is null
      and deleted_at is null
    )
    or (
      state = 'deleting'::public.task_attachment_state
      and delete_requested_by is not null
      and delete_requested_at is not null
      and removal_token is not null
      and removal_lease_expires_at is not null
      and deleted_by is null
      and deleted_at is null
    )
    or (
      state = 'deleted'::public.task_attachment_state
      and delete_requested_by is not null
      and delete_requested_at is not null
      and removal_token is not null
      and removal_lease_expires_at is not null
      and deleted_by is not null
      and deleted_at is not null
    )
  )
);

create index task_attachments_task_active_created
  on public.task_attachments (workspace_id, task_id, created_at, id)
  where deleted_at is null;

create index task_attachments_uploader_pending
  on public.task_attachments (uploaded_by, created_at)
  where state = 'pending'::public.task_attachment_state;

create or replace function private.preserve_task_attachment_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.workspace_id is distinct from old.workspace_id
    or new.task_id is distinct from old.task_id
    or new.bucket_id is distinct from old.bucket_id
    or new.object_path is distinct from old.object_path
    or new.file_name is distinct from old.file_name
    or new.file_extension is distinct from old.file_extension
    or new.mime_type is distinct from old.mime_type
    or new.file_size is distinct from old.file_size
    or new.uploaded_by is distinct from old.uploaded_by
    or new.created_at is distinct from old.created_at then
    raise exception using errcode = '42501', message = 'PTA_ATTACHMENT_IDENTITY_IMMUTABLE';
  end if;

  return new;
end;
$$;

create trigger task_attachments_preserve_identity
  before update on public.task_attachments
  for each row execute function private.preserve_task_attachment_identity();

create or replace function private.can_read_task_attachment_object(
  p_object_path text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role public.workspace_role;
  v_task_id uuid;
  v_uploaded_by uuid;
begin
  if exists (
    select 1
    from public.task_attachments attachment
    where attachment.bucket_id = 'task-attachments'
      and attachment.object_path = p_object_path
      and attachment.state = 'ready'::public.task_attachment_state
      and private.task_collaboration_role(attachment.task_id) is not null
  ) then
    return true;
  end if;

  select attachment.task_id, attachment.uploaded_by
  into v_task_id, v_uploaded_by
  from public.task_attachments attachment
  where attachment.bucket_id = 'task-attachments'
    and attachment.object_path = p_object_path
    and attachment.state = 'deleting'::public.task_attachment_state
    and attachment.delete_requested_by = v_actor
    and attachment.removal_lease_expires_at > clock_timestamp()
  for share;

  if not found then
    return false;
  end if;

  v_role := private.task_collaboration_role(v_task_id);
  return v_role in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role
  ) or (
    v_role = 'member'::public.workspace_role
    and v_uploaded_by = v_actor
  );
end;
$$;

create or replace function private.can_read_task_attachment_metadata(
  p_attachment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.task_attachments attachment
    where attachment.id = p_attachment_id
      and attachment.deleted_at is null
      and private.task_collaboration_role(attachment.task_id) is not null
      and (
        attachment.state = 'ready'::public.task_attachment_state
        or attachment.uploaded_by = (select auth.uid())
        or attachment.delete_requested_by = (select auth.uid())
        or private.task_collaboration_role(attachment.task_id) in (
          'owner'::public.workspace_role,
          'admin'::public.workspace_role,
          'manager'::public.workspace_role
        )
      )
  );
$$;

create or replace function private.can_upload_task_attachment_object(
  p_object_path text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role public.workspace_role;
  v_task_id uuid;
begin
  select attachment.task_id
  into v_task_id
  from public.task_attachments attachment
  where attachment.bucket_id = 'task-attachments'
    and attachment.object_path = p_object_path
    and attachment.state = 'pending'::public.task_attachment_state
    and attachment.uploaded_by = v_actor
  for share;

  if not found then
    return false;
  end if;

  v_role := private.task_collaboration_role(v_task_id);
  return v_role in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role,
    'member'::public.workspace_role
  );
end;
$$;

create or replace function private.can_delete_task_attachment_object(
  p_object_path text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role public.workspace_role;
  v_task_id uuid;
  v_uploaded_by uuid;
begin
  select attachment.task_id, attachment.uploaded_by
  into v_task_id, v_uploaded_by
  from public.task_attachments attachment
  where attachment.bucket_id = 'task-attachments'
    and attachment.object_path = p_object_path
    and attachment.state = 'deleting'::public.task_attachment_state
    and attachment.delete_requested_by = v_actor
    and attachment.removal_lease_expires_at > clock_timestamp()
  for share;

  if not found then
    return false;
  end if;

  v_role := private.task_collaboration_role(v_task_id);
  return v_role in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role
  ) or (
    v_role = 'member'::public.workspace_role
    and v_uploaded_by = v_actor
  );
end;
$$;

alter table public.task_attachments enable row level security;
alter table public.task_attachments force row level security;

create policy task_attachments_select_member
on public.task_attachments
for select
to authenticated
using (
  private.can_read_task_attachment_metadata(id)
);

revoke all on table public.task_attachments from public, anon, authenticated;
grant select on table public.task_attachments to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'task-attachments',
  'task-attachments',
  false,
  26214400,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/csv',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed',
    'video/mp4'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists task_attachments_object_read on storage.objects;
create policy task_attachments_object_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-attachments'
  and private.can_read_task_attachment_object(name)
);

drop policy if exists task_attachments_object_insert on storage.objects;
create policy task_attachments_object_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-attachments'
  and private.can_upload_task_attachment_object(name)
);

drop policy if exists task_attachments_object_delete on storage.objects;
create policy task_attachments_object_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'task-attachments'
  and private.can_delete_task_attachment_object(name)
);

create or replace function public.list_task_attachments(p_task_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role public.workspace_role;
  v_result jsonb;
begin
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
          'file_name', attachment.file_name,
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
$$;

create or replace function public.prepare_task_attachment(
  p_task_id uuid,
  p_file_name text,
  p_file_extension text,
  p_mime_type text,
  p_file_size bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role public.workspace_role;
  v_workspace_id uuid;
  v_id uuid := gen_random_uuid();
  v_name text := btrim(coalesce(p_file_name, ''));
  v_extension text := lower(btrim(coalesce(p_file_extension, '')));
  v_mime_type text := lower(btrim(coalesce(p_mime_type, '')));
  v_object_path text;
begin
  select task.workspace_id
  into v_workspace_id
  from public.tasks task
  where task.id = p_task_id
    and task.archived_at is null;

  v_role := private.task_collaboration_role(p_task_id);
  if v_workspace_id is null or v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;
  if v_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role,
    'member'::public.workspace_role
  ) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;

  if char_length(v_name) not between 1 and 255
    or v_name ~ '[[:cntrl:]/\\]'
    or lower(v_name) not like '%.' || v_extension then
    raise exception using errcode = '22023', message = 'PTA_INVALID_ATTACHMENT_NAME';
  end if;
  if p_file_size is null or p_file_size not between 1 and 26214400 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_ATTACHMENT_SIZE';
  end if;
  if not private.is_valid_task_attachment_type(v_extension, v_mime_type) then
    raise exception using errcode = '22023', message = 'PTA_INVALID_ATTACHMENT_TYPE';
  end if;

  -- Keep actor-wide and task-wide quotas atomic under concurrent prepares.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pta:attachment:actor:' || v_actor::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pta:attachment:task:' || p_task_id::text, 0)
  );

  if (
    select count(*)
    from public.task_attachments attachment
    where attachment.uploaded_by = v_actor
      and attachment.created_at > clock_timestamp() - interval '1 hour'
  ) >= 100 then
    raise exception using errcode = '54000', message = 'PTA_ATTACHMENT_UPLOAD_LIMIT';
  end if;

  if (
    select count(*)
    from public.task_attachments attachment
    where attachment.uploaded_by = v_actor
      and attachment.state = 'pending'::public.task_attachment_state
  ) >= 20 then
    raise exception using errcode = '54000', message = 'PTA_ATTACHMENT_PENDING_LIMIT';
  end if;

  if (
    select count(*)
    from public.task_attachments attachment
    where attachment.task_id = p_task_id
      and attachment.deleted_at is null
  ) >= 500 then
    raise exception using errcode = '54000', message = 'PTA_TASK_ATTACHMENT_LIMIT';
  end if;

  v_object_path := v_workspace_id::text
    || '/tasks/' || p_task_id::text
    || '/' || v_id::text || '.' || v_extension;

  insert into public.task_attachments (
    id,
    workspace_id,
    task_id,
    object_path,
    file_name,
    file_extension,
    mime_type,
    file_size,
    uploaded_by
  ) values (
    v_id,
    v_workspace_id,
    p_task_id,
    v_object_path,
    v_name,
    v_extension,
    v_mime_type,
    p_file_size,
    v_actor
  );

  return jsonb_build_object(
    'id', v_id,
    'bucket_id', 'task-attachments',
    'object_path', v_object_path,
    'file_name', v_name,
    'mime_type', v_mime_type,
    'file_size', p_file_size,
    'state', 'pending'
  );
end;
$$;

create or replace function public.complete_task_attachment(p_attachment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role public.workspace_role;
  v_attachment public.task_attachments%rowtype;
  v_object_size bigint;
  v_object_mime_type text;
begin
  select attachment.*
  into v_attachment
  from public.task_attachments attachment
  where attachment.id = p_attachment_id
    and attachment.state in (
      'pending'::public.task_attachment_state,
      'ready'::public.task_attachment_state
    )
    and attachment.uploaded_by = v_actor
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_ATTACHMENT_NOT_FOUND';
  end if;

  v_role := private.task_collaboration_role(v_attachment.task_id);
  if v_role is null or v_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role,
    'member'::public.workspace_role
  ) then
    raise exception using errcode = 'P0002', message = 'PTA_ATTACHMENT_NOT_FOUND';
  end if;

  if v_attachment.state = 'ready'::public.task_attachment_state then
    return jsonb_build_object(
      'id', v_attachment.id,
      'task_id', v_attachment.task_id,
      'state', v_attachment.state,
      'ready_at', v_attachment.ready_at
    );
  end if;

  select
    case
      when object.metadata ->> 'size' ~ '^[0-9]+$'
        then (object.metadata ->> 'size')::bigint
      else null
    end,
    lower(coalesce(object.metadata ->> 'mimetype', ''))
  into v_object_size, v_object_mime_type
  from storage.objects object
  where object.bucket_id = v_attachment.bucket_id
    and object.name = v_attachment.object_path
  limit 1;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_ATTACHMENT_OBJECT_NOT_FOUND';
  end if;
  if v_object_size is distinct from v_attachment.file_size
    or v_object_mime_type is distinct from v_attachment.mime_type then
    raise exception using errcode = '22023', message = 'PTA_ATTACHMENT_OBJECT_MISMATCH';
  end if;

  update public.task_attachments attachment
  set
    state = 'ready'::public.task_attachment_state,
    ready_at = clock_timestamp()
  where attachment.id = p_attachment_id
  returning * into v_attachment;

  perform realtime.send(
    jsonb_build_object(
      'task_id', v_attachment.task_id,
      'attachment_id', v_attachment.id
    ),
    'attachment_changed',
    'task:' || v_attachment.task_id::text,
    true
  );

  return jsonb_build_object(
    'id', v_attachment.id,
    'task_id', v_attachment.task_id,
    'state', v_attachment.state,
    'ready_at', v_attachment.ready_at
  );
end;
$$;

create or replace function public.begin_remove_task_attachment(p_attachment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role public.workspace_role;
  v_attachment public.task_attachments%rowtype;
  v_now timestamptz := clock_timestamp();
  v_removal_token uuid;
begin
  select attachment.*
  into v_attachment
  from public.task_attachments attachment
  where attachment.id = p_attachment_id
    and attachment.deleted_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_ATTACHMENT_NOT_FOUND';
  end if;

  v_role := private.task_collaboration_role(v_attachment.task_id);
  if v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_ATTACHMENT_NOT_FOUND';
  end if;

  if not (
    v_role in (
      'owner'::public.workspace_role,
      'admin'::public.workspace_role,
      'manager'::public.workspace_role
    )
    or (
      v_role = 'member'::public.workspace_role
      and v_attachment.uploaded_by = v_actor
    )
  ) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;

  if v_attachment.state = 'deleting'::public.task_attachment_state
    and v_attachment.removal_lease_expires_at > v_now then
    if v_attachment.delete_requested_by = v_actor then
      return jsonb_build_object(
        'id', v_attachment.id,
        'bucket_id', v_attachment.bucket_id,
        'object_path', v_attachment.object_path,
        'state', v_attachment.state,
        'removal_token', v_attachment.removal_token,
        'removal_lease_expires_at', v_attachment.removal_lease_expires_at
      );
    end if;

    raise exception using errcode = '55000', message = 'PTA_ATTACHMENT_REMOVAL_BUSY';
  end if;

  v_removal_token := gen_random_uuid();

  update public.task_attachments attachment
  set
    state = 'deleting'::public.task_attachment_state,
    delete_requested_by = v_actor,
    delete_requested_at = v_now,
    removal_token = v_removal_token,
    removal_lease_expires_at = v_now + interval '5 minutes'
  where attachment.id = p_attachment_id
  returning * into v_attachment;

  perform realtime.send(
    jsonb_build_object(
      'task_id', v_attachment.task_id,
      'attachment_id', v_attachment.id
    ),
    'attachment_changed',
    'task:' || v_attachment.task_id::text,
    true
  );

  return jsonb_build_object(
    'id', v_attachment.id,
    'bucket_id', v_attachment.bucket_id,
    'object_path', v_attachment.object_path,
    'state', v_attachment.state,
    'removal_token', v_attachment.removal_token,
    'removal_lease_expires_at', v_attachment.removal_lease_expires_at
  );
end;
$$;

create or replace function public.cancel_task_attachment_removal(
  p_attachment_id uuid,
  p_removal_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role public.workspace_role;
  v_attachment public.task_attachments%rowtype;
  v_object_exists boolean;
  v_object_matches boolean;
begin
  select attachment.*
  into v_attachment
  from public.task_attachments attachment
  where attachment.id = p_attachment_id
    and attachment.deleted_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_ATTACHMENT_NOT_FOUND';
  end if;

  v_role := private.task_collaboration_role(v_attachment.task_id);
  if v_role is null
    or not (
      v_role in (
        'owner'::public.workspace_role,
        'admin'::public.workspace_role,
        'manager'::public.workspace_role
      )
      or (
        v_role = 'member'::public.workspace_role
        and v_attachment.uploaded_by = v_actor
      )
    ) then
    raise exception using errcode = 'P0002', message = 'PTA_ATTACHMENT_NOT_FOUND';
  end if;

  if v_attachment.state in (
    'pending'::public.task_attachment_state,
    'ready'::public.task_attachment_state
  ) then
    return jsonb_build_object(
      'id', v_attachment.id,
      'state', v_attachment.state
    );
  end if;

  if v_attachment.state <> 'deleting'::public.task_attachment_state
    or v_attachment.removal_token is distinct from p_removal_token
    or not (
      v_attachment.delete_requested_by = v_actor
      or v_role in (
        'owner'::public.workspace_role,
        'admin'::public.workspace_role,
        'manager'::public.workspace_role
      )
    ) then
    raise exception using errcode = 'P0002', message = 'PTA_ATTACHMENT_NOT_FOUND';
  end if;

  select
    count(*) > 0,
    coalesce(bool_and(
      case
        when object.metadata ->> 'size' ~ '^[0-9]+$' then
          (object.metadata ->> 'size')::bigint = v_attachment.file_size
          and lower(coalesce(object.metadata ->> 'mimetype', '')) = v_attachment.mime_type
        else false
      end
    ), false)
  into v_object_exists, v_object_matches
  from storage.objects object
  where object.bucket_id = v_attachment.bucket_id
    and object.name = v_attachment.object_path;

  if not v_object_exists or not v_object_matches then
    raise exception using
      errcode = '55000',
      message = 'PTA_ATTACHMENT_CANNOT_RESTORE';
  end if;

  update public.task_attachments attachment
  set
    state = case
      when ready_at is null then 'pending'::public.task_attachment_state
      else 'ready'::public.task_attachment_state
    end,
    delete_requested_by = null,
    delete_requested_at = null,
    removal_token = null,
    removal_lease_expires_at = null
  where attachment.id = p_attachment_id
  returning * into v_attachment;

  perform realtime.send(
    jsonb_build_object(
      'task_id', v_attachment.task_id,
      'attachment_id', v_attachment.id
    ),
    'attachment_changed',
    'task:' || v_attachment.task_id::text,
    true
  );

  return jsonb_build_object(
    'id', v_attachment.id,
    'state', v_attachment.state
  );
end;
$$;

create or replace function public.finalize_remove_task_attachment(
  p_attachment_id uuid,
  p_removal_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role public.workspace_role;
  v_attachment public.task_attachments%rowtype;
begin
  select attachment.*
  into v_attachment
  from public.task_attachments attachment
  where attachment.id = p_attachment_id
    and attachment.state in (
      'deleting'::public.task_attachment_state,
      'deleted'::public.task_attachment_state
    )
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_ATTACHMENT_NOT_FOUND';
  end if;

  v_role := private.task_collaboration_role(v_attachment.task_id);
  if v_role is null
    or v_attachment.removal_token is distinct from p_removal_token
    or not (
      (
        v_attachment.delete_requested_by = v_actor
        and (
          v_role in (
            'owner'::public.workspace_role,
            'admin'::public.workspace_role,
            'manager'::public.workspace_role
          )
          or (
            v_role = 'member'::public.workspace_role
            and v_attachment.uploaded_by = v_actor
          )
        )
      )
      or v_role in (
        'owner'::public.workspace_role,
        'admin'::public.workspace_role,
        'manager'::public.workspace_role
      )
    ) then
    raise exception using errcode = 'P0002', message = 'PTA_ATTACHMENT_NOT_FOUND';
  end if;

  if v_attachment.state = 'deleted'::public.task_attachment_state then
    return jsonb_build_object(
      'id', v_attachment.id,
      'task_id', v_attachment.task_id,
      'removed', true,
      'deleted_at', v_attachment.deleted_at
    );
  end if;

  if exists (
    select 1
    from storage.objects object
    where object.bucket_id = v_attachment.bucket_id
      and object.name = v_attachment.object_path
  ) then
    raise exception using errcode = '55000', message = 'PTA_ATTACHMENT_OBJECT_STILL_EXISTS';
  end if;

  update public.task_attachments attachment
  set
    state = 'deleted'::public.task_attachment_state,
    deleted_by = v_actor,
    deleted_at = clock_timestamp()
  where attachment.id = p_attachment_id
  returning * into v_attachment;

  perform realtime.send(
    jsonb_build_object(
      'task_id', v_attachment.task_id,
      'attachment_id', v_attachment.id
    ),
    'attachment_changed',
    'task:' || v_attachment.task_id::text,
    true
  );

  return jsonb_build_object(
    'id', v_attachment.id,
    'task_id', v_attachment.task_id,
    'removed', true,
    'deleted_at', v_attachment.deleted_at
  );
end;
$$;

create or replace function private.task_attachment_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_actor uuid := (select auth.uid());
begin
  if old.state = 'pending'::public.task_attachment_state
    and new.state = 'ready'::public.task_attachment_state then
    v_action := 'task.attachment_added';
    v_actor := coalesce(v_actor, new.uploaded_by);
  elsif old.state = 'deleting'::public.task_attachment_state
    and new.state = 'deleted'::public.task_attachment_state then
    v_action := 'task.attachment_removed';
    v_actor := coalesce(v_actor, new.deleted_by);
  else
    return new;
  end if;

  insert into public.activity_logs (
    workspace_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata_json
  ) values (
    new.workspace_id,
    v_actor,
    'task',
    new.task_id,
    v_action,
    jsonb_build_object('attachment_id', new.id)
  );

  return new;
end;
$$;

create trigger task_attachments_activity
  after update of state on public.task_attachments
  for each row execute function private.task_attachment_activity();

alter function private.is_valid_task_attachment_type(text, text) owner to postgres;
alter function private.preserve_task_attachment_identity() owner to postgres;
alter function private.can_read_task_attachment_object(text) owner to postgres;
alter function private.can_read_task_attachment_metadata(uuid) owner to postgres;
alter function private.can_upload_task_attachment_object(text) owner to postgres;
alter function private.can_delete_task_attachment_object(text) owner to postgres;
alter function private.task_attachment_activity() owner to postgres;
alter function public.list_task_attachments(uuid) owner to postgres;
alter function public.prepare_task_attachment(uuid, text, text, text, bigint) owner to postgres;
alter function public.complete_task_attachment(uuid) owner to postgres;
alter function public.begin_remove_task_attachment(uuid) owner to postgres;
alter function public.cancel_task_attachment_removal(uuid, uuid) owner to postgres;
alter function public.finalize_remove_task_attachment(uuid, uuid) owner to postgres;

revoke all on function private.is_valid_task_attachment_type(text, text)
  from public, anon, authenticated;
revoke all on function private.preserve_task_attachment_identity()
  from public, anon, authenticated;
revoke all on function private.can_read_task_attachment_object(text)
  from public, anon, authenticated;
revoke all on function private.can_read_task_attachment_metadata(uuid)
  from public, anon, authenticated;
revoke all on function private.can_upload_task_attachment_object(text)
  from public, anon, authenticated;
revoke all on function private.can_delete_task_attachment_object(text)
  from public, anon, authenticated;
revoke all on function private.task_attachment_activity()
  from public, anon, authenticated;

grant execute on function private.can_read_task_attachment_object(text)
  to authenticated;
grant execute on function private.can_read_task_attachment_metadata(uuid)
  to authenticated;
grant execute on function private.can_upload_task_attachment_object(text)
  to authenticated;
grant execute on function private.can_delete_task_attachment_object(text)
  to authenticated;

revoke all on function public.list_task_attachments(uuid)
  from public, anon, authenticated;
revoke all on function public.prepare_task_attachment(uuid, text, text, text, bigint)
  from public, anon, authenticated;
revoke all on function public.complete_task_attachment(uuid)
  from public, anon, authenticated;
revoke all on function public.begin_remove_task_attachment(uuid)
  from public, anon, authenticated;
revoke all on function public.cancel_task_attachment_removal(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_remove_task_attachment(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.list_task_attachments(uuid) to authenticated;
grant execute on function public.prepare_task_attachment(uuid, text, text, text, bigint)
  to authenticated;
grant execute on function public.complete_task_attachment(uuid) to authenticated;
grant execute on function public.begin_remove_task_attachment(uuid) to authenticated;
grant execute on function public.cancel_task_attachment_removal(uuid, uuid)
  to authenticated;
grant execute on function public.finalize_remove_task_attachment(uuid, uuid)
  to authenticated;

comment on table public.task_attachments is
  'Private task attachment metadata. Object paths are canonical and downloads use temporary signed URLs.';
comment on function public.prepare_task_attachment(uuid, text, text, text, bigint) is
  'Reserves a canonical private Storage path after validating task membership, type and size.';
comment on function public.complete_task_attachment(uuid) is
  'Publishes a pending attachment only after matching the private Storage object metadata.';
comment on function public.begin_remove_task_attachment(uuid) is
  'Starts a recoverable two-phase removal and authorizes deletion of the exact Storage object.';
comment on function public.finalize_remove_task_attachment(uuid, uuid) is
  'Soft deletes attachment metadata only after the private Storage object no longer exists.';

commit;
