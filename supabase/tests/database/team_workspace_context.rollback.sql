-- Hosted smoke with disposable fixtures, fully rolled back.
begin;
do $$
declare w uuid; actor uuid; team jsonb; context_id uuid; result jsonb; v integer;
begin
  select workspace_id,user_id into w,actor from public.workspace_members
    where role = 'owner' and status = 'active' and removed_at is null limit 1;
  if actor is null then raise exception 'Test requires active workspace owner'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  team := public.create_operating_team_workspace(w,'Workspace verification','verify-' || gen_random_uuid()::text)->'team';
  context_id := (team->>'workspace_event_id')::uuid;
  assert context_id is not null, 'Missing internal context';
  assert exists(select 1 from public.events where id = context_id and workspace_id = w
    and primary_team_id = (team->>'id')::uuid and archived_at is null), 'Invalid context';
  assert exists(select 1 from jsonb_array_elements(public.list_team_directory(w)->'teams') t
    where t->>'id' = team->>'id' and t->>'workspace_event_id' = context_id::text
      and (t->>'task_count')::integer = 0), 'Directory context/count mismatch';
  select version into v from public.events where id = context_id;
  begin
    perform public.set_project_team(w,context_id,null,v);
    raise exception 'Expected context detach rejection';
  exception when check_violation then
    if sqlerrm <> 'PTA_TEAM_WORKSPACE_PROTECTED' then raise; end if;
  end;
  begin
    update public.events set archived_at = now() where id = context_id;
    raise exception 'Expected independent archive rejection';
  exception when check_violation then
    if sqlerrm <> 'PTA_TEAM_WORKSPACE_PROTECTED' then raise; end if;
  end;
  begin
    perform public.archive_team_workspace((team->>'id')::uuid,(team->>'version')::integer - 1);
    raise exception 'Expected stale version rejection';
  exception when sqlstate '40001' then null; end;
  begin
    perform public.create_operating_team_workspace(gen_random_uuid(),'Forbidden','forbidden');
    raise exception 'Expected cross workspace rejection';
  exception when insufficient_privilege then null; end;
  result := public.archive_team_workspace((team->>'id')::uuid,(team->>'version')::integer);
  assert result->>'archived_at' is not null, 'Team archive failed';
  assert exists(select 1 from public.events where id = context_id and archived_at is not null), 'Context archive failed';
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.list_team_directory(w);
    raise exception 'Expected anonymous rejection';
  exception when insufficient_privilege then null; end;
end;
$$;
rollback;
