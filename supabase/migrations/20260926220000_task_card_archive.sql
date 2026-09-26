begin;
create or replace function public.set_task_card_archived(p_workspace_id uuid, p_task_id uuid, p_expected_version integer, p_archived boolean)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks%rowtype; v_role public.workspace_role; v_version integer;
begin
  v_role := private.current_workspace_role(p_workspace_id);
  if auth.uid() is null or v_role is null or v_role = 'viewer' then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  select * into v_task from public.tasks where workspace_id = p_workspace_id and id = p_task_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND'; end if;
  if v_task.version is distinct from p_expected_version then raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT'; end if;
  if p_archived is null then raise exception using errcode = '22023', message = 'PTA_INVALID_ARCHIVE_STATE'; end if;
  if p_archived and not private.can_edit_task(p_task_id) then raise exception using errcode = '42501', message = 'PTA_FORBIDDEN'; end if;
  if not p_archived and v_role not in ('owner','admin','manager') and v_task.archived_by is distinct from auth.uid() then raise exception using errcode = '42501', message = 'PTA_FORBIDDEN'; end if;
  update public.tasks set archived_at = case when p_archived then clock_timestamp() else null end,
    archived_by = case when p_archived then auth.uid() else null end, updated_by = auth.uid()
    where workspace_id = p_workspace_id and id = p_task_id returning version into v_version;
  insert into public.activity_logs(workspace_id,actor_id,entity_type,entity_id,action)
    values(p_workspace_id,auth.uid(),'task',p_task_id,case when p_archived then 'task.archived' else 'task.restored' end);
  return v_version;
end;
$$;
revoke all on function public.set_task_card_archived(uuid,uuid,integer,boolean) from public, anon;
grant execute on function public.set_task_card_archived(uuid,uuid,integer,boolean) to authenticated;
commit;
