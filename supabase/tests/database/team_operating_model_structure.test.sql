begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(56);

-- Transaction-scoped operating-model fixture. Fixed UUIDs keep every assertion
-- deterministic while the final rollback leaves no auth or domain data behind.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'f1000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'pgtap-operating-owner@pta.invalid',
    '',
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Owner de teste"}'::jsonb,
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'f1000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'pgtap-operating-viewer@pta.invalid',
    '',
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Viewer de teste"}'::jsonb,
    statement_timestamp(),
    statement_timestamp()
  );

insert into public.workspaces (
  id,
  name,
  slug,
  task_prefix,
  created_by
) values (
  'f2000000-0000-4000-8000-000000000001',
  'Fixture operacional',
  'pgtap-operating-model-fixture',
  'PGTAP',
  'f1000000-0000-4000-8000-000000000001'
);

insert into public.workspace_members (workspace_id, user_id, role)
values
  (
    'f2000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000001',
    'owner'::public.workspace_role
  ),
  (
    'f2000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000002',
    'viewer'::public.workspace_role
  );

-- Emulate legacy/stale data left by a former lead. Authorization helpers must
-- still deny this user because workspace viewer is a hard permission ceiling.
update public.team_members team_member
set role = 'lead'::public.team_member_role
where team_member.workspace_id = 'f2000000-0000-4000-8000-000000000001'
  and team_member.user_id = 'f1000000-0000-4000-8000-000000000002';

