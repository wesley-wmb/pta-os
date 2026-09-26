import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260824090000_team_operating_model_foundation.sql',
);
const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

const operatingTables = [
  'job_functions',
  'task_approval_requests',
  'task_dependencies',
  'task_handoffs',
  'team_member_functions',
  'team_members',
  'teams',
] as const;

const rpcSignatures = [
  'public.list_workspace_operating_model(uuid)',
  'public.create_operating_team(uuid, text, text, text, text)',
  'public.update_operating_team(uuid, integer, jsonb)',
  'public.archive_operating_team(uuid, integer)',
  'public.upsert_team_member(uuid, uuid, public.team_member_role, boolean, integer)',
  'public.remove_team_member(uuid, uuid, integer)',
  'public.save_job_function(uuid, uuid, integer, text, text, text, integer)',
  'public.archive_job_function(uuid, integer)',
  'public.set_team_member_functions(uuid, uuid, uuid[], uuid, integer)',
] as const;

const policyHelperSignatures = [
  'private.current_team_role(uuid, uuid)',
  'private.can_manage_operating_model(uuid)',
  'private.can_manage_team_members(uuid)',
  'private.is_current_user_team_lead(uuid)',
] as const;

const systemJobFunctionKeys = [
  'marketing_head',
  'operations_lead',
  'strategist',
  'copywriter',
  'designer',
  'motion_designer',
  'media_buyer',
  'web_designer',
  'crm_specialist',
  'content_manager',
  'data_analyst',
  'quality_reviewer',
] as const;

function functionDefinition(schema: 'private' | 'public', name: string) {
  const start = sql.indexOf(`create or replace function ${schema}.${name}`);
  const end = sql.indexOf('\n$$;', start + 1);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return sql.slice(start, end);
}

