'use client';

import { ChevronRight, Search } from 'lucide-react';
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

const EMPTY_TASKS: TaskOverview[] = [];

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
  const allTasks = query.data ?? EMPTY_TASKS;
  const tasks = useMemo(
    () => filterTasks(allTasks, view, search, currentUserId, timezone),
    [allTasks, currentUserId, search, timezone, view],
  );
  const summary = useMemo(() => {
    return {
      open: allTasks.filter((task) => !isClosed(task.status_category)).length,
      inProgress: allTasks.filter(
        (task) => task.status_category === 'in_progress',
      ).length,
      review: allTasks.filter((task) => task.status_category === 'review')
        .length,
      overdue: allTasks.filter(isOverdue).length,
    };
  }, [allTasks]);
  const filtered = view !== 'all' || search.trim().length > 0;

  return (
    <section
      className="mx-auto w-full max-w-[1500px] px-5 pb-12 sm:px-8"
      aria-labelledby="task-list-title"
    >
      <h2 id="task-list-title" className="sr-only">
        Lista de tarefas
      </h2>
      {query.isSuccess && allTasks.length ? (
        <div className="mb-5 grid grid-cols-2 border-y sm:grid-cols-4">
          <SummaryMetric label="Abertas" value={summary.open} />
          <SummaryMetric label="Em andamento" value={summary.inProgress} />
          <SummaryMetric label="Em revisão" value={summary.review} />
          <SummaryMetric
            label="Atrasadas"
            value={summary.overdue}
            danger={summary.overdue > 0}
          />
        </div>
      ) : null}
      <div className="sticky top-0 z-20 overflow-hidden border-y bg-card/95 backdrop-blur">
        <div
          className="pta-tabs-scroll flex gap-1 overflow-x-auto px-3 pt-2 sm:px-4"
          role="group"
          aria-label="Visões de tarefas"
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
        <span
          className="pointer-events-none absolute right-0 top-2 flex h-11 w-10 items-center justify-end bg-gradient-to-r from-transparent to-card pr-1 text-muted-foreground sm:hidden"
          aria-hidden="true"
        >
          <ChevronRight className="size-4" />
        </span>
        <div className="flex items-center gap-2 border-t px-3 py-3 sm:px-4">
          <div className="relative max-w-sm flex-1">
            <Search
              aria-hidden="true"
              className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por título ou número…"
              className="w-full bg-muted/55 pl-8 shadow-none"
              aria-label="Buscar tarefas"
            />
          </div>
        </div>
      </div>

      {query.isPending ? <TaskListSkeleton /> : null}
      {query.isError ? (
        <div className="mt-3 border-y">
          <QueryError onRetry={() => void query.refetch()} />
        </div>
      ) : null}
      {query.isSuccess && tasks.length === 0 ? (
        <div className="mt-3 border-y">
          <EmptyTasks
            filtered={filtered}
            onClear={() => {
              setView('all');
              setSearch('');
            }}
          />
        </div>
      ) : null}
      {query.isSuccess && tasks.length > 0 ? (
        <div className="pta-panel mt-3 overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-muted/65 text-left text-xs font-medium text-muted-foreground">
                <tr className="border-b">
                  <th className="w-[42%] px-8 py-2.5 font-medium">Tarefa</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Responsável</th>
                  <th className="px-3 py-2.5 font-medium">Prazo</th>
                  <th className="px-8 py-2.5 font-medium">Prioridade</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y md:hidden">
            {tasks.map((task) => (
              <TaskMobileRow key={task.id} task={task} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function SummaryMetric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="border-l px-4 py-4 first:border-l-0 max-sm:odd:border-l-0 max-sm:[&:nth-child(n+3)]:border-t sm:px-5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <strong
        className={cn(
          'mt-1 block text-2xl font-semibold tracking-[-0.025em]',
          danger && 'text-destructive',
        )}
      >
        {value}
      </strong>
    </div>
  );
}

function TaskRow({ task }: { task: TaskOverview }) {
  return (
    <tr className="h-14 border-b transition-colors last:border-0 hover:bg-muted/55">
      <td className="px-8 py-1.5">
        <Link
          href={`/tarefa/${task.id}`}
          scroll={false}
          className="group flex min-w-0 items-center gap-3 rounded-sm focus-visible:ring-offset-0"
        >
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
          isOverdue(task) && 'font-medium text-destructive',
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

function TaskMobileRow({ task }: { task: TaskOverview }) {
  return (
    <li>
      <Link
        href={`/tarefa/${task.id}`}
        scroll={false}
        className="block px-5 py-4 transition-colors hover:bg-muted/60"
      >
        <p className="font-medium leading-5">{task.title}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <StatusPill task={task} />
          <span>{priorityLabels[task.priority]}</span>
          <span>{task.primary_assignee_name ?? 'Sem responsável'}</span>
          <span
            className={cn(isOverdue(task) && 'font-medium text-destructive')}
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
      className="pta-panel mt-3 px-5 py-5 sm:px-8"
      aria-busy="true"
      aria-label="Carregando tarefas"
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
    if (view === 'overdue' && !isOverdue(task)) return false;
    if (view === 'blocked' && task.status_category !== 'blocked') return false;
    return true;
  });
}

function isOverdue(task: TaskOverview) {
  return Boolean(
    task.due_at &&
    task.due_at < new Date().toISOString() &&
    !isClosed(task.status_category),
  );
}
