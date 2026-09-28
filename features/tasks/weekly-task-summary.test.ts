import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from, builders } = vi.hoisted(() => ({
  from: vi.fn(),
  builders: [] as Array<Record<string, ReturnType<typeof vi.fn>>>,
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from }),
}));
vi.mock('./queries', () => ({ useTaskRealtime: vi.fn() }));

import { fetchWeeklyTaskSummary } from './weekly-task-summary';

function queueCount(count: number | null, error: Error | null = null) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'eq', 'gte', 'lte', 'neq'])
    builder[method] = vi.fn(() => builder);
  builder.then = vi.fn((resolve) => resolve({ count, error }));
  builders.push(builder);
  from.mockReturnValueOnce(builder);
}

describe('weekly sidebar summary', () => {
  beforeEach(() => {
    from.mockReset();
    builders.length = 0;
  });

  it('counts only the current member and date range without downloading cards', async () => {
    queueCount(1200);
    queueCount(900);
    await expect(
      fetchWeeklyTaskSummary(
        'workspace-a',
        'user-a',
        '2026-09-21',
        '2026-09-27',
      ),
    ).resolves.toEqual({ total: 1200, completed: 900, percentage: 75 });
    for (const builder of builders) {
      expect(builder.select).toHaveBeenCalledWith('id', {
        count: 'exact',
        head: true,
      });
      expect(builder.eq).toHaveBeenCalledWith('workspace_id', 'workspace-a');
      expect(builder.eq).toHaveBeenCalledWith('primary_assignee_id', 'user-a');
      expect(builder.gte).toHaveBeenCalledWith('due_date', '2026-09-21');
      expect(builder.lte).toHaveBeenCalledWith('due_date', '2026-09-27');
    }
    expect(builders[0].neq).toHaveBeenCalledWith(
      'status_category',
      'cancelled',
    );
    expect(builders[1].eq).toHaveBeenCalledWith('status_category', 'done');
  });

  it('returns zero for an empty week and propagates authorization/network failures', async () => {
    queueCount(0);
    queueCount(0);
    await expect(
      fetchWeeklyTaskSummary('w', 'u', '2026-09-21', '2026-09-27'),
    ).resolves.toEqual({ total: 0, completed: 0, percentage: 0 });
    queueCount(null, new Error('unavailable'));
    queueCount(0);
    await expect(
      fetchWeeklyTaskSummary('w', 'u', '2026-09-21', '2026-09-27'),
    ).rejects.toThrow('unavailable');
  });
});
