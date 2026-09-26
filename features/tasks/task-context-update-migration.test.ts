import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260825140000_task_context_updates.sql',
);
const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

function updateTaskBody() {
  const start = sql.indexOf('create or replace function public.update_task');
  const end = sql.indexOf('comment on function public.update_task', start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

function taskActivityBody() {
  const start = sql.indexOf(
    'create or replace function private.tasks_after_write',
  );
  const end = sql.indexOf('alter function public.update_task', start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe('task context update migration contract', () => {
  it('ships as a new atomic migration', () => {
    expect(sql.trimStart().startsWith('-- allow inline task context')).toBe(
      true,
    );
    expect(sql).toContain('begin;');
    expect(sql.trimEnd().endsWith('commit;')).toBe(true);
  });

  it('extends the bounded patch without accepting workspace input', () => {
    const update = updateTaskBody();

    for (const field of [
      "'title'",
      "'status_id'",
      "'priority'",
      "'due_date'",
      "'due_time'",
      "'blocked_reason'",
      "'type_id'",
      "'product_id'",
      "'event_id'",
    ]) {
      expect(update).toContain(field);
    }

    expect(update).toContain("message = 'pta_patch_has_unsupported_fields'");
    expect(update).not.toContain("'workspace_id'");
    expect(update).toContain('v_current.workspace_id');
  });

  it('keeps authorization and optimistic concurrency inside the RPC', () => {
    const update = updateTaskBody();

    expect(update).toContain('security definer');
    expect(update).toContain("set search_path = ''");
    expect(update).toContain('private.can_edit_task(p_task_id)');
    expect(update).toContain('for update');
    expect(update).toContain('v_current.version <> p_expected_version');
    expect(update).toContain('task.version = p_expected_version');
    expect(update).toContain("message = 'pta_version_conflict'");
  });

  it('validates active context in the task workspace', () => {
    const update = updateTaskBody();

    expect(update).toContain('task_type.workspace_id = v_current.workspace_id');
    expect(update).toContain('and task_type.is_active');
    expect(update).toContain('product.workspace_id = v_current.workspace_id');
    expect(update).toContain('and product.archived_at is null');
    expect(update).toContain('event.workspace_id = v_current.workspace_id');
    expect(update).toContain('and event.archived_at is null');
    expect(update).toContain("message = 'pta_type_not_active'");
    expect(update).toContain("message = 'pta_product_not_active'");
    expect(update).toContain("message = 'pta_event_not_active'");
  });

  it('updates event and product atomically and rejects mismatches', () => {
    const update = updateTaskBody();

    expect(update).toContain('v_product_id := v_event_product_id');
    expect(update).toContain(
      'v_product_id is distinct from v_event_product_id',
    );
    expect(update).toContain("message = 'pta_event_product_mismatch'");
    expect(update).toContain(
      "when p_patch ? 'product_id' or p_patch ? 'event_id' then v_product_id",
    );
    expect(update).toContain("when p_patch ? 'event_id' then v_event_id");
  });

  it('returns the normalized context and records context changes', () => {
    const update = updateTaskBody();
    const activity = taskActivityBody();

    for (const field of ['type_id', 'product_id', 'event_id']) {
      expect(update).toContain(`'${field}', v_task.${field}`);
      expect(activity).toContain(
        `if new.${field} is distinct from old.${field} then`,
      );
      expect(activity).toContain(`'${field}'`);
    }

    expect(activity).toContain("'task.updated'");
  });

  it('preserves authenticated-only execution', () => {
    const signature = 'public.update_task(uuid, integer, jsonb)';

    expect(sql).toContain(`alter function ${signature} owner to postgres`);
    expect(sql).toContain(
      `revoke all on function ${signature}\n  from public, anon, authenticated`,
    );
    expect(sql).toContain(
      `grant execute on function ${signature}\n  to authenticated`,
    );
  });
});
