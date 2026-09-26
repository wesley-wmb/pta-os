import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260823010000_global_task_context.sql',
);
const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

function globalTaskBody() {
  const start = sql.indexOf(
    'create or replace function public.create_global_task',
  );
  const end = sql.indexOf(
    'comment on function public.create_global_task',
    start + 1,
  );
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe('global task context migration contract', () => {
  it('is atomic and preserves an RLS-aware overview grant', () => {
    expect(sql.trimStart().startsWith('-- end-to-end context')).toBe(true);
    expect(sql).toContain('begin;');
    expect(sql.trimEnd().endsWith('commit;')).toBe(true);
    expect(sql).toContain('with (security_invoker = true)');
    expect(sql).toContain(
      'revoke all on table public.v_task_overview from public, anon, authenticated',
    );
    expect(sql).toContain(
      'grant select on table public.v_task_overview to authenticated',
    );
    expect(sql).toContain(
      'alter view public.v_task_overview owner to postgres',
    );
  });

  it('adds workspace-scoped type, product and event context to the overview', () => {
    for (const column of [
      'task.type_id',
      'task_type.name as type_name',
      'task.product_id',
      'product.name as product_name',
      'task.event_id',
      'event.name as event_name',
    ]) {
      expect(sql).toContain(column);
    }

    expect(sql).toContain(
      'task_type.workspace_id = task.workspace_id\n  and task_type.id = task.type_id',
    );
    expect(sql).toContain(
      'product.workspace_id = task.workspace_id\n  and product.id = task.product_id',
    );
    expect(sql).toContain(
      'event.workspace_id = task.workspace_id\n  and event.id = task.event_id',
    );
    expect(sql).toContain('left join public.task_types task_type');
    expect(sql).toContain('left join public.products product');
    expect(sql).toContain('left join public.events event');
  });

  it('keeps task creation behind the current role matrix', () => {
    const create = globalTaskBody();

    expect(create).toContain(
      'v_role := private.current_workspace_role(p_workspace_id)',
    );
    expect(create).toContain('v_actor is null');
    expect(create).toContain('or v_role is null');
    expect(create).toContain('v_role not in (');
    for (const role of ['owner', 'admin', 'manager', 'member']) {
      expect(create).toContain(`'${role}'::public.workspace_role`);
    }
    expect(create).toContain('security definer');
    expect(create).toContain("set search_path = ''");
    expect(create).toContain(
      "v_role = 'member'::public.workspace_role\n       and p_primary_assignee_id <> v_actor",
    );
    expect(create).toContain("member.status = 'active'");
    expect(create).toContain('profile.is_active');
    expect(create).toContain("member.role <> 'viewer'::public.workspace_role");
  });

  it('validates every workspace-scoped relation and event product coherence', () => {
    const create = globalTaskBody();

    expect(create).toContain('status.workspace_id = p_workspace_id');
    expect(create).toContain('and status.is_active');
    expect(create).toContain('task_type.workspace_id = p_workspace_id');
    expect(create).toContain('and task_type.is_active');
    expect(create).toContain('product.workspace_id = p_workspace_id');
    expect(create).toContain('and product.archived_at is null');
    expect(create).toContain('event.workspace_id = p_workspace_id');
    expect(create).toContain('and event.archived_at is null');
    expect(create).toContain('v_product_id := v_event_product_id');
    expect(create).toContain("message = 'pta_event_product_mismatch'");
  });

  it('validates the structured task document and rejects inconsistent due time', () => {
    const create = globalTaskBody();

    expect(create).toContain("message = 'pta_due_date_required_for_time'");
    expect(create).toContain(
      "jsonb_build_object('type', 'doc', 'content', jsonb_build_array())",
    );
    expect(create).toContain('p_description jsonb default null');
    expect(create).not.toContain('regexp_split_to_table');
    expect(create).toContain(
      'private.is_valid_task_description(v_description_json)',
    );
    expect(create).toContain('octet_length(v_description_json::text) > 256000');
    expect(create).toContain('description_json,');
  });

  it('requires a bounded reason when the initial status is blocked', () => {
    const create = globalTaskBody();

    expect(create).toContain('p_blocked_reason text default null');
    expect(create).toContain(
      "v_status_category = 'blocked'::public.task_status_category",
    );
    expect(create).toContain("message = 'pta_blocked_reason_required'");
    expect(create).toContain("message = 'pta_blocked_reason_too_long'");
    expect(create).toContain('blocked_reason,');
  });

  it('creates the primary assignment and returns persisted context', () => {
    const create = globalTaskBody();

    expect(create).toContain('insert into public.task_assignees');
    for (const key of [
      "'id', v_task.id",
      "'task_number', v_task.task_number",
      "'version', v_task.version",
      "'status_id', v_task.status_id",
      "'type_id', v_task.type_id",
      "'product_id', v_task.product_id",
      "'event_id', v_task.event_id",
    ]) {
      expect(create).toContain(key);
    }
  });

  it('sets ownership and exposes only authenticated execution', () => {
    const signature =
      'public.create_global_task(\n  uuid,\n  text,\n  uuid,\n  public.task_priority,\n  date,\n  time without time zone,\n  uuid,\n  uuid,\n  uuid,\n  uuid,\n  jsonb,\n  text\n)';

    expect(sql).toContain(`alter function ${signature} owner to postgres`);
    expect(sql).toContain(
      `revoke all on function ${signature} from public, anon, authenticated`,
    );
    expect(sql).toContain(
      `grant execute on function ${signature} to authenticated`,
    );
    expect(sql).not.toMatch(
      /grant\s+(insert|update|delete|all)\s+on\s+(?:table\s+)?public\.(?:tasks|task_assignees)/,
    );
  });
});
