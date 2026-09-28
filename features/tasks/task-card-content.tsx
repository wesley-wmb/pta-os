import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  Circle,
  CircleDashed,
  Clock3,
  Eye,
  Flag,
  ListChecks,
  MessageSquare,
  Minus,
  UserRound,
  XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { useTaskCardPreferences } from '@/features/settings/card-preferences-context';
import { cn } from '@/lib/utils';

import { formatDueDate, isClosed, priorityLabels } from './formatters';
import { isTaskOverdue } from './task-pipeline-model';
import type { TaskOverview } from './types';

const statusIcons = {
  backlog: CircleDashed,
  todo: Circle,
  in_progress: Clock3,
  review: Eye,
  blocked: AlertCircle,
  done: CheckCircle2,
  cancelled: XCircle,
};

const priorityStyles = {
  low: 'border-transparent bg-foreground/[0.045] text-muted-foreground',
  medium: 'border-border/60 bg-foreground/[0.035] text-muted-foreground',
  high: 'border-amber-400/40 bg-amber-100 text-amber-950 dark:bg-amber-400/20 dark:text-amber-200',
  urgent:
    'border-red-400/40 bg-red-100 text-red-800 dark:bg-red-400/20 dark:text-red-200',
};

const priorityIcons = {
  low: ArrowDown,
  medium: Minus,
  high: ArrowUp,
  urgent: Flag,
};

export type TaskCardContentProps = {
  task: TaskOverview;
  nowIso: string;
  today?: string;
  dragHandle?: ReactNode;
  simplified?: boolean;
};

