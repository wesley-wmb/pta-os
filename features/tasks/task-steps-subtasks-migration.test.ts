import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260924213000_task_steps_and_subtasks.sql',
  ),
  'utf8',
).toLowerCase();

describe('task steps and subtasks migration contract', () => {
  it('keeps subtasks in the central task entity with workspace-scoped links', () => {
    expect(sql).toContain('create table public.task_subtasks');
    expect(sql).toContain('references public.tasks(workspace_id, id)');
    expect(sql).toContain(
      'primary key (workspace_id, parent_task_id, child_task_id)',
    );
    expect(sql).toContain('unique (workspace_id, child_task_id)');
    expect(sql).toContain(
      'alter table public.task_subtasks force row level security',
    );
    expect(sql).toContain('private.is_active_workspace_member(workspace_id)');
  });

  it('creates delegated tasks atomically through an authenticated RPC', () => {
    const start = sql.indexOf(
      'create or replace function public.create_task_subtask',
    );
    const end = sql.indexOf(
      'create or replace function private.task_collaboration_payload',
      start,
    );
    const body = sql.slice(start, end);

    expect(body).toContain('security definer');
    expect(body).toContain("set search_path = ''");
    expect(body).toContain('private.can_edit_task(p_parent_task_id)');
    expect(body).toContain('member.workspace_id = v_parent.workspace_id');
    expect(body).toContain('public.create_global_task(');
    expect(body).toContain('insert into public.task_assignees');
    expect(body).toContain('insert into public.task_subtasks');
    expect(body).toContain("'task.subtask_created'");
  });

  it('supports a default checklist without requiring a named section', () => {
    expect(sql).toContain(
      'add column is_default boolean not null default false',
    );
    expect(sql).toContain('task_checklists_one_default_per_task');
    expect(sql).toContain(
      'create or replace function public.add_task_checklist_item_to_task',
    );
    expect(sql).toContain("p_task_id, 'checklist', 0, v_actor, true");
  });

  it('edits checklist titles and items with optimistic conflict checks', () => {
    expect(sql).toContain(
      'create or replace function public.update_task_checklist(',
    );
    expect(sql).toContain(
      'create or replace function public.update_task_checklist_item(',
    );
    expect(sql).toContain('v_checklist.updated_at <> p_expected_updated_at');
    expect(sql).toContain('v_item.updated_at <> p_expected_updated_at');
    expect(sql).toContain("message = 'pta_version_conflict'");
  });

  it('returns relationships and capabilities in the task detail contract', () => {
    expect(sql).toContain("'subtasks', v_subtasks");
    expect(sql).toContain("'parent_task', v_parent_task");
    expect(sql).toContain("'can_create_subtask'");
    expect(sql).toContain("'can_manage_task_steps'");
    expect(sql).toContain(
      "to_regprocedure('public.remove_task_checklist_item(uuid,timestamp with time zone)')",
    );
    expect(sql).toContain("'is_default', checklist.is_default");
    expect(sql.trimEnd().endsWith('commit;')).toBe(true);
  });
});
