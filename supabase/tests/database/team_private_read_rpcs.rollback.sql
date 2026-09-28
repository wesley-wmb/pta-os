-- Disposable fixtures and membership changes are rolled back in full.
begin;
do $test$
declare
  w uuid; actor uuid; t jsonb; event_id uuid; v_task_id uuid; standalone_id uuid;
  v_team_id uuid; needle text := 'privacyverification' || replace(gen_random_uuid()::text,'-','');
  payload jsonb; query text;
begin
  select workspace_id,user_id into w,actor from public.workspace_members
    where role='owner' and status='active' and removed_at is null limit 1;
  assert actor is not null, 'Requires active owner';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  t := public.create_operating_team_workspace(w,needle,needle)->'team';
  v_team_id := (t->>'id')::uuid; event_id := (t->>'workspace_event_id')::uuid;
  v_task_id := (public.create_context_task(w,'event',event_id,needle)->>'id')::uuid;
  standalone_id := (public.create_task(w,'Standalone privacy verification')->>'id')::uuid;
  assert private.can_read_event(event_id), 'Member event access denied';
  assert private.can_read_task(v_task_id), 'Member task access denied';
  perform public.get_event_operational(event_id);
  perform public.get_project_timeline(w,event_id);
  perform public.get_task_detail(v_task_id);
  perform public.list_task_comments(v_task_id);
  perform public.list_task_attachments(v_task_id);
  payload := public.list_events_operational(w);
  assert payload::text like '%'||event_id::text||'%', 'Member event absent from list';
  payload := public.search_workspace(w,needle);
  assert payload::text like '%'||v_task_id::text||'%', 'Member task absent from search';
  payload := public.search_resource_relation_options(w,'task',needle);
  assert payload::text like '%'||v_task_id::text||'%', 'Member task absent from relation search';

  -- Workspace owner remains active but loses membership of this test team.
  update public.team_members set removed_at=clock_timestamp(), removed_by=actor
    where workspace_id=w and team_members.team_id=v_team_id and user_id=actor;
  assert not private.can_read_event(event_id), 'Owner bypassed event membership';
  assert not private.can_read_task(v_task_id), 'Owner bypassed task membership';
  assert private.can_read_task(standalone_id), 'Standalone task was wrongly hidden';
  perform public.get_task_detail(standalone_id);
  foreach query in array array[
    format('select public.get_event_operational(%L::uuid)',event_id),
    format('select public.get_project_timeline(%L::uuid,%L::uuid)',w,event_id),
    format('select public.get_task_detail(%L::uuid)',v_task_id),
    format('select public.list_task_comments(%L::uuid)',v_task_id),
    format('select public.list_task_attachments(%L::uuid)',v_task_id)
  ] loop
    begin
      execute query;
      raise exception 'Privacy failure: %',query;
    exception when no_data_found then null;
    end;
  end loop;
  payload := public.list_events_operational(w);
  assert payload::text not like '%'||event_id::text||'%', 'Private event leaked in list';
  payload := public.search_workspace(w,needle);
  assert payload::text not like '%'||v_task_id::text||'%', 'Private task leaked in search';
  assert payload::text not like '%'||event_id::text||'%', 'Private event leaked in search';
  payload := public.search_resource_relation_options(w,'task',needle);
  assert payload::text not like '%'||v_task_id::text||'%', 'Private task leaked in relation search';
  payload := public.search_resource_relation_options(w,'event',needle);
  assert payload::text not like '%'||event_id::text||'%', 'Private event leaked in relation search';
  assert not exists(select 1 from public.list_task_activity(w) a where a.task_id=v_task_id),
    'Private task leaked in activity';
  perform public.list_products_operational(w);
end;
$test$;
rollback;
