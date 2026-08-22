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
            ? { ...item, due_date: targetDate, week_position: position }
            : item,
        ),
    );
    setAnnouncement(
      `${task.task_key} movida para ${formatDateForSpeech(targetDate)}.`,
    );
    const { error } = await createClient().rpc('move_task_to_day', {
      p_task_id: task.id,
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
        `Não foi possível mover ${task.task_key}. A posição anterior foi restaurada.`,
      );
      toast.error(
        error.message.includes('PTA_VERSION_CONFLICT')
          ? 'Esta demanda possui uma versão mais recente.'
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
      <div className="px-5 py-20 text-center sm:px-8">
        <h2 className="text-base font-semibold">
          Nenhuma demanda prevista para esta semana.
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie uma demanda com prazo para começar a montar a semana.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="sr-only" aria-live="assertive">
        {announcement}
      </p>
      <DndContext sensors={sensors} onDragEnd={(event) => void moveTask(event)}>
        <div className="hidden overflow-x-auto p-5 sm:p-8 xl:block">
          <div className="grid min-w-[1050px] grid-cols-7 gap-3">
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

      <div className="divide-y xl:hidden">
        {dayKeys.map((dateKey) => {
          const day = dateFromKey(dateKey);
          const dayTasks = weekTasks.filter(
            (task) => task.due_date === dateKey,
          );
          if (!dayTasks.length) return null;
          return (
            <section key={dateKey} className="px-5 py-5 sm:px-8">
              <h2 className="text-sm font-semibold capitalize">
                {format(day, "EEEE, d 'de' MMM", { locale: ptBR })}
              </h2>
              <ul className="mt-3 divide-y border-y">
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
        'min-h-[520px] border-t-2 px-1 transition-colors',
        isToday ? 'border-pta-lime' : 'border-border',
        isOver && 'bg-accent/45',
      )}
      aria-labelledby={`day-${dateKey}`}
    >
      <header className="sticky top-[49px] z-10 -mx-1 mb-3 flex items-baseline justify-between border-b bg-background px-2 py-3">
        <h2 id={`day-${dateKey}`} className="text-sm font-semibold capitalize">
          {format(date, 'EEEE', { locale: ptBR })}
        </h2>
        <span className="text-xs text-muted-foreground">
          {format(date, 'd MMM', { locale: ptBR })} · {tasks.length}
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
          <p className="px-2 py-6 text-xs text-muted-foreground">
            Nenhuma demanda neste dia.
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
        'group rounded-md border bg-background p-3 transition-colors hover:border-foreground/20',
        isDragging && 'z-50 opacity-70 shadow-lg',
      )}
    >
      <div className="flex items-start gap-2">
        <Link
          href={`/tarefa/${task.id}`}
          scroll={false}
          className="min-w-0 flex-1 rounded-sm"
        >
          <span className="font-mono text-[10px] text-muted-foreground">
            {task.task_key}
          </span>
          <h3 className="mt-1 line-clamp-2 text-sm font-medium leading-5">
            {task.title}
          </h3>
        </Link>
        {canEdit ? (
          <button
            type="button"
            disabled={pending}
            className="-mr-1 grid size-8 shrink-0 touch-none place-items-center rounded-md text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 focus:opacity-100 disabled:cursor-wait disabled:opacity-40"
            aria-label={`Mover ${task.task_key}`}
            {...listeners}
            {...attributes}
          >
            <GripVertical aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
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
    <Link href={`/tarefa/${task.id}`} scroll={false} className="block py-3">
      <span className="font-mono text-[10px] text-muted-foreground">
        {task.task_key}
      </span>
      <p className="mt-1 text-sm font-medium">{task.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {task.status_name} · {task.primary_assignee_name ?? 'Sem responsável'}
      </p>
    </Link>
  );
}

function WeekSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-3 p-5 sm:p-8 xl:grid-cols-7"
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