select set_config(
  'request.jwt.claim.sub',
  'f1000000-0000-4000-8000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select extensions.has_table('public', 'teams', 'teams table exists');
select extensions.has_table('public', 'team_members', 'team memberships table exists');
select extensions.has_table('public', 'job_functions', 'professional functions table exists');
select extensions.has_table('public', 'team_member_functions', 'member functions table exists');
select extensions.has_table('public', 'task_dependencies', 'task dependencies table exists');
select extensions.has_table('public', 'task_approval_requests', 'task approvals table exists');
select extensions.has_table('public', 'task_handoffs', 'task handoffs table exists');

select extensions.col_not_null('public', 'tasks', 'team_id', 'every task has one team');
select extensions.col_not_null('public', 'tasks', 'requester_id', 'every task has one requester');

select extensions.ok(
  (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid = 'public.teams'::regclass),
  'teams has forced RLS'
);
select extensions.ok(
  (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid = 'public.team_members'::regclass),
  'team_members has forced RLS'
);
select extensions.ok(
  (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid = 'public.job_functions'::regclass),
  'job_functions has forced RLS'
);
select extensions.ok(
  (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid = 'public.team_member_functions'::regclass),
  'team_member_functions has forced RLS'
);
select extensions.ok(
  (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid = 'public.task_dependencies'::regclass),
  'task_dependencies has forced RLS'
);
select extensions.ok(
  (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid = 'public.task_approval_requests'::regclass),
  'task_approval_requests has forced RLS'
);
select extensions.ok(
  (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid = 'public.task_handoffs'::regclass),
  'task_handoffs has forced RLS'
);

select extensions.hasnt_table_privilege('authenticated', 'public.teams', 'INSERT', 'authenticated cannot insert teams directly');
select extensions.hasnt_table_privilege('authenticated', 'public.teams', 'UPDATE', 'authenticated cannot update teams directly');
select extensions.hasnt_table_privilege('authenticated', 'public.team_members', 'INSERT', 'authenticated cannot insert team memberships directly');
select extensions.hasnt_table_privilege('authenticated', 'public.team_members', 'UPDATE', 'authenticated cannot update team memberships directly');
select extensions.hasnt_table_privilege('authenticated', 'public.job_functions', 'INSERT', 'authenticated cannot insert job functions directly');
select extensions.hasnt_table_privilege('authenticated', 'public.job_functions', 'UPDATE', 'authenticated cannot update job functions directly');
select extensions.hasnt_table_privilege('authenticated', 'public.team_member_functions', 'INSERT', 'authenticated cannot insert member functions directly');
select extensions.hasnt_table_privilege('authenticated', 'public.task_dependencies', 'INSERT', 'authenticated cannot insert dependencies directly');
select extensions.hasnt_table_privilege('authenticated', 'public.task_approval_requests', 'INSERT', 'authenticated cannot insert approvals directly');
select extensions.hasnt_table_privilege('authenticated', 'public.task_handoffs', 'INSERT', 'authenticated cannot insert handoffs directly');

select extensions.has_table_privilege('authenticated', 'public.teams', 'SELECT', 'authenticated can read teams through RLS');
select extensions.hasnt_table_privilege('anon', 'public.teams', 'SELECT', 'anon cannot read teams');

select extensions.ok(
  not exists (
    select 1
    from unnest(array[
      'public.teams'::regclass,
      'public.team_members'::regclass,
      'public.job_functions'::regclass,
      'public.team_member_functions'::regclass,
      'public.task_dependencies'::regclass,
      'public.task_approval_requests'::regclass,
      'public.task_handoffs'::regclass
    ]) protected_table(table_oid)
    where has_table_privilege('authenticated', protected_table.table_oid, 'INSERT')
       or has_table_privilege('authenticated', protected_table.table_oid, 'UPDATE')
       or has_table_privilege('authenticated', protected_table.table_oid, 'DELETE')
       or has_table_privilege('authenticated', protected_table.table_oid, 'TRUNCATE')
  ),
  'authenticated has no direct write grant on any operating-model table'
);

select extensions.ok(
  not exists (
    select 1
    from unnest(array[
      'public.teams'::regclass,
      'public.team_members'::regclass,
      'public.job_functions'::regclass,
      'public.team_member_functions'::regclass,
      'public.task_dependencies'::regclass,
      'public.task_approval_requests'::regclass,
      'public.task_handoffs'::regclass
    ]) protected_table(table_oid)
    where has_table_privilege('anon', protected_table.table_oid, 'SELECT')
       or has_table_privilege('anon', protected_table.table_oid, 'INSERT')
       or has_table_privilege('anon', protected_table.table_oid, 'UPDATE')
       or has_table_privilege('anon', protected_table.table_oid, 'DELETE')
       or has_table_privilege('anon', protected_table.table_oid, 'TRUNCATE')
  ),
  'anon has no privilege on any operating-model table'
);

select extensions.has_function_privilege(
  'authenticated',
  'public.list_workspace_operating_model(uuid)',
  'EXECUTE',
  'authenticated can call the guarded operating model reader'
);
select extensions.hasnt_function_privilege(
  'anon',
  'public.list_workspace_operating_model(uuid)',
  'EXECUTE',
  'anon cannot read the operating model'
);
select extensions.has_function_privilege(
  'authenticated',
  'public.create_operating_team(uuid,text,text,text,text)',
  'EXECUTE',
  'authenticated can call guarded team creation'
);
select extensions.has_function_privilege(
  'authenticated',
  'public.update_operating_team(uuid,integer,jsonb)',
  'EXECUTE',
  'authenticated can call guarded team update'
);
select extensions.has_function_privilege(
  'authenticated',
  'public.archive_operating_team(uuid,integer)',
  'EXECUTE',
  'authenticated can call guarded team archival'
);
select extensions.has_function_privilege(
  'authenticated',
  'public.upsert_team_member(uuid,uuid,public.team_member_role,boolean,integer)',
  'EXECUTE',
  'authenticated can call guarded team membership upsert'
);
select extensions.has_function_privilege(
  'authenticated',
  'public.remove_team_member(uuid,uuid,integer)',
  'EXECUTE',
  'authenticated can call guarded team membership removal'
);
select extensions.has_function_privilege(
  'authenticated',
  'public.save_job_function(uuid,uuid,integer,text,text,text,integer)',
  'EXECUTE',
  'authenticated can call guarded function save'
);
select extensions.has_function_privilege(
  'authenticated',
  'public.archive_job_function(uuid,integer)',
  'EXECUTE',
  'authenticated can call guarded function archival'
);
select extensions.has_function_privilege(
  'authenticated',
  'public.set_team_member_functions(uuid,uuid,uuid[],uuid,integer)',
  'EXECUTE',
  'authenticated can call guarded member function replacement'
);
select extensions.hasnt_function_privilege(
  'anon',
  'public.create_operating_team(uuid,text,text,text,text)',
  'EXECUTE',
  'anon cannot create teams'
);

select extensions.ok(
  not exists (
    select 1
    from public.workspaces workspace
    where workspace.archived_at is null
      and (
        select count(*)
        from public.teams team
        where team.workspace_id = workspace.id
          and team.is_default
          and team.archived_at is null
      ) <> 1
  ),
  'every active workspace has exactly one active default team'
);

select extensions.ok(
  not exists (
    select 1
    from public.workspaces workspace
    where workspace.archived_at is null
      and coalesce((
        select array_agg(job_function.system_key order by job_function.system_key)
        from public.job_functions job_function
        where job_function.workspace_id = workspace.id
          and job_function.is_system
          and job_function.archived_at is null
      ), '{}'::text[]) <> array[
        'content_manager',
        'copywriter',
        'crm_specialist',
        'data_analyst',
        'designer',
        'marketing_head',
        'media_buyer',
        'motion_designer',
        'operations_lead',
        'quality_reviewer',
        'strategist',
        'web_designer'
      ]::text[]
  ),
  'system function keys exactly match the TypeScript operating model contract'
);

select extensions.ok(
  not exists (
    select 1
    from public.workspace_members workspace_member
    join public.profiles profile on profile.id = workspace_member.user_id and profile.is_active
    join public.workspaces workspace on workspace.id = workspace_member.workspace_id and workspace.archived_at is null
    where workspace_member.status = 'active'::public.membership_status
      and workspace_member.removed_at is null
      and (
        select count(*)
        from public.team_members team_member
        join public.teams team
          on team.workspace_id = team_member.workspace_id
          and team.id = team_member.team_id
          and team.archived_at is null
        where team_member.workspace_id = workspace_member.workspace_id
          and team_member.user_id = workspace_member.user_id
          and team_member.is_primary
          and team_member.removed_at is null
      ) <> 1
  ),
  'every active workspace member has exactly one active primary team'
);

select extensions.ok(
  coalesce((
    select array_agg(policy.polname::text order by policy.polname)
    from pg_catalog.pg_policy policy
    where policy.polrelid = any(array[
      'public.teams'::regclass,
      'public.team_members'::regclass,
      'public.job_functions'::regclass,
      'public.team_member_functions'::regclass,
      'public.task_dependencies'::regclass,
      'public.task_approval_requests'::regclass,
      'public.task_handoffs'::regclass
    ])
  ), '{}'::text[]) = array[
    'job_functions_select_workspace_member',
    'task_approval_requests_select_workspace_member',
    'task_dependencies_select_workspace_member',
    'task_handoffs_select_workspace_member',
    'team_member_functions_select_scoped',
    'team_members_select_scoped',
    'teams_select_workspace_member'
  ]::text[],
  'new tables expose exactly the intended read-only RLS policies'
);

select extensions.ok(
  (
    select count(*)
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any(array[
        'archive_job_function',
        'archive_operating_team',
        'create_operating_team',
        'list_workspace_operating_model',
        'remove_team_member',
        'save_job_function',
        'set_team_member_functions',
        'update_operating_team',
        'upsert_team_member'
      ]::text[])
      and procedure.prosecdef
  ) = 9,
  'all nine public operating-model RPCs are SECURITY DEFINER'
);

select extensions.ok(
  (
    select count(*)
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any(array[
        'archive_job_function',
        'archive_operating_team',
        'create_operating_team',
        'list_workspace_operating_model',
        'remove_team_member',
        'save_job_function',
        'set_team_member_functions',
        'update_operating_team',
        'upsert_team_member'
      ]::text[])
      and exists (
        select 1
        from unnest(coalesce(procedure.proconfig, '{}'::text[])) setting(value)
        where setting.value like 'search_path=%'
      )
  ) = 9,
  'all nine public operating-model RPCs pin search_path'
);

select extensions.is(
  (
    select count(*)::integer
    from public.teams team
    where team.workspace_id = 'f2000000-0000-4000-8000-000000000001'
      and team.is_default
      and team.archived_at is null
  ),
  1,
  'fixture workspace receives exactly one active default team'
);

select extensions.is(
  (
    select count(*)::integer
    from public.team_members team_member
    join public.teams team
      on team.workspace_id = team_member.workspace_id
      and team.id = team_member.team_id
      and team.archived_at is null
    where team_member.workspace_id = 'f2000000-0000-4000-8000-000000000001'
      and team_member.user_id = 'f1000000-0000-4000-8000-000000000002'
      and team_member.is_primary
      and team_member.removed_at is null
  ),
  1,
  'fixture viewer receives exactly one active primary team'
);

select extensions.is(
  (
    select count(*)::integer
    from public.job_functions job_function
    where job_function.workspace_id = 'f2000000-0000-4000-8000-000000000001'
      and job_function.is_system
      and job_function.archived_at is null
  ),
  12,
  'fixture workspace receives the twelve-function system catalogue'
);

select extensions.ok(
  private.current_team_role(
    (
      select team.id
      from public.teams team
      where team.workspace_id = 'f2000000-0000-4000-8000-000000000001'
        and team.is_default
        and team.archived_at is null
    ),
    'f1000000-0000-4000-8000-000000000002'
  ) is null,
  'workspace viewer has no effective team role even with stale lead data'
);

select extensions.ok(
  not private.can_manage_team_members((
    select team.id
    from public.teams team
    where team.workspace_id = 'f2000000-0000-4000-8000-000000000001'
      and team.is_default
      and team.archived_at is null
  )),
  'workspace viewer can never manage team members'
);

select extensions.throws_ok(
  $$
    select public.create_operating_team(
      'f2000000-0000-4000-8000-000000000001',
      'Equipe indevida',
      'equipe-indevida',
      null,
      'blue'
    )
  $$,
  '42501',
  'PTA_TEAM_FORBIDDEN',
  'viewer cannot mutate the operating model through a SECURITY DEFINER RPC'
);

select extensions.ok(
  position(
    'pta:task-dependencies:' in pg_get_functiondef(
      'private.task_dependencies_before_write()'::regprocedure
    )
  ) > 0,
  'dependency cycle validation is serialized by a workspace advisory lock'
);

select extensions.ok(
  position(
    'PTA_APPROVAL_TERMINAL_IMMUTABLE' in pg_get_functiondef(
      'private.task_approval_requests_before_write()'::regprocedure
    )
  ) > 0
  and position(
    'PTA_APPROVAL_INSERT_MUST_BE_PENDING' in pg_get_functiondef(
      'private.task_approval_requests_before_write()'::regprocedure
    )
  ) > 0
  and position(
    'old.task_version <> v_current_task_version' in pg_get_functiondef(
      'private.task_approval_requests_before_write()'::regprocedure
    )
  ) > 0
  and position(
    'for update' in split_part(
      pg_get_functiondef(
        'private.task_approval_requests_before_write()'::regprocedure
      ),
      'PTA_APPROVAL_INSERT_MUST_BE_PENDING',
      2
    )
  ) > 0,
  'approval trigger creates pending requests and serializes task-version validation'
);

select extensions.ok(
  position(
    'pta:operating-model:' in pg_get_functiondef(
      'public.archive_operating_team(uuid,integer)'::regprocedure
    )
  ) > 0
  and position(
    'pta:operating-model:' in pg_get_functiondef(
      'public.upsert_team_member(uuid,uuid,public.team_member_role,boolean,integer)'::regprocedure
    )
  ) > 0
  and position(
    'pta:operating-model:' in pg_get_functiondef(
      'public.remove_team_member(uuid,uuid,integer)'::regprocedure
    )
  ) > 0,
  'team archival and membership changes share the workspace operating-model lock'
);

select * from extensions.finish();
rollback;
