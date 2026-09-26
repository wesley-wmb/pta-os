begin;
create or replace function public.set_task_board_lane_link(
  p_workspace_id uuid,
  p_status_id uuid,
  p_week_lane_key text,
  p_direction text,
  p_enabled boolean,
  p_expected_board_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_board_version integer;
begin
  v_role := private.current_workspace_role(p_workspace_id);
  if v_actor is null or v_role is null or v_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role
  ) then
    raise exception using errcode = '42501', message = 'PTA_BOARD_CONFIGURATION_FORBIDDEN';
  end if;
  if p_direction not in ('both', 'status_to_week', 'week_to_status')
     or p_enabled is null then
    raise exception using errcode = '22023', message = 'PTA_BOARD_LINK_DIRECTION_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pta:task-board:' || p_workspace_id::text, 0)
  );
  select setting.version into v_board_version
  from public.task_board_settings setting
  where setting.workspace_id = p_workspace_id
    and setting.board_kind = 'status'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_BOARD_NOT_FOUND';
  end if;
  if v_board_version is distinct from p_expected_board_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;
  if not exists (
    select 1 from public.task_statuses status
    where status.workspace_id = p_workspace_id
      and status.id = p_status_id
      and status.is_active
  ) or not exists (
    select 1 from public.task_week_lanes lane
    where lane.workspace_id = p_workspace_id
      and lane.lane_key = p_week_lane_key
      and lane.is_active
  ) then
    raise exception using errcode = '23503', message = 'PTA_BOARD_LINK_TARGET_INVALID';
  end if;

  if p_enabled then
    if exists(select 1 from public.task_status_week_lane_links link where link.workspace_id = p_workspace_id and link.week_lane_key = p_week_lane_key and link.status_id <> p_status_id) then
      raise exception using errcode = '22023', message = 'PTA_BOARD_LANE_ALREADY_CONNECTED';
    end if;
    delete from public.task_status_week_lane_links link
      where link.workspace_id = p_workspace_id and link.status_id = p_status_id and link.week_lane_key <> p_week_lane_key;
    insert into public.task_status_week_lane_links (
      workspace_id, status_id, week_lane_key, direction
    ) values (
      p_workspace_id, p_status_id, p_week_lane_key, p_direction
    )
    on conflict (workspace_id, status_id, week_lane_key) do update
      set direction = excluded.direction,
          version = task_status_week_lane_links.version + 1,
          updated_at = clock_timestamp();
  else
    delete from public.task_status_week_lane_links link
    where link.workspace_id = p_workspace_id
      and link.status_id = p_status_id
      and link.week_lane_key = p_week_lane_key;
  end if;

  update public.task_board_settings setting
  set version = setting.version + 1,
      updated_at = clock_timestamp(),
      updated_by = v_actor
  where setting.workspace_id = p_workspace_id
    and setting.board_kind in ('status', 'week');

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, changes_json
  ) values (
    p_workspace_id, v_actor, 'task_board', p_workspace_id,
    'task_board.lane_link_updated',
    jsonb_build_object(
      'status_id', p_status_id,
      'week_lane_key', p_week_lane_key,
      'direction', p_direction,
      'enabled', p_enabled
    )
  );
  return public.get_task_board_configuration(p_workspace_id);
end;
$$;
commit;
