-- Link the exceptional operational lanes shared by the status and weekly boards.
-- Status remains the workflow source; week_lane remains the weekly placement.

begin;

-- Preserve the current status order while making room for the leading lane.
update public.task_statuses status
set position = status.position + 10
where status.is_active
  and lower(btrim(status.name)) <> 'emergência';

update public.task_statuses status
set
  position = 0,
  color = 'red',
  system_category = 'todo'
where status.is_active
  and lower(btrim(status.name)) = 'emergência';

insert into public.task_statuses (
  workspace_id,
  name,
  system_category,
  color,
  position,
  is_default
)
select
  workspace.id,
  'Emergência',
  'todo',
  'red',
  0,
  false
from public.workspaces workspace
where workspace.archived_at is null
  and not exists (
    select 1
    from public.task_statuses status
    where status.workspace_id = workspace.id
      and status.is_active
      and lower(btrim(status.name)) = 'emergência'
  );

update public.task_statuses status
set name = 'Alterações'
where status.is_active
  and status.system_category = 'review'
  and lower(btrim(status.name)) = 'em revisão'
  and not exists (
    select 1
    from public.task_statuses existing
    where existing.workspace_id = status.workspace_id
      and existing.id <> status.id
      and lower(btrim(existing.name)) = 'alterações'
  );

create or replace function private.sync_task_special_lanes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_status_name text;
  v_new_status_category public.task_status_category;
  v_old_status_name text;
  v_old_status_category public.task_status_category;
  v_linked_status_id uuid;
begin
  select lower(btrim(status.name)), status.system_category
  into v_new_status_name, v_new_status_category
  from public.task_statuses status
  where status.workspace_id = new.workspace_id
    and status.id = new.status_id;

  if tg_op = 'INSERT' then
    if v_new_status_name = 'emergência' then
      new.week_lane := 'emergency';
    elsif v_new_status_category = 'review' then
      new.week_lane := 'revision';
    end if;
    return new;
  end if;

  select lower(btrim(status.name)), status.system_category
  into v_old_status_name, v_old_status_category
  from public.task_statuses status
  where status.workspace_id = old.workspace_id
    and status.id = old.status_id;

  if new.week_lane is distinct from old.week_lane then
    if new.week_lane = 'emergency' then
      select status.id into v_linked_status_id
      from public.task_statuses status
      where status.workspace_id = new.workspace_id
        and status.is_active
        and lower(btrim(status.name)) = 'emergência'
      order by status.position, status.id
      limit 1;
      new.status_id := coalesce(v_linked_status_id, new.status_id);
    elsif new.week_lane = 'revision' then
      select status.id into v_linked_status_id
      from public.task_statuses status
      where status.workspace_id = new.workspace_id
        and status.is_active
        and status.system_category = 'review'
      order by status.position, status.id
      limit 1;
      new.status_id := coalesce(v_linked_status_id, new.status_id);
    elsif new.status_id = old.status_id
      and (
        v_old_status_name = 'emergência'
        or v_old_status_category = 'review'
      ) then
      select status.id into v_linked_status_id
      from public.task_statuses status
      where status.workspace_id = new.workspace_id
        and status.is_active
        and status.is_default
      order by status.position, status.id
      limit 1;
      new.status_id := coalesce(v_linked_status_id, new.status_id);
    end if;
  elsif new.status_id is distinct from old.status_id then
    if v_new_status_name = 'emergência' then
      new.week_lane := 'emergency';
    elsif v_new_status_category = 'review' then
      new.week_lane := 'revision';
    elsif old.week_lane in ('emergency', 'revision') then
      new.week_lane := case
        when new.due_date is null then 'backlog'
        else 'scheduled'
      end;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_00_sync_special_lanes on public.tasks;
create trigger tasks_00_sync_special_lanes
before insert or update of status_id, week_lane on public.tasks
for each row execute function private.sync_task_special_lanes();

-- Bring existing tasks into the shared state once. The normal write trigger
-- keeps versioning and audit behavior intact for this data migration.
update public.tasks task
set week_lane = 'emergency'
from public.task_statuses status
where status.workspace_id = task.workspace_id
  and status.id = task.status_id
  and lower(btrim(status.name)) = 'emergência'
  and task.week_lane <> 'emergency';

update public.tasks task
set week_lane = 'revision'
from public.task_statuses status
where status.workspace_id = task.workspace_id
  and status.id = task.status_id
  and status.system_category = 'review'
  and task.week_lane <> 'revision';

comment on function private.sync_task_special_lanes() is
  'Keeps Emergência/emergency and Alterações/revision synchronized across task boards.';

commit;
