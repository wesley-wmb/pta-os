import { describe, expect, it } from 'vitest';

import {
  countActiveTaskFilters,
  EMPTY_ADVANCED_TASK_FILTERS,
  filterPipelineTasks,
  isTaskOverdue,
  pipelineScopeCounts,
  sanitizeSpreadsheetCell,
  uniqueTaskOptions,
} from './task-pipeline-model';
import type { TaskOverview } from './types';

const currentUserId = '00000000-0000-4000-8000-000000000001';
const otherUserId = '00000000-0000-4000-8000-000000000002';
const nowIso = '2026-08-24T12:00:00.000Z';

const tasks = [
  task({
    id: '00000000-0000-4000-8000-000000000101',
    title: 'Revisar página do evento',
    primary_assignee_id: currentUserId,
    primary_assignee_name: 'Wesley',
    due_at: '2026-08-23T12:00:00.000Z',
    type_id: '00000000-0000-4000-8000-000000000201',
    type_name: 'Página',
    product_id: '00000000-0000-4000-8000-000000000301',
    product_name: 'Intensivo',
  }),
  task({
    id: '00000000-0000-4000-8000-000000000102',
    task_key: 'PTA-000002',
    title: 'Aprovar criativos',
    primary_assignee_id: otherUserId,
    primary_assignee_name: 'Rafael',
    status_id: '00000000-0000-4000-8000-000000000402',
    status_name: 'Em revisão',
    status_category: 'review',
    due_at: '2026-08-25T12:00:00.000Z',
    priority: 'high',
  }),
];

describe('task pipeline model', () => {
  it('keeps search and scope filters consistent', () => {
    expect(
      filterPipelineTasks(tasks, {
        scope: 'mine',
        search: 'intensivo',
        currentUserId,
        nowIso,
        filters: EMPTY_ADVANCED_TASK_FILTERS,
      }).map((item) => item.task_key),
    ).toEqual(['PTA-000001']);
  });

  it('applies advanced filters without treating missing context as a match', () => {
    expect(
      filterPipelineTasks(tasks, {
        scope: 'all',
        search: '',
        currentUserId,
        nowIso,
        filters: {
          ...EMPTY_ADVANCED_TASK_FILTERS,
          priority: 'high',
          statusId: '00000000-0000-4000-8000-000000000402',
        },
      }).map((item) => item.task_key),
    ).toEqual(['PTA-000002']);
  });

  it('counts active filters and scopes from real tasks', () => {
    expect(
      countActiveTaskFilters({
        ...EMPTY_ADVANCED_TASK_FILTERS,
        priority: 'high',
        assigneeId: currentUserId,
      }),
    ).toBe(2);
    expect(pipelineScopeCounts(tasks, currentUserId, nowIso)).toEqual({
      all: 2,
      mine: 1,
      overdue: 1,
      blocked: 0,
      review: 1,
      done: 0,
    });
  });

  it('does not mark closed tasks as overdue', () => {
    expect(isTaskOverdue(tasks[0], nowIso)).toBe(true);
    expect(
      isTaskOverdue(
        task({
          status_category: 'done',
          due_at: '2026-08-20T12:00:00.000Z',
        }),
        nowIso,
      ),
    ).toBe(false);
  });

  it('compares equivalent timezone offsets as instants', () => {
    expect(
      isTaskOverdue(
        task({ due_at: '2026-08-24T09:00:00-03:00' }),
        '2026-08-24T12:00:00.000Z',
      ),
    ).toBe(false);
  });

  it('neutralizes spreadsheet formulas before CSV export', () => {
    expect(sanitizeSpreadsheetCell('=HYPERLINK("https://example.com")')).toBe(
      '\'=HYPERLINK("https://example.com")',
    );
    expect(sanitizeSpreadsheetCell('Demanda normal')).toBe('Demanda normal');
  });

  it('derives sorted context options without duplicates', () => {
    expect(uniqueTaskOptions(tasks, 'product_id', 'product_name')).toEqual([
      {
        id: '00000000-0000-4000-8000-000000000301',
        name: 'Intensivo',
      },
    ]);
  });
});

function task(overrides: Partial<TaskOverview> = {}): TaskOverview {
  return {
    id: '00000000-0000-4000-8000-000000000101',
    workspace_id: '00000000-0000-4000-8000-000000000999',
    task_key: 'PTA-000001',
    task_number: 1,
    title: 'Demanda',
    priority: 'medium',
    status_id: '00000000-0000-4000-8000-000000000401',
    status_name: 'A fazer',
    status_category: 'todo',
    status_color: '#999999',
    due_date: '2026-08-23',
    due_at: null,
    due_time: null,
    due_is_date_only: true,
    week_position: 1000,
    board_position: 1000,
    week_lane: 'scheduled',
    version: 1,
    created_by: currentUserId,
    created_at: '2026-08-20T12:00:00.000Z',
    updated_at: '2026-08-20T12:00:00.000Z',
    primary_assignee_id: null,
    primary_assignee_name: null,
    type_id: null,
    type_name: null,
    product_id: null,
    product_name: null,
    event_id: null,
    event_name: null,
    ...overrides,
  };
}
