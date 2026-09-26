begin;

alter table public.task_links
  drop constraint task_links_port_range_valid;

alter table public.task_links
  add constraint task_links_port_range_valid check (
    substring(lower(url) from '^https://[^/:?#]+:([0-9]{1,5})') is null
    or (
      substring(lower(url) from '^https://[^/:?#]+:([0-9]{1,5})')::integer
        between 1 and 65535
    )
  );

create or replace function private.task_link_provider(p_url text)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_host text := substring(lower(p_url) from '^https://([^/:?#]+)');
begin
  return case
    when v_host ~ '(^|\.)figma\.com$' then 'figma'
    when v_host ~ '(^|\.)canva\.com$' then 'canva'
    when v_host ~ '(^|\.)(notion\.so|notion\.site)$' then 'notion'
    when v_host ~ '(^|\.)(drive|docs)\.google\.com$' then 'google_drive'
    when v_host ~ '(^|\.)(youtube\.com|youtu\.be)$' then 'youtube'
    when v_host ~ '(^|\.)loom\.com$' then 'loom'
    when v_host ~ '(^|\.)dropbox\.com$' then 'dropbox'
    else 'link'
  end;
end;
$$;

alter table public.task_links disable trigger task_links_activity;

update public.task_links link
set
  provider = private.task_link_provider(link.url),
  updated_at = clock_timestamp()
where link.provider is distinct from private.task_link_provider(link.url);

alter table public.task_links enable trigger task_links_activity;

create or replace function public.remove_task_link(p_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_link public.task_links%rowtype;
begin
  select link.*
  into v_link
  from public.task_links link
  where link.id = p_link_id
    and link.deleted_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_LINK_NOT_FOUND';
  end if;
  v_role := private.task_collaboration_role(v_link.task_id);
  if v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_LINK_NOT_FOUND';
  end if;
  if not (
    v_role in (
      'owner'::public.workspace_role,
      'admin'::public.workspace_role,
      'manager'::public.workspace_role
    )
    or (
      v_role = 'member'::public.workspace_role
      and v_link.created_by = v_actor
    )
  ) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;

  update public.task_links link
  set
    deleted_by = v_actor,
    deleted_at = clock_timestamp(),
    updated_at = clock_timestamp()
  where link.id = p_link_id
    and link.deleted_at is null
  returning * into v_link;

  perform realtime.send(
    jsonb_build_object('task_id', v_link.task_id),
    'link_removed',
    'task:' || v_link.task_id::text,
    true
  );

  return jsonb_build_object(
    'id', v_link.id,
    'task_id', v_link.task_id,
    'removed', true,
    'deleted_at', v_link.deleted_at
  );
end;
$$;

drop policy if exists task_collaboration_broadcast_read
on realtime.messages;

create policy task_collaboration_broadcast_read
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and exists (
    select 1
    from public.tasks task
    where 'task:' || task.id::text = (select realtime.topic())
      and task.archived_at is null
      and private.is_active_workspace_member(task.workspace_id)
  )
);

alter function private.task_link_provider(text) owner to postgres;
alter function public.remove_task_link(uuid) owner to postgres;

revoke all on function private.task_link_provider(text)
from public, anon, authenticated;
revoke all on function public.remove_task_link(uuid)
from public, anon, authenticated;

grant execute on function public.remove_task_link(uuid)
to authenticated;

comment on policy task_collaboration_broadcast_read on realtime.messages is
  'Allows active task workspace members to receive private invalidations.';

commit;
