-- Team privacy is enforced for RPC writes as well as direct RLS reads.
-- SECURITY DEFINER mutations bypass table RLS, so guard their actual writes.
create or replace function private.can_edit_task(p_task_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_read_task(p_task_id) and exists (
    select 1 from public.tasks t
    join public.workspace_members wm on wm.workspace_id = t.workspace_id
      and wm.user_id = (select auth.uid()) and wm.status = 'active' and wm.removed_at is null
    join public.profiles p on p.id = wm.user_id and p.is_active
    join public.workspaces w on w.id = wm.workspace_id and w.archived_at is null
    where t.id = p_task_id and t.archived_at is null
      and (wm.role in ('owner', 'admin', 'manager') or (
        wm.role = 'member' and (t.created_by = (select auth.uid()) or exists (
          select 1 from public.task_assignees ta where ta.workspace_id = t.workspace_id
          and ta.task_id = t.id and ta.user_id = (select auth.uid())
        ))
      ))
  );
$$;

create or replace function private.task_collaboration_role(p_task_id uuid)
returns public.workspace_role language sql stable security definer set search_path = '' as $$
  select wm.role from public.tasks task
  join public.workspaces workspace on workspace.id = task.workspace_id and workspace.archived_at is null
  join public.workspace_members wm on wm.workspace_id = task.workspace_id
    and wm.user_id = (select auth.uid()) and wm.status = 'active' and wm.removed_at is null
  join public.profiles profile on profile.id = wm.user_id and profile.is_active
  where task.id = p_task_id and task.archived_at is null and private.can_read_task(task.id)
  limit 1;
$$;

create or replace function private.guard_team_context_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_rows jsonb[] := array[]::jsonb[];
  v_row jsonb;
  v_key text;
  v_id uuid;
begin
  -- Trusted maintenance/service operations have no user identity. User RPCs
  -- already require auth.uid(); never grant a user an RLS-bypass exception.
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  -- Only the archive cascade may write its internal event after membership
  -- removal. Its initiating team RPC is membership-guarded below.
  if tg_table_name = 'events' and tg_op = 'UPDATE' and pg_trigger_depth() > 1 then
    if old.archived_at is null and new.archived_at is not null
      and new.primary_team_id is not distinct from old.primary_team_id
      and exists(select 1 from public.teams t where t.workspace_id = old.workspace_id
        and t.workspace_event_id = old.id and t.id = old.primary_team_id
        and t.archived_at = new.archived_at) then
      return new;
    end if;
  end if;
  if tg_op <> 'INSERT' then v_rows := array_append(v_rows, to_jsonb(old)); end if;
  if tg_op <> 'DELETE' then v_rows := array_append(v_rows, to_jsonb(new)); end if;
  foreach v_row in array v_rows loop
    if tg_table_name = 'events' then
      -- New events have no existing row yet. Their intended primary team must
      -- be visible; updates/deletes also verify the previous context below.
      if nullif(v_row ->> 'primary_team_id', '') is not null
        and not private.can_read_team((v_row ->> 'primary_team_id')::uuid) then
        raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
      end if;
      if tg_op <> 'INSERT' and not private.can_read_event((old.id)::uuid) then
        raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
      end if;
    else
      foreach v_key in array array['event_id','task_id','parent_task_id','child_task_id','blocking_task_id','blocked_task_id','source_task_id','target_task_id'] loop
        v_id := nullif(v_row ->> v_key, '')::uuid;
        if v_id is not null and (
          (v_key = 'event_id' and not private.can_read_event(v_id)) or
          (v_key <> 'event_id' and not private.can_read_task(v_id))
        ) then
          raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
        end if;
      end loop;
      if tg_table_name = 'tasks' then
        if nullif(v_row ->> 'team_id', '') is not null
          and not private.can_read_team((v_row ->> 'team_id')::uuid) then
          raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
        end if;
        if tg_op <> 'INSERT' and not private.can_read_task(old.id) then
          raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
        end if;
      end if;
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
alter function private.guard_team_context_write() owner to postgres;
revoke all on function private.guard_team_context_write() from public, anon, authenticated;

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'events','tasks','event_members','event_milestones','event_phases',
    'resource_events','resource_tasks','task_assignees','task_attachments',
    'task_comments','task_links','task_checklists','task_checklist_items',
    'task_custom_field_values','task_dependencies','task_subtasks',
    'task_approval_requests','task_handoffs'
  ] loop
    execute format('create trigger zzz_team_context_write before insert or update or delete on public.%I for each row execute function private.guard_team_context_write()', v_table);
  end loop;
end;
$$;

-- Existing attachment object read/write policies delegate to
-- task_collaboration_role(), now constrained above. New signed URLs cannot
-- be issued after removal; already-issued short-lived URLs expire normally.
create policy team_task_broadcast_membership on realtime.messages
as restrictive for select to authenticated
using (
  extension <> 'broadcast' or realtime.topic() not like 'task:%' or exists (
    select 1 from public.tasks task
    where 'task:' || task.id::text = realtime.topic()
      and private.can_read_task(task.id)
  )
);


-- Preserve installed RPC behavior, versions, validations and audit records;
-- insert one explicit membership gate at the start of each team mutation.
do $$
declare
  v_function regprocedure;
  v_definition text;
  v_guarded text;
begin
  foreach v_function in array array[
    'public.update_operating_team(uuid,integer,jsonb)'::regprocedure,
    'public.archive_operating_team(uuid,integer)'::regprocedure,
    'public.upsert_team_member(uuid,uuid,public.team_member_role,boolean,integer)'::regprocedure,
    'public.remove_team_member(uuid,uuid,integer)'::regprocedure,
    'public.set_team_member_functions(uuid,uuid,uuid[],uuid,integer)'::regprocedure
  ] loop
    v_definition := pg_get_functiondef(v_function);
    v_guarded := regexp_replace(v_definition, E'\\mbegin\\M',
      E'begin\n  if auth.uid() is null or not private.can_read_team(p_team_id) then\n    raise exception using errcode = ''42501'', message = ''PTA_TEAM_FORBIDDEN'';\n  end if;', 'i');
    if v_guarded = v_definition then raise exception 'Team mutation guard insertion failed for %', v_function; end if;
    execute v_guarded;
  end loop;
end;
$$;


-- Team workspaces reuse events internally, but their tasks belong to that
-- team rather than the legacy default team. Runs before zz_tasks_* validation.
create or replace function private.task_team_workspace_context()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_team_id uuid;
begin
  if new.event_id is not null then
    select t.id into v_team_id from public.teams t
    where t.workspace_id = new.workspace_id and t.workspace_event_id = new.event_id
      and t.archived_at is null;
    if v_team_id is not null then new.team_id := v_team_id; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.task_team_workspace_context() from public,anon,authenticated;
create trigger zy_task_team_workspace_context before insert or update on public.tasks
  for each row execute function private.task_team_workspace_context();
