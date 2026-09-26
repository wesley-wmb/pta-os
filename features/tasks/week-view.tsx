'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GripVertical } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { QueryError } from '@/components/system/query-state';
import type { WorkspaceRole } from '@/features/workspace/types';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

import { priorityLabels, statusTone } from './formatters';
import {
  calendarWeekKeys,
  currentDateInTimeZone,
  dateFromKey,
} from './date-utils';
import { canEditTaskOverview } from './permissions';
import { taskKeys, useTasks } from './queries';
import type { TaskOverview } from './types';

type WeekViewProps = {
  workspaceId: string;
  role: WorkspaceRole;
  currentUserId: string;
  timezone: string;
};

export function WeekView({
  workspaceId,
  role,
  currentUserId,
  timezone,
}: WeekViewProps) {
  const query = useTasks(workspaceId);
  const queryClient = useQueryClient();
  const [announcement, setAnnouncement] = useState('');
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const dayKeys = useMemo(() => calendarWeekKeys(timezone), [timezone]);
  const today = currentDateInTimeZone(timezone);
  const tasks = query.data ?? [];

  async function moveTask(event: DragEndEvent) {
    const task = tasks.find((item) => item.id === event.active.id);
    const targetDate = event.over?.id;
    if (
      !task ||
      typeof targetDate !== 'string' ||
      task.due_date === targetDate ||
      pendingTaskIds.has(task.id) ||
      !canEditTaskOverview(role, currentUserId, task)
    )
      return;

    const previousTask = queryClient
      .getQueryData<TaskOverview[]>(taskKeys.all(workspaceId))
      ?.find((item) => item.id === task.id);
    const position =
      tasks
        .filter((item) => item.due_date === targetDate && item.id !== task.id)
        .reduce((highest, item) => Math.max(highest, item.week_position), 0) +
      1000;
    setPendingTaskIds((ids) => new Set(ids).add(task.id));
    queryClient.setQueryData<TaskOverview[]>(
      taskKeys.all(workspaceId),
      (items) =>
        items?.map((item) =>
          item.id === task.id
            ? {
                ...item,
                due_date: targetDate,
                week_lane: 'scheduled',
                week_position: position,
              }
            : item,
        ),
    );
    setAnnouncement(
      `${task.title} movida para ${formatDateForSpeech(targetDate)}.`,
    );
    const { error } = await createClient().rpc('move_task_in_week', {
      p_task_id: task.id,
      p_week_lane: 'scheduled',
      p_due_date: targetDate,
      p_position: position,
      p_expected_version: task.version,
    });

    if (error) {
      if (previousTask)
        queryClient.setQueryData<TaskOverview[]>(
          taskKeys.all(workspaceId),
          (items) =>
            items?.map((item) => (item.id === task.id ? previousTask : item)),
        );
      setAnnouncement(
        `Não foi possível mover ${task.title}. A posição anterior foi restaurada.`,
      );
      toast.error(
        error.message.includes('PTA_VERSION_CONFLICT')
          ? 'Esta tarefa possui uma versão mais recente.'
          : 'Não foi possível mover. A posição anterior foi restaurada.',
      );
    }
    await queryClient.invalidateQueries({
      queryKey: taskKeys.all(workspaceId),
    });
    setPendingTaskIds((ids) => {
      const next = new Set(ids);
      next.delete(task.id);
      return next;
    });
  }

  if (query.isPending) return <WeekSkeleton />;
  if (query.isError) return <QueryError onRetry={() => void query.refetch()} />;

  const weekTasks = tasks.filter((task) =>
    dayKeys.includes(task.due_date ?? ''),
  );

  if (weekTasks.length === 0) {
    return (
      <div className="mx-auto max-w-[1500px] px-5 pb-12 sm:px-8">
        <div className="border-y px-1 py-12">
          <h2 className="text-lg font-semibold leading-6">
            Sem tarefas com prazo nesta semana
          </h2>
          <p className="mt-2 text-[15px] leading-[23px] text-muted-foreground">
            Defina um prazo para incluir uma tarefa aqui.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="sr-only" aria-live="assertive">
        {announcement}
      </p>
      <DndContext sensors={sensors} onDragEnd={(event) => void moveTask(event)}>
        <div className="pta-scrollbar mx-auto hidden max-w-[1500px] overflow-x-auto px-5 pb-12 sm:px-8 xl:block">
          <div className="grid min-w-[1220px] grid-cols-7 gap-3">
            {dayKeys.map((dateKey) => (
              <DayColumn
                key={dateKey}
                dateKey={dateKey}
                today={today}
                tasks={weekTasks.filter((task) => task.due_date === dateKey)}
                role={role}
                currentUserId={currentUserId}
                pendingTaskIds={pendingTaskIds}
              />
            ))}
          </div>
        </div>
      </DndContext>

      <div className="mx-auto max-w-[1500px] space-y-3 px-5 pb-12 sm:px-8 xl:hidden">
        {dayKeys.map((dateKey) => {
          const day = dateFromKey(dateKey);
          const dayTasks = weekTasks.filter(
            (task) => task.due_date === dateKey,
          );
          if (!dayTasks.length) return null;
          return (
            <section key={dateKey} className="pta-panel overflow-hidden">
              <h2 className="border-b bg-muted/60 px-4 py-3 text-sm font-semibold capitalize">
                {format(day, "EEEE, d 'de' MMM", { locale: ptBR })}{' '}
                <span className="font-normal text-muted-foreground">
                  · {dayTasks.length}
                </span>
              </h2>
              <ul className="divide-y px-4">
                {dayTasks.map((task) => (
                  <li key={task.id}>
                    <WeekTaskLink task={task} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

type DayColumnProps = {
  dateKey: string;
  today: string;
  tasks: TaskOverview[];
  role: WorkspaceRole;
  currentUserId: string;
  pendingTaskIds: Set<string>;
};

function DayColumn({
  dateKey,
  today,
  tasks,
  role,
  currentUserId,
  pendingTaskIds,
}: DayColumnProps) {
  const date = dateFromKey(dateKey);
  const { setNodeRef, isOver } = useDroppable({ id: dateKey });
  const isToday = dateKey === today;
  return (
    <section
      ref={setNodeRef}
      className={cn(
        'min-h-[540px] rounded-lg border bg-muted/55 p-2 transition-colors',
        isToday &&
          'border-interactive-border bg-interactive ring-1 ring-primary/45',
        isOver && 'bg-accent/55',
      )}
      aria-labelledby={`day-${dateKey}`}
    >
      <header className="sticky top-0 z-10 mb-2 flex items-start justify-between rounded-md bg-muted/95 px-2 py-2 backdrop-blur">
        <div>
          <h2
            id={`day-${dateKey}`}
            className="text-xs font-semibold capitalize"
          >
            {format(date, 'EEEE', { locale: ptBR })}
          </h2>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {format(date, 'd MMM', { locale: ptBR })}
          </span>
        </div>
        <span className="grid size-6 place-items-center rounded-md bg-card text-[11px] font-semibold text-muted-foreground">
          {tasks.length}
        </span>
      </header>
      <div className="space-y-2">
        {[...tasks]
          .sort((a, b) => a.week_position - b.week_position)
          .map((task) => (
            <DraggableTask
              key={task.id}
              task={task}
              canEdit={canEditTaskOverview(role, currentUserId, task)}
              pending={pendingTaskIds.has(task.id)}
            />
          ))}
        {!tasks.length ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            Sem tarefas para este dia.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function DraggableTask({
  task,
  canEdit,
  pending,
}: {
  task: TaskOverview;
  canEdit: boolean;
  pending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      data: { task },
      disabled: !canEdit || pending,
    });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        'group rounded-md border bg-card p-3 transition-[border-color,background-color] hover:border-foreground/20 hover:bg-muted/20',
        isDragging && 'z-50 opacity-70 shadow-xl',
      )}
    >
      <div className="flex items-start gap-2">
        <Link
          href={`/tarefa/${task.id}`}
          scroll={false}
          className="min-w-0 flex-1 rounded-sm"
        >
          <h3 className="line-clamp-2 text-sm font-medium leading-5">
            {task.title}
          </h3>
        </Link>
        {canEdit ? (
          <button
            type="button"
            disabled={pending}
            className="-mr-1 grid size-8 shrink-0 touch-none place-items-center rounded-md text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 focus:opacity-100 disabled:cursor-wait disabled:opacity-40"
            aria-label={`Mover ${task.title}`}
            {...listeners}
            {...attributes}
          >
            <GripVertical aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-2.5 text-[11px] text-muted-foreground">
        <Badge
          variant="secondary"
          className={cn(
            'border-0 px-1.5 py-0 font-normal',
            statusTone(task.status_category),
          )}
        >
          {task.status_name}
        </Badge>
        <span>{priorityLabels[task.priority]}</span>
        {task.due_time ? <span>{task.due_time.slice(0, 5)}</span> : null}
      </div>
    </article>
  );
}

function WeekTaskLink({ task }: { task: TaskOverview }) {
  return (
    <Link href={`/tarefa/${task.id}`} scroll={false} className="block py-4">
      <p className="text-sm font-medium">{task.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {task.status_name} · {task.primary_assignee_name ?? 'Sem responsável'}
      </p>
    </Link>
  );
}

function WeekSkeleton() {
  return (
    <div
      className="mx-auto grid max-w-[1500px] grid-cols-1 gap-3 px-5 pb-12 sm:px-8 xl:grid-cols-7"
      aria-busy="true"
      aria-label="Carregando semana"
    >
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index}>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="mt-3 h-28 w-full" />
          <Skeleton className="mt-2 h-24 w-full" />
        </div>
      ))}
    </div>
  );
}

function formatDateForSpeech(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return format(new Date(year, month - 1, day), "EEEE, d 'de' MMMM", {
    locale: ptBR,
  });
}
