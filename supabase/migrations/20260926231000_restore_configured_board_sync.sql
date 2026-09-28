create or replace function private.sync_task_special_lanes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_lane text;
  v_target_status uuid;
  v_old_lane text;
  v_old_status uuid;
begin
  if tg_op = 'INSERT' then
    select link.week_lane_key
    into v_target_lane
    from public.task_status_week_lane_links link
    where link.workspace_id = new.workspace_id
      and link.status_id = new.status_id
      and link.direction in ('both', 'status_to_week')
    limit 1;
    new.week_lane := coalesce(v_target_lane, new.week_lane);
    return new;
  end if;

  if new.status_id is distinct from old.status_id then
    select link.week_lane_key
    into v_target_lane
    from public.task_status_week_lane_links link
    where link.workspace_id = new.workspace_id
      and link.status_id = new.status_id
      and link.direction in ('both', 'status_to_week')
    limit 1;

    if v_target_lane is not null then
      new.week_lane := v_target_lane;
    else
      select link.week_lane_key
      into v_old_lane
      from public.task_status_week_lane_links link
      where link.workspace_id = old.workspace_id
        and link.status_id = old.status_id
        and link.direction in ('both', 'status_to_week')
      limit 1;
      if v_old_lane = old.week_lane then
        new.week_lane := case
          when new.due_date is null then 'backlog'
          else 'scheduled'
        end;
      end if;
    end if;
  elsif new.week_lane is distinct from old.week_lane then
    select link.status_id
    into v_target_status
    from public.task_status_week_lane_links link
    where link.workspace_id = new.workspace_id
      and link.week_lane_key = new.week_lane
      and link.direction in ('both', 'week_to_status')
    limit 1;

    if v_target_status is not null then
      new.status_id := v_target_status;
    else
      select link.status_id
      into v_old_status
      from public.task_status_week_lane_links link
      where link.workspace_id = old.workspace_id
        and link.week_lane_key = old.week_lane
        and link.direction in ('both', 'week_to_status')
      limit 1;
      if v_old_status = old.status_id then
        select status.id
        into v_target_status
        from public.task_statuses status
        where status.workspace_id = new.workspace_id
          and status.is_active
          and status.is_default
        order by status.position, status.id
        limit 1;
        new.status_id := coalesce(v_target_status, new.status_id);
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_00_sync_special_lanes on public.tasks;
create trigger tasks_00_sync_special_lanes
before insert or update of status_id, week_lane on public.tasks
for each row execute function private.sync_task_special_lanes();
