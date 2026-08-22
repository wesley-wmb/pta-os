'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { QueryError } from '@/components/system/query-state';
import type { WorkspaceRole } from '@/features/workspace/types';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

import { formatDueDate, isClosed } from './formatters';
import { currentDateInTimeZone } from './date-utils';
import { canEditTaskOverview } from './permissions';
import { taskKeys, useTasks } from './queries';
import type { TaskOverview, TaskStatus } from './types';
import { useQueryClient } from '@tanstack/react-query';

type HomeViewProps = {
  workspaceId: string;
  statuses: TaskStatus[];
  role: WorkspaceRole;
  currentUserId: string;
  timezone: string;
};

export function HomeView({
  workspaceId,
  statuses,
  role,
  currentUserId,
  timezone,
}: HomeViewProps) {
  const query = useTasks(workspaceId);
  const today = currentDateInTimeZone(timezone);
  const sections = useMemo(() => {
    const open = (query.data ?? []).filter(
      (task) => !isClosed(task.status_category),
    );
    return {
      today: open.filter((task) => task.due_date === today),
      overdue: open.filter((task) =>
        Boolean(task.due_date && task.due_date < today),
      ),
      blocked: open.filter((task) => task.status_category === 'blocked').length,
    };
  }, [query.data, today]);

  if (query.isPending) return <HomeSkeleton />;
  if (query.isError) return <QueryError onRetry={() => void query.refetch()} />;

  return (
    <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-10">
      <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-b pb-5 text-sm text-muted-foreground">
        <span>
          <strong className="font-semibold text-foreground">
            {sections.today.length}
          </strong>{' '}
          para hoje
        </span>
        <span
          aria-hidden="true"
          className="hidden h-4 w-px bg-border sm:block"
        />
        <span>
          <strong className="font-semibold text-destructive">
            {sections.overdue.length}
          </strong>{' '}
          atrasadas
        </span>
        <span
          aria-hidden="true"
          className="hidden h-4 w-px bg-border sm:block"
        />
        <span>
          <strong className="font-semibold text-foreground">
            {sections.blocked}
          </strong>{' '}
          bloqueadas
        </span>
      </div>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.8fr)]">
        <TaskSection
          id="today-section"
          title="Para hoje"
          tasks={sections.today}
          empty="Nada previsto para hoje."
          statuses={statuses}
          role={role}
          currentUserId={currentUserId}
        />
        <TaskSection
          id="overdue-section"
          title="Atrasadas"
          tasks={sections.overdue}
          empty="Nenhuma demanda atrasada."
          statuses={statuses}
          role={role}
          currentUserId={currentUserId}
          overdue
        />
      </div>
    </div>
  );
}

type TaskSectionProps = {
  id: string;
  title: string;
  tasks: TaskOverview[];
  empty: string;
  statuses: TaskStatus[];
  role: WorkspaceRole;
  currentUserId: string;
  overdue?: boolean;
};

function TaskSection({
  id,
  title,
  tasks,
  empty,
  statuses,
  role,
  currentUserId,
  overdue = false,
}: TaskSectionProps) {
  return (
    <section aria-labelledby={id}>
      <div className="mb-3 flex items-center justify-between">
        <h2 id={id} className="text-lg font-semibold tracking-[-0.02em]">
          {title}
        </h2>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      {tasks.length ? (
        <ul className="border-t">
          {tasks.map((task) => (
            <HomeTaskRow
              key={task.id}
              task={task}
              statuses={statuses}
              overdue={overdue}
              canEdit={canEditTaskOverview(role, currentUserId, task)}
            />
          ))}
        </ul>
      ) : (
        <div className="border-t py-9 text-sm text-muted-foreground">
          {empty}
        </div>
      )}
    </section>
  );
}

function HomeTaskRow({
  task,
  statuses,
  overdue,
  canEdit,
}: {
  task: TaskOverview;
  statuses: TaskStatus[];
  overdue: boolean;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const doneStatus = statuses.find((status) => status.category === 'done');

  async function completeTask() {
    if (!doneStatus || saving) return;
    setSaving(true);
    const previousTask = queryClient
      .getQueryData<TaskOverview[]>(taskKeys.all(task.workspace_id))
      ?.find((item) => item.id === task.id);
    queryClient.setQueryData<TaskOverview[]>(
      taskKeys.all(task.workspace_id),
      (items) =>
        items?.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status_id: doneStatus.id,
                status_name: doneStatus.name,
                status_category: 'done',
              }
            : item,
        ),
    );
    const { error } = await createClient().rpc('update_task', {
      p_task_id: task.id,
      p_expected_version: task.version,
      p_patch: { status_id: doneStatus.id },
    });
    if (error) {
      if (previousTask) {
        queryClient.setQueryData<TaskOverview[]>(
          taskKeys.all(task.workspace_id),
          (items) =>
            items?.map((item) => (item.id === task.id ? previousTask : item)),
        );
      }
      toast.error(
        error.message.includes('PTA_VERSION_CONFLICT')
          ? 'Esta demanda foi atualizada por outra pessoa.'
          : 'Não foi possível salvar. O valor anterior foi restaurado.',
      );
    } else if (!error) {
      toast.success('Demanda concluída.');
    }
    await queryClient.invalidateQueries({
      queryKey: taskKeys.all(task.workspace_id),
    });
    setSaving(false);
  }

  return (
    <li className="group flex min-h-12 items-center gap-3 border-b py-2">
      {canEdit ? (
        <Checkbox
          checked={isClosed(task.status_category)}
          onCheckedChange={() => void completeTask()}
          disabled={!doneStatus || saving}
          aria-label={`Concluir ${task.title}`}
        />
      ) : (
        <span
          className="size-4 shrink-0 rounded-full border"
          aria-hidden="true"
        />
      )}
      <Link
        href={`/tarefa/${task.id}`}
        scroll={false}
        className="min-w-0 flex-1 rounded-sm"
      >
        <span className="block truncate text-sm font-medium">{task.title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {task.task_key} · {task.primary_assignee_name ?? 'Sem responsável'}
        </span>
      </Link>
      <span
        className={cn(
          'shrink-0 text-xs text-muted-foreground',
          overdue && 'font-medium text-destructive',
        )}
      >
        {formatDueDate(task.due_date)}
        {task.due_time ? `, ${task.due_time.slice(0, 5)}` : ''}
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      />
    </li>
  );
}

function HomeSkeleton() {
  return (
    <div
      className="mx-auto max-w-6xl px-5 py-10"
      aria-busy="true"
      aria-label="Carregando resumo"
    >
      <Skeleton className="h-5 w-72" />
      <div className="mt-10 grid gap-12 lg:grid-cols-2">
        {[0, 1].map((column) => (
          <div key={column}>
            <Skeleton className="h-5 w-28" />
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-12 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
