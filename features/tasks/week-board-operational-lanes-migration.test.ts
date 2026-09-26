import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260825123000_week_board_operational_lanes.sql',
);
const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

function moveTaskBody() {
  const start = sql.indexOf(
    'create or replace function public.move_task_in_week',
  );
  const end = sql.indexOf(
    'comment on function public.move_task_in_week',
    start + 1,
  );
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe('weekly operational lanes migration contract', () => {
  it('adds a bounded persistent lane to the central task entity', () => {
    expect(sql).toContain('add column if not exists week_lane text');
    expect(sql).toContain("alter column week_lane set default 'scheduled'");
    expect(sql).toContain('alter column week_lane set not null');

    for (const lane of [
      'backlog',
      'emergency',
      'important',
      'scheduled',
      'delivered',
      'revision',
      'ideas',
      'discarded',
    ]) {
      expect(sql).toContain(`'${lane}'`);
    }

    expect(sql).toContain(
      'on public.tasks (workspace_id, week_lane, week_position)',
    );
  });

  it('keeps movement behind authorization and optimistic concurrency', () => {
    const move = moveTaskBody();

    expect(move).toContain('security definer');
    expect(move).toContain("set search_path = ''");
    expect(move).toContain('private.can_edit_task(p_task_id)');
    expect(move).toContain('task.version = p_expected_version');
    expect(move).toContain("message = 'pta_version_conflict'");
    expect(move).toContain("message = 'pta_week_lane_invalid'");
    expect(move).toContain("message = 'pta_week_date_required'");
  });

  it('exposes the RPC and overview only to authenticated clients', () => {
    expect(sql).toContain(
      'revoke all on function public.move_task_in_week(uuid, text, date, numeric, integer)\n  from public, anon',
    );
    expect(sql).toContain(
      'grant execute on function public.move_task_in_week(uuid, text, date, numeric, integer)\n  to authenticated',
    );
    expect(sql).toContain('with (security_invoker = true)');
    expect(sql).toContain('task.week_lane');
    expect(sql).toContain(
      'revoke all on table public.v_task_overview from public, anon, authenticated',
    );
    expect(sql).toContain(
      'grant select on table public.v_task_overview to authenticated',
    );
  });

  it('preserves date semantics for planning and scheduled lanes', () => {
    const move = moveTaskBody();

    expect(move).toContain("when p_week_lane = 'scheduled' then p_due_date");
    expect(move).toContain("when p_week_lane = 'backlog' then null");
    expect(move).toContain(
      "when p_week_lane = 'backlog' then null\n      else task.due_time",
    );
  });
});
