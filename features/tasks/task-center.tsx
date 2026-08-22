'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyTasks, QueryError } from '@/components/system/query-state';
import { cn } from '@/lib/utils';

import {
  formatDueDate,
  isClosed,
  priorityLabels,
  statusTone,
} from './formatters';
import { calendarWeekKeys, currentDateInTimeZone } from './date-utils';
import { useTasks } from './queries';
import type { TaskOverview } from './types';

type ViewFilter = 'all' | 'mine' | 'today' | 'week' | 'overdue' | 'blocked';

const views: Array<{ id: ViewFilter; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'mine', label: 'Minhas' },
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Esta semana' },
  { id: 'overdue', label: 'Atrasadas' },
  { id: 'blocked', label: 'Bloqueadas' },
];

export function TaskCenter({
  workspaceId,
  currentUserId,
  timezone,
}: {
  workspaceId: string;
  currentUserId: string;
  timezone: string;
}) {
  const query = useTasks(workspaceId);
  const [view, setView] = useState<ViewFilter>('all');
  const [search, setSearch] = useState('');
  const tasks = useMemo(
    () => filterTasks(query.data ?? [], view, search, currentUserId, timezone),
    [currentUserId, query.data, search, timezone, view],
  );
  const filtered = view !== 'all' || search.trim().length > 0;

  return (
    <section aria-labelledby="task-list-title">
      <h2 id="task-list-title" className="sr-only">
        Lista de demandas
      </h2>
      <div className="sticky top-12 z-20 border-b bg-background/95 backdrop-blur">
        <div
          className="flex gap-1 overflow-x-auto px-5 pt-3 sm:px-8"
          aria-label="Visões de demandas"
        >
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={view === item.id}
              onClick={() => setView(item.id)}
              className={cn(
                'min-h-11 shrink-0 border-b-2 border-transparent px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:min-h-0',
                view === item.id &&
                  'border-foreground font-medium text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-5 py-3 sm:px-8">
          <div className="relative max-w-md flex-1">
            <Search
              aria-hidden="true"
              className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por título ou número…"
              className="w-full pl-8"
              aria-label="Buscar demandas"
            />
          </div>
        </div>
      </div>

      {query.isPending ? <TaskListSkeleton /> : null}
      {query.isError ? (
        <QueryError onRetry={() => void query.refetch()} />
      ) : null}
      {query.isSuccess && tasks.length === 0 ? (
        <EmptyTasks
          filtered={filtered}
          onClear={() => {
            setView('all');
            setSearch('');
          }}
        />
      ) : null}
      {query.isSuccess && tasks.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="text-left text-xs font-medium text-muted-foreground">
                <tr className="border-b">
                  <th className="w-[42%] px-8 py-2.5 font-medium">Demanda</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Responsável</th>
                  <th className="px-3 py-2.5 font-medium">Prazo</th>
                  <th className="px-8 py-2.5 font-medium">Prioridade</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} timezone={timezone} />
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y md:hidden">
            {tasks.map((task) => (
              <TaskMobileRow key={task.id} task={task} timezone={timezone} />
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

function TaskRow({ task, timezone }: { task: TaskOverview; timezone: string }) {
  return (
    <tr className="h-11 border-b transition-colors hover:bg-muted/55">
      <td className="px-8 py-1.5">
        <Link
          href={`/tarefa/${task.id}`}
          scroll={false}
          className="group flex min-w-0 items-center gap-3 rounded-sm focus-visible:ring-offset-0"
        >
          <span className="w-20 shrink-0 font-mono text-[11px] text-muted-foreground">
            {task.task_key}
          </span>
          <span
            className={cn(
              'truncate font-medium decoration-border underline-offset-4 group-hover:underline',
              isClosed(task.status_category) &&
                'text-muted-foreground line-through',
            )}
          >
            {task.title}
          </span>
        </Link>
      </td>
      <td className="px-3 py-1.5">
        <StatusPill task={task} />
      </td>
      <td className="px-3 py-1.5 text-muted-foreground">
        {task.primary_assignee_name ?? 'Sem responsável'}
      </td>
      <td
        className={cn(
          'px-3 py-1.5 text-muted-foreground',
          isOverdue(task, timezone) && 'font-medium text-destructive',
        )}
      >
        {formatDueDate(task.due_date)}
      </td>
      <td className="px-8 py-1.5 text-muted-foreground">
        {priorityLabels[task.priority]}
      </td>
    </tr>
  );
}

function TaskMobileRow({
  task,
  timezone,
}: {
  task: TaskOverview;
  timezone: string;
}) {
  return (
    <li>
      <Link
        href={`/tarefa/${task.id}`}
        scroll={false}
        className="block px-5 py-4 transition-colors hover:bg-muted/60"
      >
        <span className="font-mono text-[11px] text-muted-foreground">
          {task.task_key}
        </span>
        <p className="mt-1 font-medium leading-5">{task.title}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <StatusPill task={task} />
          <span>{priorityLabels[task.priority]}</span>
          <span>{task.primary_assignee_name ?? 'Sem responsável'}</span>
          <span
            className={cn(
              isOverdue(task, timezone) && 'font-medium text-destructive',
            )}
          >
            {formatDueDate(task.due_date)}
          </span>
        </div>
      </Link>
    </li>
  );
}

function StatusPill({ task }: { task: TaskOverview }) {
  return (
    <Badge
      variant="secondary"
      className={cn('border-0 font-normal', statusTone(task.status_category))}
    >
      {task.status_name}
    </Badge>
  );
}

function TaskListSkeleton() {
  return (
    <div
      className="px-5 py-5 sm:px-8"
      aria-busy="true"
      aria-label="Carregando demandas"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex h-11 items-center gap-4 border-b">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="hidden h-3 w-28 sm:block" />
        </div>
      ))}
    </div>
  );
}

function filterTasks(
  tasks: TaskOverview[],
  view: ViewFilter,
  search: string,
  currentUserId: string,
  timezone: string,
) {
  const today = currentDateInTimeZone(timezone);
  const week = calendarWeekKeys(timezone);
  const weekStart = week[0];
  const weekEnd = week[6];
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');

  return tasks.filter((task) => {
    if (
      normalizedSearch &&
      !`${task.task_key} ${task.title}`
        .toLocaleLowerCase('pt-BR')
        .includes(normalizedSearch)
    )
      return false;
    if (view === 'mine' && task.primary_assignee_id !== currentUserId)
      return false;
    if (view === 'today' && task.due_date !== today) return false;
    if (
      view === 'week' &&
      (!task.due_date || task.due_date < weekStart || task.due_date > weekEnd)
    )
      return false;
    if (
      view === 'overdue' &&
      (!task.due_date ||
        task.due_date >= today ||
        isClosed(task.status_category))
    )
      return false;
    if (view === 'blocked' && task.status_category !== 'blocked') return false;
    return true;
  });
}

function isOverdue(
  task: TaskOverview,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  return Boolean(
    task.due_date &&
    task.due_date < currentDateInTimeZone(timezone) &&
    !isClosed(task.status_category),
  );
}
