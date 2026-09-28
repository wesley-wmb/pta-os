'use client';

import { useQuery } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';

import { calendarWeekKeys } from './date-utils';
import { useTaskRealtime } from './queries';

export type WeeklyTaskSummary = {
  completed: number;
  total: number;
  percentage: number;
};

export const weeklySummaryKeys = {
  workspace: (workspaceId: string) =>
    ['weekly-task-summary', workspaceId] as const,
  period: (workspaceId: string, userId: string, start: string, end: string) =>
    ['weekly-task-summary', workspaceId, userId, start, end] as const,
};

export async function fetchWeeklyTaskSummary(
  workspaceId: string,
  userId: string,
  start: string,
  end: string,
): Promise<WeeklyTaskSummary> {
  const supabase = createClient();
  // HEAD counts avoid downloading card data and the API's row limit.
  const countQuery = () =>
    supabase
      .from('v_task_overview')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('primary_assignee_id', userId)
      .gte('due_date', start)
      .lte('due_date', end);
  const [totalResult, completedResult] = await Promise.all([
    countQuery().neq('status_category', 'cancelled'),
    countQuery().eq('status_category', 'done'),
  ]);
  if (totalResult.error) throw totalResult.error;
  if (completedResult.error) throw completedResult.error;
  const total = totalResult.count ?? 0;
  const completed = completedResult.count ?? 0;
  return {
    total,
    completed,
    percentage: total ? Math.round((completed / total) * 100) : 0,
  };
}

export function useWeeklyTaskSummary(
  workspaceId: string,
  userId: string,
  timezone: string,
) {
  useTaskRealtime(workspaceId);
  const dates = calendarWeekKeys(timezone);
  const start = dates[0];
  const end = dates[6];
  return useQuery({
    queryKey: weeklySummaryKeys.period(workspaceId, userId, start, end),
    queryFn: () => fetchWeeklyTaskSummary(workspaceId, userId, start, end),
  });
}
