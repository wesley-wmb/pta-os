import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260926210000_configurable_task_boards.sql',
  ),
  'utf8',
)
  .replace(/\r\n/g, '\n')
  .toLowerCase();

function functionBody(name: string) {
  const start = sql.indexOf(`create or replace function public.${name}`);
  const end = sql.indexOf('$$;', sql.indexOf('as $$', start)) + 3;
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe('fundação configurável dos quadros de tarefas', () => {
  it('adiciona identidade semântica e versão sem acoplar automações ao nome', () => {
    expect(sql).toContain('add column if not exists semantic_key text');
    expect(sql).toContain(
      "add column if not exists icon_key text not null default 'circle'",
    );
    expect(sql).toContain(
      'add column if not exists version integer not null default 1',
    );
    expect(sql).toContain('task_statuses_semantic_key_workspace_unique');
    expect(sql).toContain('create table public.task_status_week_lane_links');
    const sync = sql.slice(
      sql.indexOf(
        'create or replace function private.sync_task_special_lanes()',
      ),
      sql.indexOf('drop trigger if exists tasks_00_sync_special_lanes'),
    );
    expect(sync).toContain('from public.task_status_week_lane_links link');
    expect(sync).not.toContain('lower(btrim(status.name))');
  });

  it('modela configurações e faixas semanais por workspace com RLS forçada', () => {
    expect(sql).toContain('create table public.task_board_settings');
    expect(sql).toContain('primary key (workspace_id, board_kind)');
    expect(sql).toContain('create table public.task_week_lanes');
    expect(sql).toContain('primary key (workspace_id, lane_key)');
    expect(sql).toContain('foreign key (workspace_id, week_lane)');
    expect(sql).toContain(
      'alter table public.task_board_settings force row level security',
    );
    expect(sql).toContain(
      'alter table public.task_week_lanes force row level security',
    );
    expect(sql).toContain('private.is_active_workspace_member(workspace_id)');
  });

  it('protege todas as mutações por papel, workspace, lock e versão', () => {
    for (const name of [
      'update_task_board_column',
      'reorder_task_board_columns',
      'set_task_board_lane_link',
    ]) {
      const body = functionBody(name);
      expect(body).toContain("set search_path = ''");
      expect(body).toContain('private.current_workspace_role(p_workspace_id)');
      expect(body).toContain("'manager'::public.workspace_role");
      expect(body).toContain('pg_catalog.pg_advisory_xact_lock');
      expect(body).toContain('p_expected_board_version');
      expect(body).toContain("message = 'pta_version_conflict'");
    }
  });

  it('reordena somente o conjunto completo de colunas ativas do workspace', () => {
    const reorder = functionBody('reorder_task_board_columns');
    expect(reorder).toContain('count(distinct ordered_key.key)');
    expect(reorder).toContain('v_matched_count <> v_active_count');
    expect(reorder).toContain("message = 'pta_board_column_order_invalid'");
    expect(reorder).toContain('with ordinality ordered(key, ordinality)');
    expect(reorder).toContain('ordered.ordinality::integer * 1000');
  });

  it('expõe leitura compatível por capacidade e restringe execução a autenticados', () => {
    const get = functionBody('get_task_board_configuration');
    expect(get).toContain("'schema_version', 1");
    expect(get).toContain("'can_manage_columns'");
    expect(get).toContain("'status_board'");
    expect(get).toContain("'week_board'");
    expect(get).toContain("'links'");
    expect(sql).toContain(
      'grant execute on function public.get_task_board_configuration(uuid)\n  to authenticated',
    );
    expect(sql).toContain(
      'revoke all on public.task_status_week_lane_links from public, anon, authenticated',
    );
    expect(sql).toContain("publication.pubname = 'supabase_realtime'");
    expect(sql).toContain("'task_board_settings'");
    expect(sql).toContain("'task_status_week_lane_links'");
  });
});

describe('fundação configurável do Kanban de Projetos', () => {
  it('mantém quatro estados estáveis por workspace e liga o status físico do projeto', () => {
    expect(sql).toContain('create table public.project_board_columns');
    expect(sql).toContain(
      "column_key in ('planning', 'active', 'completed', 'cancelled')",
    );
    expect(sql).toContain(
      "('planning', 'planejamento', 'stone', 'clipboard-list', 1000)",
    );
    expect(sql).toContain(
      "('active', 'em andamento', 'blue', 'circle-play', 2000)",
    );
    expect(sql).toContain(
      "('completed', 'concluídos', 'green', 'circle-check', 3000)",
    );
    expect(sql).toContain(
      "('cancelled', 'cancelados', 'stone', 'circle-x', 4000)",
    );
    expect(sql).toContain(
      'foreign key (workspace_id, status)\n  references public.project_board_columns(workspace_id, column_key)',
    );
  });

  it('semeia configurações para workspaces atuais e futuros', () => {
    expect(sql).toContain('create table public.project_board_settings');
    expect(sql).toContain(
      'insert into public.project_board_settings (workspace_id)\nselect workspace.id',
    );
    const seed = sql.slice(
      sql.indexOf(
        'create or replace function private.seed_task_board_configuration()',
      ),
      sql.indexOf(
        'drop trigger if exists workspaces_seed_task_board_configuration',
      ),
    );
    expect(seed).toContain(
      'insert into public.project_board_settings (workspace_id) values (new.id)',
    );
    expect(seed).toContain('insert into public.project_board_columns');
  });

  it('retorna o contrato esperado pelo frontend', () => {
    const get = functionBody('get_project_board_configuration');
    expect(get).toContain("'schema_version', 1");
    expect(get).toContain("'workspace_id', p_workspace_id");
    expect(get).toContain("'version', v_board_version");
    expect(get).toContain("'can_manage_columns'");
    expect(get).toContain("'columns'");
    expect(get).toContain("'key', board_column.column_key");
    expect(get).toContain("'icon_key', board_column.icon_key");
  });

  it('protege edição e ordem por workspace, papel, lock e versões otimistas', () => {
    for (const name of [
      'update_project_board_column',
      'reorder_project_board_columns',
    ]) {
      const body = functionBody(name);
      expect(body).toContain("set search_path = ''");
      expect(body).toContain('private.current_workspace_role(p_workspace_id)');
      expect(body).toContain("'manager'::public.workspace_role");
      expect(body).toContain('pg_catalog.pg_advisory_xact_lock');
      expect(body).toContain('p_expected_board_version');
      expect(body).toContain("message = 'pta_version_conflict'");
      expect(body).toContain('board_column.workspace_id = p_workspace_id');
    }
    expect(functionBody('update_project_board_column')).toContain(
      'p_expected_column_version',
    );
    expect(functionBody('reorder_project_board_columns')).toContain(
      "message = 'pta_project_board_column_order_invalid'",
    );
  });

  it('aplica RLS, grants autenticados, auditoria e Realtime', () => {
    expect(sql).toContain(
      'alter table public.project_board_columns force row level security',
    );
    expect(sql).toContain(
      'on public.project_board_columns for select to authenticated',
    );
    expect(sql).toContain(
      'revoke all on public.project_board_columns from public, anon, authenticated',
    );
    expect(sql).toContain(
      'grant execute on function public.get_project_board_configuration(uuid)\n  to authenticated',
    );
    expect(sql).toContain("'project_board.column_updated'");
    expect(sql).toContain("'project_board.columns_reordered'");
    expect(sql).toContain("'project_board_settings'");
    expect(sql).toContain("'project_board_columns'");
  });
});
