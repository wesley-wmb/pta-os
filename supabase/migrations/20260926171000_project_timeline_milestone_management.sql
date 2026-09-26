-- Complete, versioned milestone management for the project timeline.

begin;

create or replace function public.update_event_milestone(
  p_workspace_id uuid,
  p_milestone_id uuid,
  p_expected_version integer,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_milestone public.event_milestones%rowtype;
  v_phase_id uuid;
begin
  if v_actor is null
     or coalesce(private.current_workspace_role(p_workspace_id) not in ('owner', 'admin', 'manager'), true) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception using errcode = '22023', message = 'PTA_PATCH_MUST_BE_OBJECT';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_patch) patch(key)
    where patch.key <> all (array['title', 'due_date', 'event_phase_id']::text[])
  ) then
    raise exception using errcode = '22023', message = 'PTA_PATCH_HAS_UNSUPPORTED_FIELDS';
  end if;

  select milestone.* into v_milestone
  from public.event_milestones milestone
  where milestone.workspace_id = p_workspace_id
    and milestone.id = p_milestone_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_MILESTONE_NOT_FOUND';
  end if;
  if v_milestone.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  v_phase_id := case
    when p_patch ? 'event_phase_id' then nullif(p_patch->>'event_phase_id', '')::uuid
    else v_milestone.event_phase_id
  end;
  if v_phase_id is not null and not exists (
    select 1 from public.event_phases phase
    where phase.workspace_id = p_workspace_id
      and phase.event_id = v_milestone.event_id
      and phase.id = v_phase_id
      and phase.archived_at is null
  ) then
    raise exception using errcode = '23514', message = 'PTA_PHASE_NOT_ACTIVE';
  end if;

  update public.event_milestones milestone set
    title = case when p_patch ? 'title' then p_patch->>'title' else milestone.title end,
    due_date = case when p_patch ? 'due_date' then nullif(p_patch->>'due_date', '')::date else milestone.due_date end,
    event_phase_id = v_phase_id,
    updated_by = v_actor
  where milestone.workspace_id = p_workspace_id
    and milestone.id = p_milestone_id
    and milestone.version = p_expected_version
  returning * into v_milestone;
  if not found then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, changes_json
  ) values (
    p_workspace_id, v_actor, 'event_milestone', v_milestone.id,
    'event.milestone_updated', p_patch
  );

  return jsonb_build_object(
    'id', v_milestone.id,
    'version', v_milestone.version,
    'title', v_milestone.title,
    'due_date', v_milestone.due_date,
    'event_phase_id', v_milestone.event_phase_id,
    'updated_at', v_milestone.updated_at
  );
end;
$$;

create or replace function public.delete_event_milestone(
  p_workspace_id uuid,
  p_milestone_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_milestone public.event_milestones%rowtype;
begin
  if v_actor is null
     or coalesce(private.current_workspace_role(p_workspace_id) not in ('owner', 'admin', 'manager'), true) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;

  select milestone.* into v_milestone
  from public.event_milestones milestone
  where milestone.workspace_id = p_workspace_id
    and milestone.id = p_milestone_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_MILESTONE_NOT_FOUND';
  end if;
  if v_milestone.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  delete from public.event_milestones milestone
  where milestone.workspace_id = p_workspace_id
    and milestone.id = p_milestone_id
    and milestone.version = p_expected_version;
  if not found then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, metadata_json
  ) values (
    p_workspace_id, v_actor, 'event_milestone', v_milestone.id,
    'event.milestone_deleted',
    jsonb_build_object(
      'event_id', v_milestone.event_id,
      'title', v_milestone.title,
      'due_date', v_milestone.due_date,
      'event_phase_id', v_milestone.event_phase_id
    )
  );

  return jsonb_build_object('id', v_milestone.id, 'deleted', true);
end;
$$;

alter function public.update_event_milestone(uuid, uuid, integer, jsonb) owner to postgres;
alter function public.delete_event_milestone(uuid, uuid, integer) owner to postgres;

revoke all on function public.update_event_milestone(uuid, uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.delete_event_milestone(uuid, uuid, integer) from public, anon, authenticated;

grant execute on function public.update_event_milestone(uuid, uuid, integer, jsonb) to authenticated;
grant execute on function public.delete_event_milestone(uuid, uuid, integer) to authenticated;

commit;
