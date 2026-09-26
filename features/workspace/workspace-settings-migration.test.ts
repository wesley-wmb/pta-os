import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260925120000_workspace_settings.sql',
  ),
  'utf8',
).toLowerCase();

describe('workspace settings migration contract', () => {
  it('adds explicit optimistic concurrency to the workspace', () => {
    expect(sql).toContain(
      'add column if not exists version integer not null default 1',
    );
    expect(sql).toContain('v_workspace.version <> p_expected_version');
    expect(sql).toContain("message = 'pta_version_conflict'");
    expect(sql).toContain('version = workspace.version + 1');
  });

  it('checks active membership for reads and admin roles for writes', () => {
    expect(sql).toContain('private.current_workspace_role(p_workspace_id)');
    expect(sql).toContain("message = 'pta_workspace_forbidden'");
    expect(sql).toContain("'owner'::public.workspace_role");
    expect(sql).toContain("'admin'::public.workspace_role");
    expect(sql).toContain("message = 'pta_workspace_settings_forbidden'");
  });

  it('returns aggregate member counts without personal identity fields', () => {
    const readStart = sql.indexOf(
      'create or replace function public.get_workspace_settings',
    );
    const writeStart = sql.indexOf(
      'create or replace function public.update_workspace_settings',
    );
    const read = sql.slice(readStart, writeStart);

    expect(read).toContain("'role_counts', v_role_counts");
    expect(read).toContain('count(*)::integer as member_count');
    expect(read).not.toContain("'email'");
    expect(read).not.toContain("'full_name'");
  });

  it('keeps updates behind an authenticated RPC and audit log', () => {
    expect(sql).toContain('security definer');
    expect(sql).toContain('for update');
    expect(sql).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(sql).toContain("'workspace.settings_updated'");
    expect(sql).toContain(
      'grant execute on function public.update_workspace_settings',
    );
    expect(sql).toContain(
      'revoke insert, update, delete, truncate on table public.workspaces',
    );
    expect(sql.trimEnd().endsWith('commit;')).toBe(true);
  });
});
