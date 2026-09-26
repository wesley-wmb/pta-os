'use client';

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  CircleAlert,
  Diamond,
  FileText,
  Plus,
  Target,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { formatRange } from './portfolio-detail-sheet';
import type { EventDetail } from './types';

export function ProjectOverview({
  detail,
  onAddTask,
  onAddMilestone,
  onOpenList,
}: {
  detail: EventDetail;
  onAddTask: () => void;
  onAddMilestone: () => void;
  onOpenList: () => void;
}) {
  const openTasks = detail.tasks
    .filter((task) => !['done', 'cancelled'].includes(task.statusCategory))
    .sort(compareByDate);
  const nextMilestone = [...detail.milestones]
    .filter((milestone) => !milestone.completedAt)
    .sort((a, b) => compareByDate(a, b) || a.position - b.position)[0];
  const hasDirection = Boolean(
    detail.event.objective || detail.event.successMetric,
  );
  const hasTasks = detail.event.totalTasks > 0;

  return (
    <div className="mx-auto max-w-[1180px] pb-10">
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-14">
        <main className="min-w-0 space-y-10">
          <section aria-labelledby="project-direction-title">
            <SectionTitle
              eyebrow="Direção"
              title="O que orienta este projeto"
              id="project-direction-title"
            >
              {detail.capabilities.canEdit ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/projetos/${detail.event.id}?visao=settings`}>
                    Editar direção
                  </Link>
                </Button>
              ) : null}
            </SectionTitle>
            {hasDirection ? (
              <dl className="grid gap-8 py-6 md:grid-cols-2">
                <DirectionField
                  label="Objetivo"
                  value={detail.event.objective}
                  fallback="Objetivo ainda não definido."
                />
                <DirectionField
                  label="Critério de sucesso"
                  value={detail.event.successMetric}
                  fallback="Critério de sucesso ainda não definido."
                />
              </dl>
            ) : (
              <div className="flex max-w-2xl gap-4 py-9">
                <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Target aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold">
                    Dê direção ao projeto
                  </h3>
                  <p className="mt-1 text-[15px] leading-6 text-muted-foreground">
                    Comece pelo resultado esperado. Tarefas, marcos e datas
                    podem ser organizados depois, no ritmo deste trabalho.
                  </p>
                  {detail.capabilities.canEdit ? (
                    <Button asChild variant="outline" className="mt-5">
                      <Link
                        href={`/projetos/${detail.event.id}?visao=settings`}
                      >
                        Definir objetivo
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby="project-work-title">
            <SectionTitle
              eyebrow="Trabalho"
              title="Em andamento"
              id="project-work-title"
            >
              {openTasks.length ? (
                <button
                  type="button"
                  onClick={onOpenList}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Ver todas <ArrowRight aria-hidden="true" className="size-4" />
                </button>
              ) : null}
            </SectionTitle>
            {detail.event.overdueTasks > 0 ? (
              <div className="mt-5 flex items-center gap-3 rounded-xl bg-destructive/8 px-4 py-3 text-sm text-destructive">
                <CircleAlert aria-hidden="true" className="size-4" />
                {detail.event.overdueTasks}{' '}
                {detail.event.overdueTasks === 1
                  ? 'tarefa precisa'
                  : 'tarefas precisam'}{' '}
                de atenção.
              </div>
            ) : null}
            {openTasks.length ? (
              <div className="divide-y">
                {openTasks.slice(0, 5).map((task) => (
                  <Link
                    key={task.id}
                    href={`/tarefa/${task.id}`}
                    className="group grid min-h-[72px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Circle
                      aria-hidden="true"
                      className="size-5 text-muted-foreground"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold group-hover:text-primary">
                        {task.title}
                      </p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {task.statusName} ·{' '}
                        {task.assigneeName ?? 'Sem responsável'}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">
                      {formatDateLabel(task.dueDate)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-9">
                <p className="text-[15px] font-medium">
                  Ainda não há trabalho em andamento.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Crie a primeira tarefa quando o próximo passo estiver claro.
                </p>
                {detail.capabilities.canCreateTask ? (
                  <Button
                    variant="outline"
                    onClick={onAddTask}
                    className="mt-5"
                  >
                    <Plus aria-hidden="true" />
                    Adicionar primeira tarefa
                  </Button>
                ) : null}
              </div>
            )}
          </section>

          <section aria-labelledby="project-milestones-title">
            <SectionTitle
              eyebrow="Cronograma"
              title="Marcos do projeto"
              id="project-milestones-title"
            >
              <Button asChild variant="ghost" size="sm">
                <Link href={`/projetos/${detail.event.id}?visao=timeline`}>
                  Abrir cronograma <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </SectionTitle>
            {detail.milestones.length ? (
              <div className="divide-y">
                {[...detail.milestones]
                  .sort((a, b) => a.position - b.position)
                  .slice(0, 4)
                  .map((milestone) => (
                    <div
                      key={milestone.id}
                      className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3"
                    >
                      {milestone.completedAt ? (
                        <CheckCircle2
                          aria-hidden="true"
                          className="size-5 text-emerald-600"
                        />
                      ) : (
                        <Diamond
                          aria-hidden="true"
                          className="size-5 text-primary"
                        />
                      )}
                      <p
                        className={cn(
                          'truncate text-[15px] font-semibold',
                          milestone.completedAt &&
                            'text-muted-foreground line-through',
                        )}
                      >
                        {milestone.title}
                      </p>
                      <span className="text-sm text-muted-foreground">
                        {formatDateLabel(milestone.dueDate)}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-5 py-7">
                <div>
                  <p className="text-[15px] font-medium">
                    Nenhum marco definido
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Marcos são checkpoints opcionais criados por você.
                  </p>
                </div>
                {detail.capabilities.canEdit ? (
                  <Button variant="outline" onClick={onAddMilestone}>
                    <Plus aria-hidden="true" />
                    Criar marco
                  </Button>
                ) : null}
              </div>
            )}
          </section>
        </main>

        <aside className="space-y-8 xl:border-l xl:pl-8">
          <section aria-labelledby="project-details-title">
            <h2 id="project-details-title" className="text-base font-semibold">
              Detalhes
            </h2>
            <dl className="mt-4 divide-y border-y">
              <DetailRow
                icon={UsersRound}
                label="Responsável"
                value={detail.event.ownerName ?? 'Não definido'}
              />
              <DetailRow
                icon={CalendarDays}
                label="Período"
                value={formatRange(
                  detail.event.startDate,
                  detail.event.endDate,
                )}
              />
              <DetailRow
                icon={UsersRound}
                label="Equipe"
                value={`${detail.team.length} ${detail.team.length === 1 ? 'pessoa' : 'pessoas'}`}
              />
              <DetailRow
                icon={FileText}
                label="Recursos"
                value={String(detail.resources.length)}
              />
            </dl>
          </section>
          <section>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Andamento</h2>
              {hasTasks ? (
                <span className="text-sm font-semibold tabular-nums">
                  {detail.event.progress ?? 0}%
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {hasTasks
                ? `${detail.event.doneTasks} de ${detail.event.totalTasks} tarefas concluídas`
                : 'Ainda sem tarefas'}
            </p>
            {hasTasks ? (
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${detail.event.progress ?? 0}%` }}
                />
              </div>
            ) : null}
          </section>
          <section>
            <h2 className="text-base font-semibold">Próximo passo</h2>
            <p className="mt-3 text-[15px] font-medium">
              {!hasDirection
                ? 'Definir a direção do projeto'
                : !hasTasks
                  ? 'Adicionar a primeira tarefa'
                  : !nextMilestone
                    ? 'Definir um marco, se fizer sentido'
                    : nextMilestone.title}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {!hasDirection
                ? 'Registre o objetivo e como o sucesso será reconhecido.'
                : !hasTasks
                  ? 'Transforme a direção em uma primeira ação concreta.'
                  : !nextMilestone
                    ? 'O cronograma continua válido sem etapas prontas.'
                    : formatDateLabel(nextMilestone.dueDate)}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  id,
  children,
}: {
  eyebrow: string;
  title: string;
  id: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2
          id={id}
          className="mt-2 text-[22px] font-semibold tracking-[-0.025em]"
        >
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function DirectionField({
  label,
  value,
  fallback,
}: {
  label: string;
  value: string | null;
  fallback: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          'mt-3 text-[16px] leading-7',
          !value && 'text-muted-foreground',
        )}
      >
        {value || fallback}
      </dd>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UsersRound;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 py-3">
      <Icon
        aria-hidden="true"
        className="mt-0.5 size-4 text-muted-foreground"
      />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 truncate text-sm font-medium" title={value}>
          {value}
        </dd>
      </div>
    </div>
  );
}

function compareByDate(
  left: { dueDate: string | null },
  right: { dueDate: string | null },
) {
  if (!left.dueDate && !right.dueDate) return 0;
  if (!left.dueDate) return 1;
  if (!right.dueDate) return -1;
  return left.dueDate.localeCompare(right.dueDate);
}

function formatDateLabel(value: string | null) {
  if (!value) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}
