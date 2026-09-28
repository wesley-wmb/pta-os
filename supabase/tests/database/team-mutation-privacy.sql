-- Run as postgres in a transaction. All fixtures and changes roll back.
begin;
do $$
declare
  v_workspace uuid; v_actor uuid; v_team uuid; v_event uuid; v_task uuid;
  v_data jsonb; v_blocked boolean; v_version integer;
begin
  select workspace_id,user_id into v_workspace,v_actor from public.workspace_members
  where role='owner' and status='active' and removed_at is null limit 1;
  if v_actor is null then raise exception 'An active workspace owner is required'; end if;
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
  v_data := public.create_operating_team_workspace(v_workspace,'Privacy rollback fixture','privacy-'||replace(gen_random_uuid()::text,'-',''));
  v_team := (v_data->'team'->>'id')::uuid;
  v_event := (v_data->'team'->>'workspace_event_id')::uuid;
  v_data := public.create_context_task(v_workspace,'event',v_event,'Team privacy rollback task');
  v_task := (v_data->>'id')::uuid;
  if not exists(select 1 from public.tasks where id=v_task and team_id=v_team) then
    raise exception 'FAIL: task inherited default team instead of context team';
  end if;
  perform public.update_task(v_task,1,jsonb_build_object('title','Updated by team member'));
  select version into v_version from public.tasks where id=v_task;
  -- Simulate revocation by maintenance; owner remains active in workspace.
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);
  update public.team_members set removed_at=now(),removed_by=v_actor,is_primary=false
    where workspace_id=v_workspace and team_id=v_team and user_id=v_actor;
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
  if private.can_edit_task(v_task) or private.task_collaboration_role(v_task) is not null then
    raise exception 'FAIL: nonmember owner retains edit or attachment access';
  end if;
  v_blocked := false;
  begin perform public.update_task(v_task,v_version,jsonb_build_object('title','Unauthorized'));
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: nonmember owner mutation succeeded'; end if;
  v_blocked := false;
  begin perform public.create_context_task(v_workspace,'event',v_event,'Unauthorized creation');
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'FAIL: nonmember owner task creation succeeded'; end if;
  raise notice 'PASS: team task attribution; member edit; nonmember edit/create/storage gate denied';
end;
$$;
rollback;
