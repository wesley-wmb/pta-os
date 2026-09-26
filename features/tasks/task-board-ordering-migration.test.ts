import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260925130000_task_board_ordering.sql',
  ),
  'utf8',
).toLowerCase();

function moveBody() {
  const start = sql.indexOf(
    'create or replace function public.move_task_in_board',
  );
  const end = sql.indexOf(
    'revoke all on function public.move_task_in_board',
    start,
  );
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe('contrato de ordenação persistente do Kanban', () => {
  it('mantém a posição do quadro separada da posição semanal', () => {
    expect(sql).toContain(
      'add column if not exists board_position numeric(20, 10)',
    );
    expect(sql).toContain(
      'on public.tasks (workspace_id, status_id, board_position, task_number)',
    );
    expect(sql).toContain('task.board_position');
    expect(moveBody()).not.toContain('week_position =');
  });

  it('protege a mutação por workspace, permissão e versão', () => {
    const move = moveBody();
    expect(move).toContain("set search_path = ''");
    expect(move).toContain('task.workspace_id = p_workspace_id');
    expect(move).toContain('private.can_edit_task(p_task_id)');
    expect(move).toContain('v_task.version <> p_expected_version');
    expect(move).toContain('task.version = p_expected_version');
  });

  it('valida vizinhos, serializa a coluna e rebalanceia sem perder atomicidade', () => {
    const move = moveBody();
    expect(move).toContain('pg_advisory_xact_lock');
    expect(move).toContain('for update');
    expect(move).toContain("message = 'pta_board_order_conflict'");
    expect(move).toContain('row_number() over');
    expect(move).toContain(
      'v_before_position + ((v_after_position - v_before_position) / 2)',
    );
  });

  it('preserva a regra de motivo obrigatório para bloqueio', () => {
    const move = moveBody();
    expect(move).toContain("v_status_category = 'blocked'");
    expect(move).toContain("message = 'pta_blocked_reason_required'");
  });

  it('concede execução somente a clientes autenticados', () => {
    expect(sql).toContain(
      'revoke all on function public.move_task_in_board(\n  uuid, uuid, uuid, uuid, uuid, integer, text\n) from public, anon',
    );
    expect(sql).toContain(
      'grant execute on function public.move_task_in_board(\n  uuid, uuid, uuid, uuid, uuid, integer, text\n) to authenticated',
    );
  });
});
