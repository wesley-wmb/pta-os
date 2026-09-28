-- Retired lanes keep a destination so older clients and default task creation
-- cannot strand a task in an invisible column.
alter table public.task_week_lanes add column redirect_lane_key text;
alter table public.task_week_lanes add constraint task_week_lane_redirect_fk
  foreign key (workspace_id,redirect_lane_key) references public.task_week_lanes(workspace_id,lane_key);
alter table public.task_week_lanes add constraint task_week_lane_redirect_valid
  check (redirect_lane_key is null or (not is_active and redirect_lane_key<>lane_key));

create or replace function private.route_retired_week_lane()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_destination text; v_status uuid;
begin
  select redirect_lane_key into v_destination from public.task_week_lanes
    where workspace_id=new.workspace_id and lane_key=new.week_lane for share;
  if v_destination is not null then
    new.week_lane := v_destination;
    select status_id into v_status from public.task_status_week_lane_links
      where workspace_id=new.workspace_id and week_lane_key=v_destination
        and direction in ('both','week_to_status');
    new.status_id := coalesce(v_status,new.status_id);
  end if;
  return new;
end;
$$;
create trigger tasks_01_route_retired_week_lane
before insert or update of status_id,week_lane on public.tasks
for each row execute function private.route_retired_week_lane();

create or replace function public.delete_week_board_column(
  p_workspace_id uuid,p_lane_key text,p_destination_key text,p_expected_board_version integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_role public.workspace_role := private.current_workspace_role(p_workspace_id);
  v_version integer; v_task record; v_position numeric; v_count integer:=0;
begin
  if auth.uid() is null or v_role is null or v_role not in ('owner','admin','manager') then
    raise exception using errcode='42501',message='PTA_BOARD_CONFIGURATION_FORBIDDEN';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace_id::text,713421));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pta:task-board:'||p_workspace_id::text,0));
  select version into v_version from public.task_board_settings
    where workspace_id=p_workspace_id and board_kind='week' for update;
  if v_version is null or v_version is distinct from p_expected_board_version then
    raise exception using errcode='40001',message='PTA_VERSION_CONFLICT';
  end if;
  if p_lane_key='scheduled' or not exists(select 1 from public.task_week_lanes
    where workspace_id=p_workspace_id and lane_key=p_lane_key and is_active) then
    raise exception 'PTA_BOARD_COLUMN_NOT_FOUND';
  end if;
  if p_destination_key=p_lane_key or p_destination_key='scheduled' or not exists(
    select 1 from public.task_week_lanes where workspace_id=p_workspace_id and lane_key=p_destination_key and is_active
  ) then raise exception 'PTA_BOARD_DESTINATION_REQUIRED'; end if;
  if exists(select 1 from public.task_status_week_lane_links link join public.task_statuses status
    on status.workspace_id=link.workspace_id and status.id=link.status_id
    where link.workspace_id=p_workspace_id and link.week_lane_key=p_destination_key and status.system_category='blocked'
  ) then raise exception 'PTA_BOARD_DESTINATION_BLOCKED'; end if;
  delete from public.task_status_week_lane_links where workspace_id=p_workspace_id and week_lane_key=p_lane_key;
  update public.task_week_lanes set redirect_lane_key=p_destination_key
    where workspace_id=p_workspace_id and redirect_lane_key=p_lane_key;
  update public.task_week_lanes set is_active=false,redirect_lane_key=p_destination_key
    where workspace_id=p_workspace_id and lane_key=p_lane_key;
  select coalesce(max(week_position),0) into v_position from public.tasks
    where workspace_id=p_workspace_id and week_lane=p_destination_key;
  for v_task in select id,version from public.tasks where workspace_id=p_workspace_id and week_lane=p_lane_key
    order by week_position,id for update
  loop
    v_position:=v_position+1000;
    -- Preserve dates, projects and archived state. Normal task triggers update
    -- version and apply the destination's configured status connection.
    update public.tasks set week_lane=p_destination_key,week_position=v_position,updated_by=auth.uid()
      where workspace_id=p_workspace_id and id=v_task.id and version=v_task.version;
    if not found then raise exception using errcode='40001',message='PTA_VERSION_CONFLICT'; end if;
    v_count:=v_count+1;
  end loop;
  update public.task_board_settings set version=version+1,updated_at=clock_timestamp(),updated_by=auth.uid()
    where workspace_id=p_workspace_id and board_kind in ('week','status');
  insert into public.activity_logs(workspace_id,actor_id,entity_type,entity_id,action,changes_json)
    values(p_workspace_id,auth.uid(),'task_board',p_workspace_id,'week_board.column_deleted',
      jsonb_build_object('lane',p_lane_key,'destination',p_destination_key,'tasks_moved',v_count));
  return public.get_task_board_configuration(p_workspace_id);
end;
$$;
revoke all on function private.route_retired_week_lane() from public,anon,authenticated;
revoke all on function public.delete_week_board_column(uuid,text,text,integer) from public,anon;
grant execute on function public.delete_week_board_column(uuid,text,text,integer) to authenticated;
