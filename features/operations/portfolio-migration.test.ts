import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260822235321_events_products_operational.sql',
);
const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

describe('portfolio migration security contract', () => {
  it('is atomic and forces RLS on every new relation', () => {
    expect(sql.trimStart().includes('begin;')).toBe(true);
    expect(sql.trimEnd().endsWith('commit;')).toBe(true);
    for (const table of [
      'product_members',
      'event_members',
      'event_milestones',
    ]) {
      expect(sql).toContain(
        `alter table public.${table} force row level security`,
      );
    }
  });

  it('uses workspace-scoped composite foreign keys for teams', () => {
    expect(sql).toContain(
      'foreign key (workspace_id, product_id)\n    references public.products(workspace_id, id)',
    );
    expect(sql).toContain(
      'foreign key (workspace_id, event_id)\n    references public.events(workspace_id, id)',
    );
    expect(sql).toContain(
      'foreign key (workspace_id, user_id)\n    references public.workspace_members(workspace_id, user_id)',
    );
  });

  it('keeps writes behind authenticated RPCs', () => {
    expect(sql).toContain(
      'revoke insert, update, delete, truncate on public.products, public.events',
    );
    expect(sql).not.toMatch(
      /grant\s+(insert|update|delete|all)\s+on\s+public\./,
    );
    expect(sql).toContain(
      'grant execute on function public.create_event_operational',
    );
    expect(sql).toContain(
      'grant execute on function public.create_product_operational',
    );
  });

  it('rejects missing workspace roles and validates active people', () => {
    expect(sql.match(/v_role is null/g)?.length).toBeGreaterThanOrEqual(10);
    expect(sql).toContain('pta_owner_not_active_member');
    expect(sql).toContain('pta_team_member_not_active');
    expect(sql).toContain('pta_assignee_not_active_member');
  });

  it('classifies operational event health with priority and blocks', () => {
    expect(sql).toContain("when p_critical > 0 then 'risk'");
    expect(sql).toContain(
      "when p_overdue > 0 or p_blocked > 0 then 'attention'",
    );
    expect(sql).toContain(
      "task.due_at < now()\n          and task.priority in ('high', 'urgent')",
    );
    expect(sql).toContain(
      "status.system_category = 'blocked' and task.priority in ('high', 'urgent')",
    );
  });

  it('derives date-only comparisons from the workspace timezone', () => {
    expect(
      sql.match(
        /v_today := \(clock_timestamp\(\) at time zone v_timezone\)::date/g,
      )?.length,
    ).toBe(3);
    expect(sql).not.toContain('current_date');
    expect(sql).toContain(
      "return jsonb_build_object('events', v_result, 'today', v_today)",
    );
  });
});
