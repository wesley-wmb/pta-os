-- Run against a migrated PTA OS database using an administrator SQL connection.
-- All fixtures and activity are rolled back; no existing project is modified.
begin;
do $$
declare
  w uuid; actor uuid; team jsonb; project jsonb; result jsonb; project_id uuid;
begin
  select workspace_id,user_id into w,actor from public.workspace_members
    where role = 'owner' and status = 'active' and removed_at is null limit 1;
  if actor is null then raise exception 'Test requires an active workspace owner'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  team := public.create_operating_team(w,'Navigation verification', 'verify-' || gen_random_uuid()::text);
  project := public.create_team_project(w,(team->>'id')::uuid,'Navigation verification project');
  project_id := (project->>'id')::uuid;
  result := public.list_team_projects(w,(team->>'id')::uuid);
  assert (result->>'total')::integer = 1, 'Team filter must return the new project';
  assert result->'projects'->0->>'id' = project_id::text, 'Wrong project in team';
  assert exists(select 1 from jsonb_array_elements(public.list_team_directory(w)->'teams') t
    where t->>'id' = team->>'id' and (t->>'project_count')::integer = 1), 'Directory count mismatch';
  begin
    perform public.set_project_team(w,project_id,null,0);
    raise exception 'Expected invalid version rejection';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.set_project_team(w,project_id,null,(project->>'version')::integer - 1);
    raise exception 'Expected stale version rejection';
  exception when sqlstate '40001' then null; end;
  begin
    perform public.archive_operating_team((team->>'id')::uuid,(team->>'version')::integer);
    raise exception 'Expected active project archival rejection';
  exception when check_violation then
    if sqlerrm <> 'PTA_TEAM_HAS_ACTIVE_PROJECTS' then raise; end if;
  end;
  project := public.set_project_team(w,project_id,null,(project->>'version')::integer);
  assert not exists(select 1 from public.events where id = project_id and primary_team_id is not null), 'Unassign failed';
  result := public.list_team_projects(w,null,true,'Navigation verification project');
  assert (result->>'total')::integer = 1, 'Unassigned filter failed';
  begin
    perform public.list_team_projects(gen_random_uuid());
    raise exception 'Expected cross workspace rejection';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_project_team(w,project_id,gen_random_uuid(),(project->>'version')::integer);
    raise exception 'Expected foreign team rejection';
  exception when check_violation then null; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.list_team_directory(w);
    raise exception 'Expected unauthenticated rejection';
  exception when insufficient_privilege then null; end;
  assert not has_function_privilege('anon','public.list_team_directory(uuid)','execute'), 'Anon has RPC access';
  assert not has_function_privilege('anon','public.set_project_team(uuid,uuid,uuid,integer)','execute'), 'Anon has mutation access';
end;
$$;
rollback;
