-- Columns are workspace-wide. Removing one transfers tasks; it never deletes them.
create or replace function public.manage_task_board_column(
  p_workspace_id uuid, p_expected_board_version integer, p_action text,
  p_name text default null, p_column_id uuid default null, p_destination_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role := private.current_workspace_role(p_workspace_id);
  v_version integer;
  v_source public.task_statuses%rowtype;
  v_destination public.task_statuses%rowtype;
  v_task record;
  v_id uuid := gen_random_uuid();
begin
  if v_actor is null or v_role is null or v_role not in ('owner','admin','manager') then
    raise exception using errcode='42501', message='PTA_BOARD_CONFIGURATION_FORBIDDEN';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace_id::text,713421));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pta:task-board:' || p_workspace_id::text,0));
  select version into v_version from public.task_board_settings
    where workspace_id=p_workspace_id and board_kind='status' for update;
  if v_version is null or v_version is distinct from p_expected_board_version then
    raise exception using errcode='40001', message='PTA_VERSION_CONFLICT';
  end if;
  if p_action='create' then
    if char_length(btrim(coalesce(p_name,''))) not between 1 and 80 then
      raise exception using errcode='22023', message='PTA_BOARD_COLUMN_NAME_INVALID';
    end if;
    insert into public.task_statuses(id,workspace_id,name,system_category,position,semantic_key)
      select v_id,p_workspace_id,btrim(p_name),'todo',coalesce(max(position),0)+10,
        'custom-' || replace(v_id::text,'-','') from public.task_statuses where workspace_id=p_workspace_id;
  elsif p_action='delete' then
    select * into v_source from public.task_statuses
      where workspace_id=p_workspace_id and id=p_column_id and is_active for update;
    if not found then raise exception 'PTA_BOARD_COLUMN_NOT_FOUND'; end if;
    select * into v_destination from public.task_statuses
      where workspace_id=p_workspace_id and id=p_destination_id and is_active and id<>p_column_id for update;
    if not found then raise exception 'PTA_BOARD_DESTINATION_REQUIRED'; end if;
    if v_destination.system_category='blocked' then raise exception 'PTA_BOARD_DESTINATION_BLOCKED'; end if;
    for v_task in select id,version from public.tasks
      where workspace_id=p_workspace_id and status_id=p_column_id and archived_at is null
      order by id for update
    loop
      perform public.move_task_in_board(p_workspace_id,v_task.id,p_destination_id,null,null,v_task.version,null);
    end loop;
    -- Archived tasks retain their archive state, but can later be restored to an active column.
    update public.tasks set status_id=p_destination_id,updated_by=v_actor
      where workspace_id=p_workspace_id and status_id=p_column_id and archived_at is not null;
    delete from public.task_status_week_lane_links where workspace_id=p_workspace_id and status_id=p_column_id;
    update public.task_statuses set is_active=false,is_default=false where workspace_id=p_workspace_id and id=p_column_id;
    if v_source.is_default then
      update public.task_statuses set is_default=true where workspace_id=p_workspace_id and id=p_destination_id;
    end if;
    v_id := p_column_id;
  else raise exception 'PTA_BOARD_ACTION_INVALID';
  end if;
  update public.task_board_settings set version=version+1,updated_at=clock_timestamp(),updated_by=v_actor
    where workspace_id=p_workspace_id and board_kind='status';
  insert into public.activity_logs(workspace_id,actor_id,entity_type,entity_id,action,changes_json)
    values(p_workspace_id,v_actor,'task_board',v_id,'task_board.column_' || p_action,
      jsonb_build_object('destination_id',p_destination_id));
  return public.get_task_board_configuration(p_workspace_id);
end;
$$;
revoke all on function public.manage_task_board_column(uuid,integer,text,text,uuid,uuid) from public,anon;
grant execute on function public.manage_task_board_column(uuid,integer,text,text,uuid,uuid) to authenticated;

-- Replacing a connection from the Week editor is one transaction, including rollback on conflict.
create or replace function public.connect_week_board_column(p_workspace_id uuid,p_week_lane_key text,p_status_id uuid,p_expected_board_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_role public.workspace_role := private.current_workspace_role(p_workspace_id);
  v_version integer;
  v_previous uuid;
  v_result jsonb;
begin
  if auth.uid() is null or v_role is null or v_role not in ('owner','admin','manager') then raise exception using errcode='42501',message='PTA_BOARD_CONFIGURATION_FORBIDDEN'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pta:task-board:' || p_workspace_id::text,0));
  select version into v_version from public.task_board_settings where workspace_id=p_workspace_id and board_kind='status' for update;
  if v_version is null or v_version is distinct from p_expected_board_version then raise exception using errcode='40001',message='PTA_VERSION_CONFLICT'; end if;
  if p_status_id is not null and exists(select 1 from public.task_status_week_lane_links where workspace_id=p_workspace_id and status_id=p_status_id and week_lane_key<>p_week_lane_key) then raise exception 'PTA_BOARD_LANE_ALREADY_CONNECTED'; end if;
  select status_id into v_previous from public.task_status_week_lane_links where workspace_id=p_workspace_id and week_lane_key=p_week_lane_key;
  if v_previous is not null and v_previous is distinct from p_status_id then
    v_result := public.set_task_board_lane_link(p_workspace_id,v_previous,p_week_lane_key,'both',false,v_version);
    v_version := (v_result#>>'{status_board,version}')::integer;
  end if;
  if p_status_id is not null then
    return public.set_task_board_lane_link(p_workspace_id,p_status_id,p_week_lane_key,'both',true,v_version);
  end if;
  return public.get_task_board_configuration(p_workspace_id);
end;
$$;
revoke all on function public.connect_week_board_column(uuid,text,uuid,integer) from public,anon;
grant execute on function public.connect_week_board_column(uuid,text,uuid,integer) to authenticated;
