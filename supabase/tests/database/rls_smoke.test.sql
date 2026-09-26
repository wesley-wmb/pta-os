begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(18);

select extensions.hasnt_table_privilege('anon', 'public.tasks', 'SELECT', 'anon cannot read tasks');
select extensions.hasnt_table_privilege('authenticated', 'public.tasks', 'INSERT', 'authenticated cannot insert tasks directly');
select extensions.hasnt_table_privilege('authenticated', 'public.tasks', 'UPDATE', 'authenticated cannot update tasks directly');
select extensions.hasnt_table_privilege('authenticated', 'public.activity_logs', 'INSERT', 'activity is append-only for clients');
select extensions.hasnt_function_privilege(
  'anon',
  'public.create_task(uuid,text,uuid,public.task_priority,date,time without time zone,uuid)',
  'EXECUTE',
  'anon cannot create tasks'
);
select extensions.has_function_privilege(
  'authenticated',
  'public.create_task(uuid,text,uuid,public.task_priority,date,time without time zone,uuid)',
  'EXECUTE',
  'authenticated can call guarded create_task'
);
select extensions.hasnt_function_privilege(
  'anon',
  'public.create_global_task(uuid,text,uuid,public.task_priority,date,time without time zone,uuid,uuid,uuid,uuid,jsonb,text)',
  'EXECUTE',
  'anon cannot create global tasks'
);
select extensions.has_function_privilege(
  'authenticated',
  'public.create_global_task(uuid,text,uuid,public.task_priority,date,time without time zone,uuid,uuid,uuid,uuid,jsonb,text)',
  'EXECUTE',
  'authenticated can call guarded create_global_task'
);
select extensions.hasnt_function_privilege(
  'anon',
  'public.move_task_to_day(uuid,date,numeric,integer)',
  'EXECUTE',
  'anon cannot move tasks'
);
select extensions.has_function_privilege(
  'authenticated',
  'public.move_task_to_day(uuid,date,numeric,integer)',
  'EXECUTE',
  'authenticated can call guarded week move'
);
select extensions.hasnt_function_privilege(
  'anon',
  'public.move_task_in_board(uuid,uuid,uuid,uuid,uuid,integer,text)',
  'EXECUTE',
  'anon cannot reorder the Kanban'
);
select extensions.has_function_privilege(
  'authenticated',
  'public.move_task_in_board(uuid,uuid,uuid,uuid,uuid,integer,text)',
  'EXECUTE',
  'authenticated can call guarded Kanban ordering'
);
select extensions.ok(
  (select enabled from private.runtime_flags where key = 'allow_self_bootstrap'),
  'local seed enables self bootstrap explicitly'
);
select extensions.col_is_pk('private', 'runtime_flags', 'key', 'runtime flags have a stable key');
select extensions.col_not_null('public', 'tasks', 'week_position', 'week position is required');
select extensions.col_not_null('public', 'tasks', 'board_position', 'Kanban position is required');
select extensions.ok(
  (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid = 'public.tasks'::regclass),
  'tasks has forced RLS'
);
select extensions.ok(
  (select 'security_invoker=true' = any(coalesce(reloptions, '{}'::text[])) from pg_catalog.pg_class where oid = 'public.v_task_overview'::regclass),
  'task overview uses security invoker'
);

select * from extensions.finish();
rollback;
