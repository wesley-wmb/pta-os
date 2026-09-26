import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260926170000_project_timeline_planning.sql',
  ),
  'utf8',
).toLowerCase();

function functionBody(name: string, nextMarker = 'alter function') {
  const start = sql.indexOf(`create or replace function public.${name}`);
  const end = sql.indexOf(nextMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe('contrato persistente do cronograma de projeto', () => {
  it('modela intervalos com datas e horários locais separados', () => {
    expect(sql).toContain('add column start_date date');
    expect(sql).toContain('add column start_time time without time zone');
    expect(sql).toContain('constraint tasks_schedule_range_valid');
    expect(sql).toContain('check (start_date is null or due_date is not null)');
  });

  it('mantém fases personalizadas e marcos no mesmo projeto e workspace', () => {
    expect(sql).toContain('create table public.event_phases');
    expect(sql).toContain(
      'foreign key (workspace_id, event_id, event_phase_id)',
    );
    expect(sql).toContain(
      'references public.event_phases(workspace_id, event_id, id)',
    );
    expect(sql).toContain(
      'alter table public.event_phases force row level security',
    );
  });

  it('move tarefa entre datas, fase e status com concorrência otimista', () => {
    const body = functionBody('move_task_in_timeline');
    expect(body).toContain('private.can_edit_task(p_task_id)');
    expect(body).toContain('task.workspace_id = p_workspace_id');
    expect(body).toContain('task.event_id = p_event_id');
    expect(body).toContain('task.version = p_expected_version');
    expect(body).toContain('status_id = p_status_id');
    expect(body).toContain('event_phase_id = p_event_phase_id');
    expect(body).toContain("message = 'pta_version_conflict'");
  });

  it('expõe um snapshot único para renderizar e reconciliar o cronograma', () => {
    const body = functionBody('get_project_timeline');
    expect(body).toContain("'phases'");
    expect(body).toContain("'statuses'");
    expect(body).toContain("'tasks'");
    expect(body).toContain("'milestones'");
    expect(body).toContain("'can_edit', private.can_edit_task(task.id)");
  });

  it('não concede mutações diretas e publica somente RPCs autenticadas', () => {
    expect(sql).toContain(
      'revoke insert, update, delete, truncate on table public.event_phases from authenticated',
    );
    expect(sql).toContain(
      'grant execute on function public.move_task_in_timeline',
    );
    expect(sql).toContain(
      'grant execute on function public.move_event_milestone_in_timeline',
    );
    expect(sql.trimEnd().endsWith('commit;')).toBe(true);
  });
});
