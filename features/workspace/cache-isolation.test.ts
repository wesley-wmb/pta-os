import { describe, expect, it } from 'vitest';

import { portfolioKeys } from '@/features/operations/portfolio-queries';
import { resourceKeys } from '@/features/resources/queries';
import { searchKeys } from '@/features/search/queries';
import { taskKeys } from '@/features/tasks/queries';

const workspaceA = '11111111-1111-4111-8111-111111111111';
const workspaceB = '22222222-2222-4222-8222-222222222222';
const entityId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('workspace query cache isolation', () => {
  it.each([
    ['tasks', taskKeys.all(workspaceA), taskKeys.all(workspaceB)],
    [
      'task detail',
      taskKeys.detail(workspaceA, entityId),
      taskKeys.detail(workspaceB, entityId),
    ],
    [
      'resource detail',
      resourceKeys.detail(workspaceA, entityId),
      resourceKeys.detail(workspaceB, entityId),
    ],
    [
      'event detail',
      portfolioKeys.event(workspaceA, entityId),
      portfolioKeys.event(workspaceB, entityId),
    ],
    [
      'product detail',
      portfolioKeys.product(workspaceA, entityId),
      portfolioKeys.product(workspaceB, entityId),
    ],
    [
      'global search',
      searchKeys.workspace(workspaceA, 'briefing', 8),
      searchKeys.workspace(workspaceB, 'briefing', 8),
    ],
  ])('separates %s by workspace id', (_label, keyA, keyB) => {
    expect(keyA).not.toEqual(keyB);
    expect(keyA).toContain(workspaceA);
    expect(keyB).toContain(workspaceB);
  });
});
