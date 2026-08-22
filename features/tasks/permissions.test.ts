import { describe, expect, it } from 'vitest';

import { canEditTaskOverview } from './permissions';
import type { TaskOverview } from './types';

const task = {
  created_by: 'creator',
  primary_assignee_id: 'assignee',
} as TaskOverview;

describe('canEditTaskOverview', () => {
  it.each(['owner', 'admin', 'manager'] as const)(
    'allows the %s role',
    (role) => {
      expect(canEditTaskOverview(role, 'unrelated', task)).toBe(true);
    },
  );

  it('allows a related member only', () => {
    expect(canEditTaskOverview('member', 'creator', task)).toBe(true);
    expect(canEditTaskOverview('member', 'assignee', task)).toBe(true);
    expect(canEditTaskOverview('member', 'unrelated', task)).toBe(false);
  });

  it('keeps viewers read-only', () => {
    expect(canEditTaskOverview('viewer', 'creator', task)).toBe(false);
  });
});
