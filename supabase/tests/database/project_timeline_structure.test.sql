begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(27);

select extensions.has_table('public', 'event_phases', 'project phases table exists');
select extensions.has_column('public', 'tasks', 'start_date', 'tasks expose a date-only interval start');
select extensions.has_column('public', 'tasks', 'start_time', 'tasks expose an optional local start time');
select extensions.has_column('public', 'tasks', 'event_phase_id', 'tasks can belong to a custom project phase');
select extensions.has_column('public', 'event_milestones', 'event_phase_id', 'milestones can belong to a custom project phase');

select extensions.col_type_is('public', 'tasks', 'start_date', 'date', 'task start remains a date value');
select extensions.col_type_is('public', 'tasks', 'start_time', 'time without time zone', 'task start time remains separate from its date');

select extensions.ok(
  (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid = 'public.event_phases'::regclass),
  'project phases have forced RLS'
);
select extensions.has_table_privilege('authenticated', 'public.event_phases', 'SELECT', 'members may read phases through RLS');
select extensions.hasnt_table_privilege('authenticated', 'public.event_phases', 'INSERT', 'members cannot insert phases directly');
select extensions.hasnt_table_privilege('authenticated', 'public.event_phases', 'UPDATE', 'members cannot update phases directly');
select extensions.hasnt_table_privilege('authenticated', 'public.event_phases', 'DELETE', 'members cannot delete phases directly');
select extensions.hasnt_table_privilege('anon', 'public.event_phases', 'SELECT', 'anonymous users cannot read phases');

select extensions.has_function_privilege(
  'authenticated',
  'public.move_task_in_timeline(uuid,uuid,uuid,integer,uuid,uuid,date,time without time zone,date,time without time zone)',
  'EXECUTE',
  'authenticated users can call the guarded task timeline mutation'
);
select extensions.has_function_privilege(
  'authenticated',
  'public.move_event_milestone_in_timeline(uuid,uuid,integer,uuid,date)',
  'EXECUTE',
  'authenticated users can call the guarded milestone timeline mutation'
);
select extensions.has_function_privilege(
  'authenticated',
  'public.create_event_phase(uuid,uuid,text,text,date,date)',
  'EXECUTE',
  'authenticated users can call guarded phase creation'
);
select extensions.has_function_privilege(
  'authenticated',
  'public.get_project_timeline(uuid,uuid)',
  'EXECUTE',
  'authenticated users can call the workspace-scoped timeline reader'
);
select extensions.hasnt_function_privilege(
  'anon',
  'public.move_task_in_timeline(uuid,uuid,uuid,integer,uuid,uuid,date,time without time zone,date,time without time zone)',
  'EXECUTE',
  'anonymous users cannot mutate the project timeline'
);

select extensions.ok(
  (select prosecdef from pg_catalog.pg_proc where oid = 'public.move_task_in_timeline(uuid,uuid,uuid,integer,uuid,uuid,date,time without time zone,date,time without time zone)'::regprocedure),
  'task timeline mutation is SECURITY DEFINER'
);
select extensions.ok(
  (select prosecdef from pg_catalog.pg_proc where oid = 'public.update_event_phase(uuid,uuid,integer,jsonb)'::regprocedure),
  'phase update is SECURITY DEFINER'
);
select extensions.ok(
  (select prosecdef from pg_catalog.pg_proc where oid = 'public.get_project_timeline(uuid,uuid)'::regprocedure),
  'timeline reader is SECURITY DEFINER'
);
select extensions.ok(
  position('search_path=' in array_to_string(
    (select proconfig from pg_catalog.pg_proc where oid = 'public.move_task_in_timeline(uuid,uuid,uuid,integer,uuid,uuid,date,time without time zone,date,time without time zone)'::regprocedure),
    ','
  )) > 0,
  'task timeline mutation pins search_path'
);

select extensions.ok(
  position('task.version = p_expected_version' in pg_get_functiondef(
    'public.move_task_in_timeline(uuid,uuid,uuid,integer,uuid,uuid,date,time without time zone,date,time without time zone)'::regprocedure
  )) > 0,
  'task timeline mutation performs its write against the expected version'
);
select extensions.ok(
  position('task.workspace_id = p_workspace_id' in pg_get_functiondef(
    'public.move_task_in_timeline(uuid,uuid,uuid,integer,uuid,uuid,date,time without time zone,date,time without time zone)'::regprocedure
  )) > 0
  and position('task.event_id = p_event_id' in pg_get_functiondef(
    'public.move_task_in_timeline(uuid,uuid,uuid,integer,uuid,uuid,date,time without time zone,date,time without time zone)'::regprocedure
  )) > 0,
  'task timeline mutation scopes both reads and writes to workspace and project'
);
select extensions.ok(
  position('phase.workspace_id = p_workspace_id' in pg_get_functiondef(
    'public.move_event_milestone_in_timeline(uuid,uuid,integer,uuid,date)'::regprocedure
  )) > 0,
  'milestone movement validates its phase inside the same workspace'
);

select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'public.tasks'::regclass
      and constraint_row.conname = 'tasks_schedule_range_valid'
  ),
  'task intervals cannot end before they start'
);
select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'public.tasks'::regclass
      and constraint_row.conname = 'tasks_workspace_event_phase_fkey'
  ),
  'task phase references are project and workspace scoped'
);

select * from extensions.finish();
rollback;
