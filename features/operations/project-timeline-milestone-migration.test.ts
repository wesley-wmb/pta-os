import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260926171000_project_timeline_milestone_management.sql',
  ),
  'utf8',
).toLowerCase();

function functionBody(name: string, nextMarker = 'create or replace function') {
  const start = sql.indexOf(`create or replace function public.${name}`);
  const next = sql.indexOf(nextMarker, start + 1);
  const end = next >= 0 ? next : sql.indexOf('alter function', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe('gerenciamento persistente de marcos do cronograma', () => {
  it('edita somente campos permitidos e valida a fase dentro do projeto', () => {
    const body = functionBody('update_event_milestone');
    expect(body).toContain("array['title', 'due_date', 'event_phase_id']");
    expect(body).toContain('phase.event_id = v_milestone.event_id');
    expect(body).toContain('phase.workspace_id = p_workspace_id');
    expect(body).toContain('milestone.version = p_expected_version');
    expect(body).toContain("message = 'pta_version_conflict'");
  });

  it('exclui com workspace e versão esperada antes de registrar a atividade', () => {
    const body = functionBody('delete_event_milestone', 'alter function');
    expect(body).toContain('milestone.workspace_id = p_workspace_id');
    expect(body).toContain('milestone.version = p_expected_version');
    expect(body).toContain("'event.milestone_deleted'");
    expect(body).toContain("'deleted', true");
  });

  it('não abre escrita direta e concede apenas as RPCs autenticadas', () => {
    expect(sql).toContain(
      'revoke all on function public.update_event_milestone(uuid, uuid, integer, jsonb) from public, anon, authenticated',
    );
    expect(sql).toContain(
      'grant execute on function public.delete_event_milestone(uuid, uuid, integer) to authenticated',
    );
    expect(sql.trimEnd().endsWith('commit;')).toBe(true);
  });
});
