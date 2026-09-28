-- An owner is deliberately tested as a nonmember: administrative roles do not bypass privacy.
begin;
do $$
declare w uuid; actor uuid; team jsonb; context_id uuid; task_id uuid; result jsonb;
begin
  select workspace_id,user_id into w,actor from public.workspace_members
    where role = 'owner' and status = 'active' and removed_at is null limit 1;
  if actor is null then raise exception 'Test requires active workspace owner'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  team := public.create_operating_team_workspace(w,'Private verification','private-' || gen_random_uuid()::text)->'team';
  context_id := (team->>'workspace_event_id')::uuid;
  result := public.create_global_task(p_workspace_id => w,p_title => 'Private test task',p_event_id => context_id);
  task_id := coalesce(result->>'id',result->>'task_id')::uuid;
  assert task_id is not null, 'Missing fixture task';
  set local role authenticated;
  assert exists(select 1 from public.teams where id = (team->>'id')::uuid), 'Member cannot see own team';
  assert exists(select 1 from public.events where id = context_id), 'Member cannot see own context';
  assert exists(select 1 from public.tasks where id = task_id), 'Member cannot see own task';
  reset role;
  update public.team_members set removed_at = now(),removed_by = actor
    where workspace_id = w and team_id = (team->>'id')::uuid and user_id = actor;
  set local role authenticated;
  assert not private.can_read_team((team->>'id')::uuid), 'Owner nonmember bypassed team guard';
  assert not private.can_read_event(context_id), 'Owner nonmember bypassed context guard';
  assert not private.can_read_task(task_id), 'Owner nonmember bypassed task guard';
  assert not exists(select 1 from public.teams where id = (team->>'id')::uuid), 'Team RLS leak';
  assert not exists(select 1 from public.events where id = context_id), 'Event RLS leak';
  assert not exists(select 1 from public.tasks where id = task_id), 'Task RLS leak';
  if has_table_privilege('authenticated','public.activity_logs','select') then
    assert not exists(select 1 from public.activity_logs where entity_id in (context_id,task_id,(team->>'id')::uuid)), 'Activity RLS leak';
  end if;
  assert not exists(select 1 from jsonb_array_elements(public.list_team_directory(w)->'teams') t where t->>'id' = team->>'id'), 'Directory leak';
  assert not exists(select 1 from jsonb_array_elements(public.list_team_projects(w)->'projects') p where p->>'id' = context_id::text), 'Projects RPC leak';
  reset role;
end;
$$;
rollback;
