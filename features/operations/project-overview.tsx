'use client';

import {
  ArrowRight,
  CalendarDays,
  Check,
  Circle,
  Diamond,
  FileText,
  Plus,
  UsersRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { TaskDetailLink } from '@/features/tasks/task-detail-link';
import { cn } from '@/lib/utils';
import { formatRange } from './portfolio-detail-sheet';
import type { ProjectView } from './project-view-layout';
import type { EventDetail } from './types';
import styles from './project-overview.module.css';

export function ProjectOverview({
  detail,
  workspaceId,
  onAddTask,
  onAddMilestone,
  onNavigate,
  memberCount,
}: {
  detail: EventDetail;
  workspaceId: string;
  onAddTask: () => void;
  onAddMilestone: () => void;
  onNavigate: (view: ProjectView) => void;
  memberCount?: number;
}) {
  const { event, capabilities } = detail;
  const openTasks = detail.tasks
    .filter((task) => !['done', 'cancelled'].includes(task.statusCategory))
    .sort(compareByDate);
  const milestones = [...detail.milestones].sort(
    (a, b) =>
      Number(Boolean(a.completedAt)) - Number(Boolean(b.completedAt)) ||
      compareByDate(a, b) ||
      a.position - b.position,
  );
  const completedMilestones = detail.milestones.filter(
    (item) => item.completedAt,
  ).length;
  const progress =
    event.progress === null ? null : Math.min(100, Math.max(0, event.progress));

  return (
    <div className={styles.overview}>
      <section
        aria-labelledby="project-overview-title"
        className={styles.intro}
      >
        <div className="min-w-0">
          <p className={styles.eyebrow}>O trabalho em uma página</p>
          <h2 id="project-overview-title" className={styles.title}>
            Visão geral
          </h2>
          <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground break-words">
            {event.summary ||
              'Objetivo, entregas e próximos passos. Tudo o que importa para acompanhar esta área.'}
          </p>
        </div>
        {capabilities.canCreateTask && (
          <Button onClick={onAddTask} variant="outline" size="sm">
            <Plus aria-hidden="true" />
            Adicionar tarefa
          </Button>
        )}
      </section>
      <div className={styles.metadata}>
        <button
          onClick={() => onNavigate('settings')}
          className={styles.metaItem}
        >
          <span className={styles.avatar}>{initials(event.ownerName)}</span>
          <span>
            <span className={styles.metaLabel}>Responsável</span>
            <span className="block text-sm font-medium">
              {event.ownerName || 'Não definido'}
            </span>
          </span>
        </button>
        <button
          onClick={() => onNavigate('settings')}
          className={styles.metaItem}
        >
          <CalendarDays
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <span>
            <span className={styles.metaLabel}>Período</span>
            <span className="block text-sm font-medium">
              {formatRange(event.startDate, event.endDate)}
            </span>
          </span>
        </button>
        <button onClick={() => onNavigate('team')} className={styles.metaItem}>
          <UsersRound
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <span>
            <span className={styles.metaLabel}>Equipe</span>
            <span className="block text-sm font-medium">
              {memberCount ?? detail.team.length}{' '}
              {(memberCount ?? detail.team.length) === 1 ? 'pessoa' : 'pessoas'}
            </span>
          </span>
        </button>
      </div>
      <section
        className={styles.pulse}
        aria-labelledby="project-progress-title"
      >
        <div className={styles.progressMain}>
          <div className="flex items-baseline justify-between gap-4">
            <h3 id="project-progress-title" className="text-sm font-medium">
              Entregas concluídas
            </h3>
            <span className={styles.percentage}>
              {progress === null ? '—' : `${progress}%`}
            </span>
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Tarefas concluídas da equipe"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress ?? undefined}
            aria-valuetext={
              progress === null
                ? 'Sem tarefas para calcular'
                : `${event.doneTasks} de ${event.totalTasks} tarefas concluídas`
            }
          >
            <div style={{ width: `${progress ?? 0}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {event.totalTasks
              ? `${event.doneTasks} de ${event.totalTasks} tarefas concluídas`
              : 'Adicione a primeira tarefa para começar.'}
          </p>
        </div>
        <button className={styles.stat} onClick={() => onNavigate('list')}>
          <span className={styles.statNumber}>{event.openTasks}</span>
          <span className="text-sm text-muted-foreground">
            Em aberto{' '}
            <ArrowRight aria-hidden="true" className="inline size-3.5" />
          </span>
        </button>
        <button
          className={cn(
            styles.stat,
            event.overdueTasks > 0 && styles.attention,
          )}
          onClick={() => onNavigate('list')}
        >
          <span className={styles.statNumber}>{event.overdueTasks}</span>
          <span className="text-sm">
            {event.overdueTasks === 1 ? 'Tarefa atrasada' : 'Tarefas atrasadas'}{' '}
            <ArrowRight aria-hidden="true" className="inline size-3.5" />
          </span>
        </button>
      </section>
      <div className={styles.columns}>
        <div className="min-w-0">
          <section aria-labelledby="project-deliveries-title">
            <SectionHeader
              id="project-deliveries-title"
              title="Próximas entregas"
              count={openTasks.length}
              action={
                <TextAction onClick={() => onNavigate('list')}>
                  Ver tarefas
                </TextAction>
              }
            />
            {openTasks.length ? (
              <div className="divide-y divide-border/50">
                {openTasks.slice(0, 5).map((task) => (
                  <TaskDetailLink
                    key={task.id}
                    workspaceId={workspaceId}
                    taskId={task.id}
                    className={styles.task}
                  >
                    <Circle
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {task.title}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {task.statusName} ·{' '}
                        {task.assigneeName || 'Sem responsável'}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-muted-foreground">
                      <span className="block">
                        {formatDateLabel(task.dueDate)}
                      </span>
                      {task.dueTime && (
                        <span className="mt-1 block">
                          {task.dueTime.slice(0, 5)}
                        </span>
                      )}
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-muted-foreground"
                    />
                  </TaskDetailLink>
                ))}
              </div>
            ) : (
              <EmptyState
                title={
                  event.totalTasks
                    ? 'Nenhuma entrega pendente'
                    : 'Seu trabalho começa aqui'
                }
                description={
                  event.totalTasks
                    ? 'As tarefas desta área estão concluídas ou canceladas.'
                    : 'Adicione uma tarefa, defina o responsável e acompanhe a entrega.'
                }
                action={
                  capabilities.canCreateTask ? (
                    <TextAction onClick={onAddTask}>
                      Adicionar tarefa
                    </TextAction>
                  ) : undefined
                }
              />
            )}
          </section>
          <section
            className={styles.brief}
            aria-labelledby="project-brief-title"
          >
            <SectionHeader
              id="project-brief-title"
              title="Direção da equipe"
              action={
                capabilities.canEdit ? (
                  <TextAction onClick={() => onNavigate('settings')}>
                    Editar direção
                  </TextAction>
                ) : undefined
              }
            />
            <dl className="grid gap-6 pt-5 md:grid-cols-2 md:gap-10">
              <BriefField
                label="01 / Objetivo"
                value={event.objective}
                fallback="Qual resultado esta área deve entregar?"
              />
              <BriefField
                label="02 / Critério de sucesso"
                value={event.successMetric}
                fallback="Como a equipe saberá que chegou lá?"
              />
            </dl>
          </section>
        </div>
        <section aria-labelledby="project-milestones-title" className="min-w-0">
          <SectionHeader
            id="project-milestones-title"
            title="Marcos"
            count={milestones.length}
            action={
              <TextAction onClick={() => onNavigate('timeline')}>
                Cronograma
              </TextAction>
            }
          />
          {milestones.length ? (
            <>
              <p className="mb-4 mt-3 text-xs text-muted-foreground">
                {completedMilestones} de {milestones.length} concluídos
              </p>
              <ol className={styles.milestones}>
                {milestones.slice(0, 4).map((milestone, index) => (
                  <li key={milestone.id}>
                    <button
                      className={styles.milestone}
                      onClick={() => onNavigate('timeline')}
                    >
                      <span
                        className={cn(
                          styles.milestoneIcon,
                          milestone.completedAt && styles.completed,
                        )}
                      >
                        {milestone.completedAt ? (
                          <Check aria-hidden="true" className="size-3.5" />
                        ) : (
                          <Diamond aria-hidden="true" className="size-3.5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block truncate text-sm font-medium',
                            milestone.completedAt && 'text-muted-foreground',
                          )}
                        >
                          {milestone.title}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {formatDateLabel(milestone.dueDate)}
                          {index === 0 && !milestone.completedAt
                            ? ' · Próximo pendente'
                            : milestone.completedAt
                              ? ' · Concluído'
                              : ''}
                        </span>
                      </span>
                      <ArrowRight
                        aria-hidden="true"
                        className="size-3.5 text-muted-foreground"
                      />
                    </button>
                  </li>
                ))}
              </ol>
              {capabilities.canEdit && (
                <TextAction onClick={onAddMilestone}>
                  <Plus aria-hidden="true" className="size-3.5" />
                  Adicionar marco
                </TextAction>
              )}
            </>
          ) : (
            <EmptyState
              title="Defina os pontos de chegada"
              description="Marcos ajudam a sinalizar decisões, etapas e entregas importantes."
              action={
                capabilities.canEdit ? (
                  <TextAction onClick={onAddMilestone}>
                    Adicionar marco
                  </TextAction>
                ) : undefined
              }
            />
          )}
        </section>
      </div>
      <div className={styles.footer}>
        <button
          onClick={() => onNavigate('resources')}
          className={styles.footerLink}
        >
          <FileText aria-hidden="true" className="size-4" />
          <span>Recursos da equipe</span>
          <span className="text-muted-foreground">
            {detail.resources.length}
          </span>
          <ArrowRight aria-hidden="true" className="ml-auto size-4" />
        </button>
        <button
          onClick={() => onNavigate('team')}
          className={styles.footerLink}
        >
          <span className="flex -space-x-1.5" aria-hidden="true">
            {detail.team.slice(0, 3).map((member) => (
              <span key={member.id} className={styles.avatar}>
                {initials(member.name)}
              </span>
            ))}
          </span>
          <span>Ver equipe</span>
          <ArrowRight aria-hidden="true" className="ml-auto size-4" />
        </button>
      </div>
    </div>
  );
}
function SectionHeader({
  id,
  title,
  count,
  action,
}: {
  id: string;
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className={styles.sectionHeader}>
      <h3 id={id} className="font-semibold tracking-tight">
        {title}
        {count !== undefined && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {count}
          </span>
        )}
      </h3>
      {action}
    </div>
  );
}
function TextAction({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={styles.textAction}>
      {children}
      <ArrowRight aria-hidden="true" className="size-3.5" />
    </button>
  );
}
function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="py-6">
      <p className="text-sm font-medium">{title}</p>
      <p className="mb-2 mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action}
    </div>
  );
}
function BriefField({
  label,
  value,
  fallback,
}: {
  label: string;
  value: string | null;
  fallback: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'mt-2 whitespace-pre-wrap text-sm leading-6 break-words',
          !value && 'text-muted-foreground',
        )}
      >
        {value || fallback}
      </dd>
    </div>
  );
}
function initials(name: string | null) {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '—'
  );
}
function compareByDate(
  a: { dueDate: string | null },
  b: { dueDate: string | null },
) {
  return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
}
function formatDateLabel(value: string | null) {
  if (!value) return 'Sem data';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day, 12));
}
