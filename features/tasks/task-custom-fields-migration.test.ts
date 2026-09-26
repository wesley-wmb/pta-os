import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260924193000_task_custom_fields.sql',
  ),
  'utf8',
).toLowerCase();

describe('task custom fields migration contract', () => {
  it('creates workspace-scoped definitions, options and values with forced RLS', () => {
    for (const table of [
      'task_custom_field_definitions',
      'task_custom_field_options',
      'task_custom_field_values',
    ]) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(
        `alter table public.${table} force row level security`,
      );
    }
    expect(sql).toContain('private.is_active_workspace_member(workspace_id)');
    expect(sql).toContain('references public.tasks(workspace_id, id)');
  });

  it('restricts field definitions and validates bounded field types', () => {
    expect(sql).toContain(
      "private.current_workspace_role(p_workspace_id) not in ('owner', 'admin', 'manager')",
    );
    expect(sql).toContain('>= 12');
    expect(sql).toContain("'text'");
    expect(sql).toContain("'number'");
    expect(sql).toContain("'date'");
    expect(sql).toContain("'boolean'");
    expect(sql).toContain("'single_select'");
  });

  it('writes values through a versioned RPC and the task edit policy', () => {
    expect(sql).toContain(
      'create or replace function public.set_task_custom_field_value',
    );
    expect(sql).toContain('private.can_edit_task(p_task_id)');
    expect(sql).toContain('v_task.version <> p_expected_task_version');
    expect(sql).toContain("message = 'pta_version_conflict'");
    expect(sql).toContain("'task.custom_field_updated'");
  });

  it('returns the fixed requester and custom fields in task detail', () => {
    expect(sql).toContain("'requester_id', task.created_by");
    expect(sql).toContain("'requester_name', requester.full_name");
    expect(sql).toContain("'custom_fields', v_custom_fields");
    expect(sql).toContain("'can_manage_custom_fields'");
    expect(sql).toContain("'can_edit_custom_field_values'");
  });

  it('keeps all writes behind authenticated-only RPC grants', () => {
    expect(sql).toContain(
      'grant execute on function public.create_task_custom_field(uuid, text, public.task_custom_field_type, text[]) to authenticated',
    );
    expect(sql).toContain(
      'grant execute on function public.set_task_custom_field_value(uuid, uuid, integer, jsonb) to authenticated',
    );
    expect(sql.trimEnd().endsWith('commit;')).toBe(true);
  });
});
