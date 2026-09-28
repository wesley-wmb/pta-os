begin;
alter table public.task_links add column description text not null default '' check (char_length(description) <= 1000);
alter table public.task_attachments add column description text not null default '' check (char_length(description) <= 1000);
alter table public.task_attachments add column version integer not null default 1;
create or replace function public.save_task_link_with_description(
 p_task_id uuid, p_url text, p_label text default null, p_description text default '',
 p_link_id uuid default null, p_expected_updated_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_link public.task_links%rowtype;
begin
 if auth.uid() is null or private.task_collaboration_role(p_task_id) is null then raise exception 'PTA_TASK_NOT_FOUND'; end if;
 if char_length(coalesce(p_description,'')) > 1000 then raise exception 'PTA_INVALID_DESCRIPTION'; end if;
 if p_link_id is null then
  v_result := public.add_task_link(p_task_id,p_url,p_label);
 else
  select * into v_link from public.task_links where id=p_link_id and task_id=p_task_id and deleted_at is null for update;
  if not found then raise exception 'PTA_LINK_NOT_FOUND'; end if;
  if p_expected_updated_at is null or v_link.updated_at is distinct from p_expected_updated_at then raise exception 'PTA_VERSION_CONFLICT'; end if;
  v_result := public.update_task_link(p_link_id,p_url,p_label);
 end if;
 update public.task_links set description=btrim(coalesce(p_description,'')), updated_at=clock_timestamp() where id=(v_result->>'id')::uuid;
 return v_result;
end; $$;
revoke all on function public.save_task_link_with_description(uuid,text,text,text,uuid,timestamptz) from public,anon;
grant execute on function public.save_task_link_with_description(uuid,text,text,text,uuid,timestamptz) to authenticated;
create or replace function public.prepare_task_media(
 p_task_id uuid, p_file_name text, p_file_extension text, p_mime_type text, p_file_size bigint, p_description text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
 if auth.uid() is null then raise exception 'PTA_FORBIDDEN'; end if;
 if char_length(coalesce(p_description,'')) > 1000 then raise exception 'PTA_INVALID_DESCRIPTION'; end if;
 v_result := public.prepare_task_attachment(p_task_id,p_file_name,p_file_extension,p_mime_type,p_file_size);
 update public.task_attachments set description=btrim(coalesce(p_description,'')) where id=(v_result->>'id')::uuid;
 return v_result;
end; $$;
revoke all on function public.prepare_task_media(uuid,text,text,text,bigint,text) from public,anon;
grant execute on function public.prepare_task_media(uuid,text,text,text,bigint,text) to authenticated;
grant execute on function public.complete_task_attachment(uuid) to authenticated;
create or replace function public.update_task_media_description(p_attachment_id uuid,p_description text,p_expected_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_item public.task_attachments%rowtype; v_role public.workspace_role;
begin
 select * into v_item from public.task_attachments where id=p_attachment_id and state='ready' for update;
 if not found then raise exception 'PTA_ATTACHMENT_NOT_FOUND'; end if;
 v_role := private.task_collaboration_role(v_item.task_id);
 if auth.uid() is null or v_role is null or not (v_role in ('owner','admin','manager') or (v_role='member' and v_item.uploaded_by=auth.uid())) then raise exception 'PTA_FORBIDDEN'; end if;
 if p_expected_version is null or v_item.version <> p_expected_version then raise exception 'PTA_VERSION_CONFLICT'; end if;
 if char_length(coalesce(p_description,'')) > 1000 then raise exception 'PTA_INVALID_DESCRIPTION'; end if;
 update public.task_attachments set description=btrim(coalesce(p_description,'')),version=version+1 where id=p_attachment_id;
 return jsonb_build_object('id',p_attachment_id);
end; $$;
revoke all on function public.update_task_media_description(uuid,text,integer) from public,anon;
grant execute on function public.update_task_media_description(uuid,text,integer) to authenticated;
do $$ declare v_sql text; begin
 v_sql := pg_get_functiondef('private.task_collaboration_payload(uuid)'::regprocedure);
 if position('''label'', link.label,' in v_sql)=0 then raise exception 'Unexpected collaboration payload'; end if;
 execute replace(v_sql, '''label'', link.label,', '''label'', link.label, ''description'', link.description,');
 v_sql := pg_get_functiondef('public.list_task_attachments(uuid)'::regprocedure);
 if position('''file_name'', attachment.file_name,' in v_sql)=0 then raise exception 'Unexpected attachments payload'; end if;
 execute replace(v_sql, '''file_name'', attachment.file_name,', '''file_name'', attachment.file_name, ''description'', attachment.description, ''version'', attachment.version,');
end; $$;
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
    when 'gif' then lower(p_mime_type) = 'image/gif'
    when 'mp3' then lower(p_mime_type) = 'audio/mpeg'
    when 'wav' then lower(p_mime_type) in ('audio/wav','audio/x-wav')
    when 'webm' then lower(p_mime_type) = 'video/webm'
    when 'mov' then lower(p_mime_type) = 'video/quicktime'
    when 'mp4' then lower(p_mime_type) = 'video/mp4'
    else false
  end;
$$;

alter table public.task_attachments drop constraint task_attachments_file_extension_valid;
alter table public.task_attachments add constraint task_attachments_file_extension_valid check (file_extension=lower(file_extension) and file_extension in ('pdf','png','jpg','jpeg','webp','gif','docx','xlsx','csv','txt','zip','mp4','mp3','wav','webm','mov'));
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
    'image/gif','audio/mpeg','audio/wav','audio/x-wav','video/webm','video/quicktime','video/mp4'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists task_attachments_object_insert on storage.objects;
create policy task_attachments_object_insert on storage.objects for insert to authenticated with check (bucket_id='task-attachments' and private.can_upload_task_attachment_object(name));
notify pgrst, 'reload schema';
commit;
