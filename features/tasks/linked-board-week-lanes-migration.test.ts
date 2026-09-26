import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260926180000_link_board_week_special_lanes.sql',
  ),
  'utf8',
).toLowerCase();

describe('vínculo entre Quadro e Semana', () => {
  it('cria Emergência antes do fluxo padrão e renomeia a revisão editorial', () => {
    expect(sql).toContain("'emergência',\n  'todo',\n  'red',\n  0");
    expect(sql).toContain("set name = 'alterações'");
    expect(sql).toContain("status.system_category = 'review'");
  });

  it('sincroniza os dois sentidos na mesma escrita da tarefa', () => {
    expect(sql).toContain(
      'create or replace function private.sync_task_special_lanes()',
    );
    expect(sql).toContain("new.week_lane := 'emergency'");
    expect(sql).toContain("new.week_lane := 'revision'");
    expect(sql).toContain("new.week_lane = 'emergency'");
    expect(sql).toContain("new.week_lane = 'revision'");
    expect(sql).toContain(
      'new.status_id := coalesce(v_linked_status_id, new.status_id)',
    );
  });

  it('executa antes da validação e do incremento de versão existentes', () => {
    expect(sql).toContain('create trigger tasks_00_sync_special_lanes');
    expect(sql).toContain(
      'before insert or update of status_id, week_lane on public.tasks',
    );
    expect(sql).toContain(
      'for each row execute function private.sync_task_special_lanes()',
    );
  });
});
