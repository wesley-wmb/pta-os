begin;

-- Keep the same authorization/version contract and notify only this task's
-- private subscribers after a successful description mutation.
create or replace function public.update_task_media_description(
  p_attachment_id uuid,
  p_description text,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.task_attachments%rowtype;
  v_role public.workspace_role;
begin
  if auth.uid() is null then raise exception 'PTA_FORBIDDEN'; end if;
  select * into v_item from public.task_attachments
  where id = p_attachment_id and state = 'ready' for update;
  if not found then raise exception 'PTA_ATTACHMENT_NOT_FOUND'; end if;
  v_role := private.task_collaboration_role(v_item.task_id);
  if v_role is null or not (
    v_role in ('owner', 'admin', 'manager') or
    (v_role = 'member' and v_item.uploaded_by = auth.uid())
  ) then raise exception 'PTA_FORBIDDEN'; end if;
  if p_expected_version is null or v_item.version <> p_expected_version then
    raise exception 'PTA_VERSION_CONFLICT';
  end if;
  if char_length(coalesce(p_description, '')) > 1000 then
    raise exception 'PTA_INVALID_DESCRIPTION';
  end if;
  update public.task_attachments
  set description = btrim(coalesce(p_description, '')), version = version + 1
  where id = p_attachment_id;
  perform realtime.send(
    jsonb_build_object('task_id', v_item.task_id, 'attachment_id', v_item.id),
    'attachment_changed', 'task:' || v_item.task_id::text, true
  );
  return jsonb_build_object('id', p_attachment_id);
end;
$$;
revoke all on function public.update_task_media_description(uuid, text, integer) from public, anon;
grant execute on function public.update_task_media_description(uuid, text, integer) to authenticated;

commit;