describe('team operating model migration contract', () => {
  it('enables and forces RLS on exactly the seven operating model tables', () => {
    const enabledTables = Array.from(
      sql.matchAll(/alter table public\.([a-z_]+) enable row level security;/g),
      (match) => match[1],
    ).sort();
    const forcedTables = Array.from(
      sql.matchAll(/alter table public\.([a-z_]+) force row level security;/g),
      (match) => match[1],
    ).sort();

    expect(enabledTables).toEqual([...operatingTables]);
    expect(forcedTables).toEqual([...operatingTables]);
  });

  it('revokes direct writes and exposes only authenticated reads', () => {
    const revokeStart = sql.indexOf('revoke all on table\n  public.teams,');
    const grantStart = sql.indexOf('grant select on table\n  public.teams,');
    const privilegeEnd = sql.indexOf('\nalter function public.', grantStart);

    expect(revokeStart).toBeGreaterThanOrEqual(0);
    expect(grantStart).toBeGreaterThan(revokeStart);
    expect(privilegeEnd).toBeGreaterThan(grantStart);

    const revokeBlock = sql.slice(revokeStart, grantStart);
    const grantBlock = sql.slice(grantStart, privilegeEnd);

    for (const table of operatingTables) {
      expect(revokeBlock).toContain(`public.${table}`);
      expect(grantBlock).toContain(`public.${table}`);
    }

    expect(revokeBlock).toContain('from public, anon, authenticated');
    expect(grantBlock).toContain('to authenticated');
    expect(sql).not.toMatch(
      /grant\s+(?:insert|update|delete|truncate|all)\s+on\s+(?:table\s+)?public\.(?:teams|team_members|job_functions|team_member_functions|task_dependencies|task_approval_requests|task_handoffs)/,
    );
  });

  it('keeps all nine public RPCs hardened and authenticated-only', () => {
    expect(rpcSignatures).toHaveLength(9);

    for (const signature of rpcSignatures) {
      const functionName = signature.slice(
        'public.'.length,
        signature.indexOf('('),
      );
      const definition = functionDefinition('public', functionName);

      expect(definition).toContain('security definer');
      expect(definition).toContain("set search_path = ''");
      expect(sql).toContain(`alter function ${signature} owner to postgres`);
      expect(sql).toContain(
        `revoke all on function ${signature} from public, anon, authenticated`,
      );
      expect(sql).toContain(
        `grant execute on function ${signature} to authenticated`,
      );
    }

    expect(
      sql.match(/grant execute on function public\.[^;]+ to authenticated;/g),
    ).toHaveLength(9);
    expect(sql).not.toMatch(
      /grant execute on function public\.[^;]+ to (?:public|anon)/,
    );
  });

  it('hardens every private helper used by authorization and RLS', () => {
    for (const signature of policyHelperSignatures) {
      const functionName = signature.slice(
        'private.'.length,
        signature.indexOf('('),
      );
      const definition = functionDefinition('private', functionName);

      expect(definition).toContain('security definer');
      expect(definition).toContain("set search_path = ''");
      expect(sql).toContain(`alter function ${signature} owner to postgres`);
      expect(sql).toContain(
        `revoke all on function ${signature} from public, anon, authenticated`,
      );
    }

    expect(sql).toContain(
      'grant execute on function private.is_current_user_team_lead(uuid) to authenticated',
    );
    expect(sql).not.toMatch(
      /grant execute on function private\.(?:current_team_role|can_manage_operating_model|can_manage_team_members)\([^;]+ to authenticated/,
    );
  });

  it('does not give a team role to workspace viewers', () => {
    const currentTeamRole = functionDefinition('private', 'current_team_role');

    expect(currentTeamRole).toContain(
      "workspace_member.role <> 'viewer'::public.workspace_role",
    );
  });

  it('serializes dependency graph checks before detecting a cycle', () => {
    const dependencyGuard = functionDefinition(
      'private',
      'task_dependencies_before_write',
    );
    const advisoryLock = dependencyGuard.indexOf(
      "hashtextextended('pta:task-dependencies:' || new.workspace_id::text, 0)",
    );
    const graphRead = dependencyGuard.indexOf('with recursive downstream');

    expect(advisoryLock).toBeGreaterThanOrEqual(0);
    expect(graphRead).toBeGreaterThan(advisoryLock);
    expect(dependencyGuard).toContain("message = 'pta_task_dependency_cycle'");
  });

  it('uses a consistent workspace lock order when archiving or removing', () => {
    const archiveTeam = functionDefinition('public', 'archive_operating_team');
    const removeMember = functionDefinition('public', 'remove_team_member');
    const sharedLock =
      "hashtextextended('pta:operating-model:' || v_team.workspace_id::text, 0)";

    for (const definition of [archiveTeam, removeMember]) {
      const teamLock = definition.indexOf('from public.teams team');
      const teamForUpdate = definition.indexOf('for update', teamLock);
      const workspaceLock = definition.indexOf(sharedLock);

      expect(teamLock).toBeGreaterThanOrEqual(0);
      expect(teamForUpdate).toBeGreaterThan(teamLock);
      expect(workspaceLock).toBeGreaterThan(teamForUpdate);
    }

    expect(
      removeMember.indexOf("hashtextextended(\n      'pta:team-member:'"),
    ).toBeGreaterThan(removeMember.indexOf(sharedLock));
  });

  it('creates pending approvals under a task lock and makes decisions terminal', () => {
    const approvalGuard = functionDefinition(
      'private',
      'task_approval_requests_before_write',
    );
    const terminalGuard = approvalGuard.indexOf(
      "old.decision <> 'pending'::public.task_approval_decision",
    );
    const transitionGuard = approvalGuard.indexOf(
      "new.decision <> 'pending'::public.task_approval_decision",
      terminalGuard + 1,
    );
    const taskVersionRead = approvalGuard.indexOf(
      'select task.version',
      transitionGuard,
    );
    const taskLock = approvalGuard.indexOf('for update', taskVersionRead);
    const versionCheck = approvalGuard.indexOf(
      'old.task_version <> v_current_task_version',
      taskLock,
    );
    const insertBranch = approvalGuard.indexOf('else', versionCheck);
    const pendingInsertGuard = approvalGuard.indexOf(
      "new.decision <> 'pending'::public.task_approval_decision",
      insertBranch,
    );
    const insertTaskVersionRead = approvalGuard.indexOf(
      'select task.version',
      pendingInsertGuard,
    );
    const insertTaskLock = approvalGuard.indexOf(
      'for update',
      insertTaskVersionRead,
    );
    const insertVersionCheck = approvalGuard.indexOf(
      'new.task_version <> v_current_task_version',
      insertTaskLock,
    );

    expect(terminalGuard).toBeGreaterThanOrEqual(0);
    expect(approvalGuard).toContain(
      "message = 'pta_approval_terminal_immutable'",
    );
    expect(transitionGuard).toBeGreaterThan(terminalGuard);
    expect(taskVersionRead).toBeGreaterThan(transitionGuard);
    expect(taskLock).toBeGreaterThan(taskVersionRead);
    expect(versionCheck).toBeGreaterThan(taskLock);
    expect(pendingInsertGuard).toBeGreaterThan(insertBranch);
    expect(approvalGuard).toContain(
      "message = 'pta_approval_insert_must_be_pending'",
    );
    expect(insertTaskVersionRead).toBeGreaterThan(pendingInsertGuard);
    expect(insertTaskLock).toBeGreaterThan(insertTaskVersionRead);
    expect(insertVersionCheck).toBeGreaterThan(insertTaskLock);
    expect(approvalGuard).toContain("message = 'pta_version_conflict'");
  });

  it('seeds exactly the twelve system job functions in both code paths', () => {
    const standardFunctionBlocks = Array.from(
      sql.matchAll(
        /with standard_function\(system_key, name, category, description, position\) as \(\s*values([\s\S]*?)\n\s*\)\s*insert into public\.job_functions/g,
      ),
      (match) => match[1],
    );

    expect(standardFunctionBlocks).toHaveLength(2);

    for (const block of standardFunctionBlocks) {
      const keys = Array.from(
        block.matchAll(/\(\s*'([a-z_]+)'\s*,/g),
        (match) => match[1],
      );

      expect(keys).toEqual([...systemJobFunctionKeys]);
      expect(new Set(keys)).toHaveLength(12);
    }
  });
});
