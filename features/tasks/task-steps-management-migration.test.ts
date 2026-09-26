import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260925150000_task_steps_management.sql',
  ),
  'utf8',
).toLowerCase();

describe('task steps management migration contract', () => {
  it('removes checklist items with permission and optimistic concurrency', () => {
    expect(sql).toContain(
      'create or replace function public.remove_task_checklist_item',
    );
    expect(sql).toContain('private.can_edit_task(v_item.task_id)');
    expect(sql).toContain('v_item.updated_at <> p_expected_updated_at');
    expect(sql).toContain("'task.checklist_item_removed'");
  });

  it('removes a complete checklist and relies on the existing cascade', () => {
    expect(sql).toContain(
      'create or replace function public.remove_task_checklist',
    );
    expect(sql).toContain('private.can_edit_task(v_checklist.task_id)');
    expect(sql).toContain(
      'delete from public.task_checklists checklist where checklist.id = v_checklist.id',
    );
    expect(sql).toContain("'task.checklist_removed'");
  });

  it('unlinks a child without deleting the delegated task', () => {
    const start = sql.indexOf(
      'create or replace function public.unlink_task_subtask',
    );
    const end = sql.indexOf(
      'alter function public.remove_task_checklist_item',
      start,
    );
    const unlink = sql.slice(start, end);

    expect(unlink).toContain('private.can_edit_task(p_parent_task_id)');
    expect(unlink).toContain('v_parent.version <> p_expected_parent_version');
    expect(unlink).toContain('delete from public.task_subtasks relation');
    expect(unlink).not.toContain('delete from public.tasks');
    expect(unlink).toContain("'task.subtask_unlinked'");
  });

  it('exposes mutations only to authenticated clients', () => {
    expect(sql).toContain(
      'grant execute on function public.remove_task_checklist_item(uuid, timestamptz) to authenticated',
    );
    expect(sql).toContain(
      'grant execute on function public.remove_task_checklist(uuid, timestamptz) to authenticated',
    );
    expect(sql).toContain(
      'grant execute on function public.unlink_task_subtask(uuid, uuid, integer) to authenticated',
    );
  });
});
