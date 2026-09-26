import type { TaskOverview, TaskPriority } from './types';

export type ScopeFilter =
  'all' | 'mine' | 'overdue' | 'blocked' | 'review' | 'done';

export type AdvancedTaskFilters = {
  assigneeId: string;
  statusId: string;
  priority: 'all' | TaskPriority;
  typeId: string;
  productId: string;
  eventId: string;
};

export const EMPTY_ADVANCED_TASK_FILTERS: AdvancedTaskFilters = {
  assigneeId: 'all',
  statusId: 'all',
  priority: 'all',
  typeId: 'all',
  productId: 'all',
  eventId: 'all',
};

export function filterPipelineTasks(
  tasks: TaskOverview[],
  {
    scope,
    search,
    currentUserId,
    nowIso,
    filters,
  }: {
    scope: ScopeFilter;
    search: string;
    currentUserId: string;
    nowIso: string;
    filters: AdvancedTaskFilters;
  },
) {
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');

  return tasks.filter((task) => {
    if (
      normalizedSearch &&
      ![
        task.task_key,
        task.title,
        task.primary_assignee_name,
        task.type_name,
        task.product_name,
        task.event_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(normalizedSearch)
    )
      return false;

    if (scope === 'mine' && task.primary_assignee_id !== currentUserId)
      return false;
    if (scope === 'overdue' && !isTaskOverdue(task, nowIso)) return false;
    if (scope === 'blocked' && task.status_category !== 'blocked') return false;
    if (scope === 'review' && task.status_category !== 'review') return false;
    if (scope === 'done' && task.status_category !== 'done') return false;

    if (
      filters.assigneeId !== 'all' &&
      (filters.assigneeId === 'unassigned'
        ? task.primary_assignee_id !== null
        : task.primary_assignee_id !== filters.assigneeId)
    )
      return false;
    if (filters.statusId !== 'all' && task.status_id !== filters.statusId)
      return false;
    if (filters.priority !== 'all' && task.priority !== filters.priority)
      return false;
    if (
      filters.typeId !== 'all' &&
      (filters.typeId === 'none'
        ? task.type_id !== null
        : task.type_id !== filters.typeId)
    )
      return false;
    if (
      filters.productId !== 'all' &&
      (filters.productId === 'none'
        ? task.product_id !== null
        : task.product_id !== filters.productId)
    )
      return false;
    if (
      filters.eventId !== 'all' &&
      (filters.eventId === 'none'
        ? task.event_id !== null
        : task.event_id !== filters.eventId)
    )
      return false;

    return true;
  });
}

export function countActiveTaskFilters(filters: AdvancedTaskFilters) {
  return Object.values(filters).filter((value) => value !== 'all').length;
}

export function pipelineScopeCounts(
  tasks: TaskOverview[],
  currentUserId: string,
  nowIso: string,
) {
  return {
    all: tasks.length,
    mine: tasks.filter((task) => task.primary_assignee_id === currentUserId)
      .length,
    overdue: tasks.filter((task) => isTaskOverdue(task, nowIso)).length,
    blocked: tasks.filter((task) => task.status_category === 'blocked').length,
    review: tasks.filter((task) => task.status_category === 'review').length,
    done: tasks.filter((task) => task.status_category === 'done').length,
  } satisfies Record<ScopeFilter, number>;
}

export function isTaskOverdue(task: TaskOverview, nowIso: string) {
  return Boolean(
    task.due_at &&
    Date.parse(task.due_at) < Date.parse(nowIso) &&
    task.status_category !== 'done' &&
    task.status_category !== 'cancelled',
  );
}

export function sanitizeSpreadsheetCell(value: string) {
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

export function uniqueTaskOptions(
  tasks: TaskOverview[],
  idKey: 'type_id' | 'product_id' | 'event_id',
  nameKey: 'type_name' | 'product_name' | 'event_name',
) {
  const options = new Map<string, string>();
  for (const task of tasks) {
    const id = task[idKey];
    const name = task[nameKey];
    if (id && name) options.set(id, name);
  }
  return [...options]
    .map(([id, name]) => ({ id, name }))
    .toSorted((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