/** Presentational content; the parent owns the detail link and drag behavior. */
export function TaskCardContent({
  task,
  nowIso,
  today,
  dragHandle,
  simplified = false,
}: TaskCardContentProps) {
  const preferences = useTaskCardPreferences();
  const { density, visibleFields } = preferences;
  const StatusIcon = statusIcons[task.status_category];
  const PriorityIcon = priorityIcons[task.priority];
  const overdue = isTaskOverdue(task, nowIso);
  const dueToday = Boolean(
    today && task.due_date === today && !isClosed(task.status_category),
  );
  const context = [
    { label: task.product_name, kind: 'Produto' },
    { label: task.event_name, kind: 'Projeto' },
    { label: task.type_name, kind: 'Tipo' },
  ].filter((item) => Boolean(item.label));
  const total = task.checklist_total;
  const completed = task.checklist_completed;
  const hasChecklist =
    typeof total === 'number' && total > 0 && typeof completed === 'number';
  const progress = hasChecklist
    ? Math.max(0, Math.min(100, Math.round((completed / total) * 100)))
    : 0;
  const assignee = task.primary_assignee_name?.trim() || null;
  const initials = assignee
    ?.split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('pt-BR');
  const showPriority = visibleFields.priority;
  const showContext = visibleFields.context && context.length > 0;
  const showDescription =
    visibleFields.description && Boolean(task.description_preview?.trim());
  const showStatus =
    visibleFields.status && (!simplified || task.status_category === 'blocked');
  const showChecklist = visibleFields.checklist && hasChecklist;
  const showComments =
    visibleFields.comments &&
    typeof task.comment_count === 'number' &&
    task.comment_count > 0;
  const showDueDate =
    visibleFields.dueDate && (!simplified || Boolean(task.due_date));
  const showAssignee =
    visibleFields.assignee && (!simplified || Boolean(assignee));
  const showSummaryRow =
    showStatus || (!simplified && (showChecklist || showComments));
  const showFooter =
    showDueDate ||
    showAssignee ||
    (simplified && (showChecklist || showComments));

  return (
    <div
      className={cn(
        'pointer-events-none relative z-10 flex min-w-0 flex-col',
        density === 'compact' && 'p-3',
        density === 'comfortable' && 'p-4',
        density === 'spacious' && 'p-5',
      )}
      data-card-density={density}
    >
      <div className="flex items-start justify-between gap-2">
        <h4
          className={cn(
            'min-w-0 flex-1 break-words font-semibold tracking-[-0.015em] text-foreground',
            density === 'compact' && 'line-clamp-2 text-sm leading-5',
            density === 'comfortable' && 'line-clamp-3 text-base leading-6',
            density === 'spacious' &&
              'line-clamp-3 text-[17px] leading-[1.55rem]',
          )}
          title={task.title}
        >
          {task.title}
        </h4>
        {dragHandle ? (
          <div className="pointer-events-auto relative z-20 -mr-2 -mt-1 shrink-0">
            {dragHandle}
          </div>
        ) : null}
      </div>

      {showPriority || showContext ? (
        <div
          className={cn(
            'flex min-w-0 flex-wrap items-center gap-1.5',
            density === 'compact' ? 'mt-2' : 'mt-2.5',
          )}
        >
          {showPriority ? (
            <span
              className={cn(
                'inline-flex min-h-6 shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold leading-4',
                priorityStyles[task.priority],
              )}
            >
              <PriorityIcon aria-hidden="true" className="size-3" />
              <span className="sr-only">Prioridade </span>
              {priorityLabels[task.priority]}
            </span>
          ) : null}
          {showContext ? (
            <div
              className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
              title={context
                .map(({ kind, label }) => `${kind}: ${label}`)
                .join(' / ')}
            >
              {context.map(({ label, kind }) => (
                <span
                  key={kind}
                  className={cn(
                    'inline-flex min-h-6 max-w-full items-center rounded-md border px-2 py-0.5 text-xs font-semibold leading-4',
                    kind === 'Projeto'
                      ? 'border-blue-400/30 bg-blue-100 text-blue-900 dark:bg-blue-400/20 dark:text-blue-200'
                      : kind === 'Tipo'
                        ? 'border-violet-400/30 bg-violet-100 text-violet-900 dark:bg-violet-400/20 dark:text-violet-200'
                        : 'border-teal-400/30 bg-teal-100 text-teal-900 dark:bg-teal-400/20 dark:text-teal-200',
                  )}
                >
                  <span className="sr-only">{kind}: </span>
                  <span className="max-w-32 truncate">{label}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {showDescription ? (
        <p
          className={cn(
            'break-words text-muted-foreground',
            density === 'compact' && 'mt-2 line-clamp-1 text-xs leading-4',
            density === 'comfortable' &&
              'mt-2.5 line-clamp-2 text-[13px] leading-5',
            density === 'spacious' &&
              'mt-3 line-clamp-3 text-sm leading-[1.35rem]',
          )}
          title={task.description_preview ?? undefined}
        >
          {task.description_preview}
        </p>
      ) : null}

      {showSummaryRow ? (
        <div
          className={cn(
            'flex min-h-5 shrink-0 items-center gap-x-2.5',
            density === 'compact' ? 'mt-2.5' : 'mt-3',
          )}
        >
          {showStatus ? (
            <span
              className={cn(
                'inline-flex min-w-0 flex-1 items-center gap-1.5 text-[13px] leading-5',
                task.status_category === 'blocked'
                  ? 'text-destructive'
                  : task.status_category === 'done'
                    ? 'text-pta-success'
                    : 'text-muted-foreground',
              )}
            >
              <StatusIcon aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate" title={task.status_name}>
                {task.status_name}
              </span>
            </span>
          ) : (
            <span className="min-w-0 flex-1" />
          )}
          {showChecklist && !simplified ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[13px] tabular-nums text-muted-foreground">
              <ListChecks aria-hidden="true" className="size-3.5" />
              <span className="sr-only">Checklist: </span>
              {completed}/{total}
              <span className="sr-only"> itens concluídos</span>
            </span>
          ) : null}
          {showComments && !simplified ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[13px] tabular-nums text-muted-foreground">
              <MessageSquare aria-hidden="true" className="size-3" />
              {task.comment_count}
              <span className="sr-only"> comentários</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {showChecklist && !simplified ? (
        <div
          className={cn(
            'h-[3px] shrink-0 overflow-hidden rounded-full bg-foreground/[0.08]',
            density === 'compact' ? 'mt-1.5' : 'mt-2',
          )}
          role="progressbar"
          aria-label={`Checklist de ${task.title}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-valuetext={`${completed} de ${total} itens concluídos`}
        >
          <span
            className={cn(
              'block h-full rounded-full transition-[width] duration-200 ease-out motion-reduce:transition-none',
              progress === 100 ? 'bg-pta-success' : 'bg-pta-blue',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      {showFooter ? (
        <div
          className={cn(
            'flex shrink-0 items-center gap-2 pt-1',
            density === 'compact' ? 'mt-2 min-h-7' : 'mt-3 min-h-8',
            showDueDate ? 'justify-between' : 'justify-end',
          )}
        >
          {showDueDate ? (
            <span
              className={cn(
                'flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[13px] leading-5',
                overdue
                  ? 'font-medium text-destructive'
                  : dueToday
                    ? 'font-medium text-pta-blue'
                    : 'text-muted-foreground',
              )}
            >
              {overdue ? (
                <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
              ) : (
                <CalendarDays
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                />
              )}
              <span className="truncate">
                <span className="sr-only">Prazo: </span>
                {overdue ? 'Atrasada · ' : ''}
                {formatDueDate(task.due_date, today)}
                {task.due_time && task.due_date ? (
                  <span className="whitespace-nowrap">
                    {' '}
                    · {task.due_time.slice(0, 5)}
                  </span>
                ) : null}
              </span>
            </span>
          ) : null}
          {simplified && (showChecklist || showComments) ? (
            <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              {showChecklist ? (
                <span
                  className="inline-flex items-center gap-1"
                  aria-label={`Checklist: ${completed} de ${total} itens concluídos`}
                >
                  <ListChecks className="size-3.5" aria-hidden="true" />
                  {completed}/{total}
                </span>
              ) : null}
              {showComments ? (
                <span
                  className="inline-flex items-center gap-1"
                  aria-label={`${task.comment_count} comentários`}
                >
                  <MessageSquare className="size-3.5" aria-hidden="true" />
                  {task.comment_count}
                </span>
              ) : null}
            </span>
          ) : null}
          {showAssignee ? (
            <span
              className="flex shrink-0 items-center text-[13px] text-muted-foreground"
              title={assignee ?? 'Sem responsável'}
            >
              <span
                aria-hidden="true"
                className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[13px] font-semibold text-primary ring-1 ring-primary/10"
              >
                {initials || <UserRound className="size-3" />}
              </span>
              <span className="sr-only">
                <span className="sr-only">Responsável: </span>
                {assignee ?? 'A definir'}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
