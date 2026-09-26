import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260822235316_resource_relations_categories.sql',
);
const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

function functionBody(name: string, nextName: string) {
  const start = sql.indexOf(`create or replace function ${name}`);
  const end = sql.indexOf(`create or replace function ${nextName}`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe('resource category concurrency contract', () => {
  it('locks resource category writers before validating the category', () => {
    const trigger = functionBody(
      'private.resources_before_write',
      'private.resource_activity_after_write',
    );
    const lock = trigger.indexOf('private.lock_resource_category_write');
    const validation = trigger.indexOf('pta_invalid_resource_category');

    expect(lock).toBeGreaterThan(0);
    expect(validation).toBeGreaterThan(lock);
  });

  it('shares the category lock with refresh, rename and archive', () => {
    const refresh = functionBody(
      'private.refresh_resource_search_vector',
      'private.resource_relation_search_after_write',
    );
    const update = functionBody(
      'public.update_resource_category',
      'public.archive_resource_category',
    );
    const archive = functionBody(
      'public.archive_resource_category',
      'public.reorder_resource_categories',
    );

    for (const body of [refresh, update, archive]) {
      expect(body).toContain('private.lock_resource_category_write');
    }
  });

  it('prelocks catalog refresh categories in a deterministic order', () => {
    const catalogRefresh = functionBody(
      'private.resource_catalog_search_after_write',
      'public.update_resource',
    );
    const orderedCategories = catalogRefresh.indexOf(
      'order by resource.category_id',
      catalogRefresh.indexOf('for v_category_id in'),
    );
    const categoryLock = catalogRefresh.indexOf(
      'private.lock_resource_category_write',
      orderedCategories,
    );
    const refresh = catalogRefresh.indexOf(
      'private.refresh_resource_search_vector',
      categoryLock,
    );

    expect(catalogRefresh).toContain(
      'array_agg(resource.id order by resource.category_id nulls last, resource.id)',
    );
    expect(orderedCategories).toBeGreaterThan(0);
    expect(categoryLock).toBeGreaterThan(orderedCategories);
    expect(refresh).toBeGreaterThan(categoryLock);
  });

  it('orders relation update resource ids before category locks and refreshes', () => {
    const relationRefresh = functionBody(
      'private.resource_relation_search_after_write',
      'private.resource_catalog_search_after_write',
    );
    const orderedResourceIds = relationRefresh.indexOf(
      'array_agg(candidate.resource_id order by candidate.resource_id)',
    );
    const orderedCategories = relationRefresh.indexOf(
      'order by resource.workspace_id, resource.category_id',
    );
    const categoryLock = relationRefresh.indexOf(
      'private.lock_resource_category_write',
      orderedCategories,
    );
    const refresh = relationRefresh.indexOf(
      'private.refresh_resource_search_vector',
      categoryLock,
    );

    expect(orderedResourceIds).toBeGreaterThan(0);
    expect(orderedCategories).toBeGreaterThan(orderedResourceIds);
    expect(categoryLock).toBeGreaterThan(orderedCategories);
    expect(refresh).toBeGreaterThan(categoryLock);
  });

  it('locks old and new categories before the resource update obtains a row lock', () => {
    const update = functionBody(
      'public.update_resource',
      'public.archive_resource',
    );
    const categoryCandidates = update.indexOf('values (');
    const orderedCandidates = update.indexOf('order by candidate.category_id');
    const categoryLock = update.indexOf(
      'private.lock_resource_category_write',
      orderedCandidates,
    );
    const resourceUpdate = update.indexOf('update public.resources');

    expect(categoryCandidates).toBeGreaterThan(0);
    expect(orderedCandidates).toBeGreaterThan(categoryCandidates);
    expect(categoryLock).toBeGreaterThan(orderedCandidates);
    expect(resourceUpdate).toBeGreaterThan(categoryLock);
  });

  it('locks the current category before archive obtains a resource row lock', () => {
    const archive = functionBody(
      'public.archive_resource',
      'public.search_resource_relation_options',
    );
    const categoryLock = archive.indexOf(
      'private.lock_resource_category_write',
    );
    const resourceUpdate = archive.indexOf('update public.resources');

    expect(categoryLock).toBeGreaterThan(0);
    expect(resourceUpdate).toBeGreaterThan(categoryLock);
  });

  it('keeps resource write RPC ownership and grants explicit', () => {
    expect(sql).toContain(
      'alter function public.update_resource(uuid, integer, jsonb) owner to postgres',
    );
    expect(sql).toContain(
      'alter function public.archive_resource(uuid, integer) owner to postgres',
    );
    expect(sql).toContain(
      'revoke all on function public.update_resource(uuid, integer, jsonb)',
    );
    expect(sql).toContain(
      'revoke all on function public.archive_resource(uuid, integer)',
    );
    expect(sql).toContain(
      'grant execute on function public.update_resource(uuid, integer, jsonb)',
    );
    expect(sql).toContain(
      'grant execute on function public.archive_resource(uuid, integer)',
    );
    expect(sql).toMatch(
      /revoke all on table\s+public\.resources,\s+public\.resource_tasks,\s+public\.resource_products,\s+public\.resource_events,\s+public\.resource_tags\s+from public, anon, authenticated/,
    );
  });

  it('validates the expected reorder snapshot while holding the workspace lock', () => {
    const reorderStart = sql.indexOf(
      'create or replace function public.reorder_resource_categories',
    );
    const grantsStart = sql.indexOf(
      'alter function private.resource_search_vector_v2',
      reorderStart,
    );
    const reorder = sql.slice(reorderStart, grantsStart);
    const workspaceLock = reorder.indexOf('pg_advisory_xact_lock');
    const snapshotCheck = reorder.indexOf(
      'private.resource_categories_snapshot(p_workspace_id)',
    );
    const update = reorder.indexOf('update public.resource_categories');

    expect(reorder).toContain('p_expected_snapshot text');
    expect(workspaceLock).toBeGreaterThan(0);
    expect(snapshotCheck).toBeGreaterThan(workspaceLock);
    expect(update).toBeGreaterThan(snapshotCheck);
  });
});
