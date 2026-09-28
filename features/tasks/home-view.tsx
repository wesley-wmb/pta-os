'use client';

import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  FolderKanban,
  Target,
  TriangleAlert,
} from 'lucide-react';
import { NavigationLink as Link } from '@/components/navigation/navigation-link';
import { TaskDetailLink } from './task-detail-link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { QueryError } from '@/components/system/query-state';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  ActivitySummary,
  EventSummary,
} from '@/features/operations/types';
import type { WorkspaceRole } from '@/features/workspace/types';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

import {
  calendarWeekKeys,
  currentDateInTimeZone,
  dateFromKey,
} from './date-utils';
import { formatDueDate, isClosed, statusTone } from './formatters';
import styles from './home-view.module.css';
import { canEditTaskOverview } from './permissions';
import { taskKeys, useTasks } from './queries';
import type { TaskOverview, TaskStatus } from './types';

type HomeViewProps = {
  workspaceId: string;
  statuses: TaskStatus[];
  role: WorkspaceRole;
  currentUserId: string;
  timezone: string;
  events: EventSummary[];
  activity: ActivitySummary[];
  greeting: string;
  firstName: string;
  todayKey: string;
  weekdayLabel: string;
  dateLabel: string;
};

type WeekDay = {
  dateKey: string;
  label: string;
  fullLabel: string;
  completed: number;
  planned: number;
};

export function HomeView({
  workspaceId,
  statuses,
  role,
  currentUserId,
  timezone,
  events,
  activity,
  greeting,
  firstName,
  todayKey,
  weekdayLabel,
  dateLabel,
}: HomeViewProps) {
  const query = useTasks(workspaceId);
  const today = currentDateInTimeZone(timezone);
  const summary = useMemo(() => {
    const tasks = (query.data ?? []).filter(
      (task) => task.primary_assignee_id === currentUserId,
    );
    const weekKeys = calendarWeekKeys(timezone);
    const now = new Date().toISOString();
    const open = tasks.filter((task) => !isClosed(task.status_category));
    const overdue = open.filter(
      (task) =>
        Boolean(task.due_at && task.due_at < now) ||
        Boolean(task.due_date && task.due_date < today),
    );
    const todayTasks = open.filter((task) => task.due_date === today);
    const blocked = open.filter((task) => task.status_category === 'blocked');
    const inProgress = open.filter((task) =>
      ['in_progress', 'review'].includes(task.status_category),
    );
    const trackableWeekTasks = tasks.filter(
      (task) =>
        weekKeys.includes(task.due_date ?? '') &&
        task.status_category !== 'cancelled',
    );
    const completedWeek = trackableWeekTasks.filter(
      (task) => task.status_category === 'done',
    );
    const byDeadline = (left: TaskOverview, right: TaskOverview) =>
      (left.due_date ?? '9999-12-31').localeCompare(
        right.due_date ?? '9999-12-31',
      );
    const priorityMap = new Map<string, TaskOverview>();
    [
      ...overdue.toSorted(byDeadline),
      ...todayTasks,
      ...blocked,
      ...open.toSorted(byDeadline),
    ].forEach((task) => priorityMap.set(task.id, task));
    return {
      open,
      overdue,
      todayTasks,
      inProgress,
      completedWeek,
      weekTotal: trackableWeekTasks.length,
      completionRate: trackableWeekTasks.length
        ? Math.round((completedWeek.length / trackableWeekTasks.length) * 100)
        : 0,
      priorities: [...priorityMap.values()],
      weekDays: weekKeys.map((dateKey, index): WeekDay => ({
        dateKey,
        label: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][index],
        fullLabel: format(dateFromKey(dateKey), 'EEEE', { locale: ptBR }),
        completed: tasks.filter(
          (task) =>
            task.due_date === dateKey && task.status_category === 'done',
        ).length,
        planned: trackableWeekTasks.filter((task) => task.due_date === dateKey)
          .length,
      })),
    };
  }, [currentUserId, query.data, timezone, today]);

  if (query.isPending) return <HomeSkeleton />;
  if (query.isError) return <QueryError onRetry={() => void query.refetch()} />;

  const orderedEvents = events
    .filter((event) => !['cancelled', 'completed'].includes(event.status))
    .toSorted((left, right) => {
      const order = { active: 0, upcoming: 1, planning: 2, ended: 3 };
      return (
        order[left.phase] - order[right.phase] ||
        (left.startDate ?? '9999-12-31').localeCompare(
          right.startDate ?? '9999-12-31',
        )
      );
    });
  const featuredEvent = orderedEvents[0] ?? null;
  const featuredTasks = featuredEvent
    ? summary.open.filter((task) => task.event_id === featuredEvent.id)
    : summary.open;
  const visiblePriorities = summary.priorities.slice(0, 4);
  const focusTask = visiblePriorities[0] ?? null;

  return (
    <section className={styles.stage}>
      <div className={styles.shell}>
        <DailyCanvas
          greeting={greeting}
          firstName={firstName}
          todayKey={todayKey}
          weekdayLabel={weekdayLabel}
          dateLabel={dateLabel}
          task={focusTask}
          taskOverdue={Boolean(
            focusTask &&
            summary.overdue.some((item) => item.id === focusTask.id),
          )}
          completed={summary.completedWeek.length}
          weekTotal={summary.weekTotal}
          inProgress={summary.inProgress.length}
          todayCount={summary.todayTasks.length}
          overdue={summary.overdue.length}
          completionRate={summary.completionRate}
        />

        <div className={styles.workGrid}>
          <PrioritySection
            tasks={visiblePriorities}
            openCount={summary.open.length}
            overdueIds={new Set(summary.overdue.map((task) => task.id))}
            statuses={statuses}
            role={role}
            currentUserId={currentUserId}
          />
          <WeekSection
            days={summary.weekDays}
            completed={summary.completedWeek.length}
            completionRate={summary.completionRate}
            today={today}
          />
          <ProjectSection
            event={featuredEvent}
            tasks={featuredTasks}
            fallbackProgress={summary.completionRate}
            today={today}
          />
          <ActivitySection activity={activity} timezone={timezone} />
        </div>

        {orderedEvents.length > 1 ? (
          <ProjectRail events={orderedEvents.slice(1, 5)} />
        ) : null}
      </div>
    </section>
  );
}

function DailyCanvas({
  greeting,
  firstName,
  todayKey,
  weekdayLabel,
  dateLabel,
  task,
  taskOverdue,
  completed,
  weekTotal,
  inProgress,
  todayCount,
  overdue,
  completionRate,
}: {
  greeting: string;
  firstName: string;
  todayKey: string;
  weekdayLabel: string;
  dateLabel: string;
  task: TaskOverview | null;
  taskOverdue: boolean;
  completed: number;
  weekTotal: number;
  inProgress: number;
  todayCount: number;
  overdue: number;
  completionRate: number;
}) {
  const message = overdue
    ? `${overdue} ${overdue === 1 ? 'entrega pede' : 'entregas pedem'} sua atenção.`
    : todayCount
      ? `${todayCount} ${todayCount === 1 ? 'entrega conduz' : 'entregas conduzem'} o seu dia.`
      : 'O espaço está aberto para o trabalho que importa.';
  return (
    <section className={styles.canvas} aria-labelledby="home-title">
      <div className={styles.canvasLight} aria-hidden="true" />
      <header className={styles.canvasGreeting}>
        <p className={styles.dateLine}>
          <span>{sentenceCase(weekdayLabel)}</span>
          <time dateTime={todayKey}>
            {dateLabel.toLocaleLowerCase('pt-BR')}
          </time>
        </p>
        <h1 id="home-title">
          {greeting}, <span>{firstName}.</span>
        </h1>
        <p>{message}</p>
      </header>

      <time
        className={styles.canvasDate}
        dateTime={todayKey}
        aria-label={`${weekdayLabel}, ${dateLabel}`}
      >
        <span>{sentenceCase(weekdayLabel)}</span>
        <strong>{todayKey.slice(-2)}</strong>
        <small>
          {dateLabel.replace(/^\d+\s+de\s+/i, '').toLocaleLowerCase('pt-BR')}
        </small>
      </time>

      <div className={styles.canvasFocus}>
        <span className={styles.focusKicker}>
          <Target aria-hidden="true" /> Agora
        </span>
        {task ? (
          <TaskDetailLink
            taskId={task.id}
            workspaceId={task.workspace_id}
            className={styles.focusTitle}
          >
            <h2>{task.title}</h2>
            <ArrowUpRight aria-hidden="true" />
          </TaskDetailLink>
        ) : (
          <h2 className={styles.focusTitle}>Nenhuma tarefa aberta.</h2>
        )}
        <div className={styles.focusMeta}>
          {task ? (
            <span
              className={cn(styles.status, statusTone(task.status_category))}
            >
              {task.status_name}
            </span>
          ) : null}
          {task?.event_name ? <span>{task.event_name}</span> : null}
          <span className={cn(taskOverdue && styles.canvasLate)}>
            {task
              ? `${taskOverdue ? 'Atrasada · ' : ''}${formatDueDate(task.due_date)}${task.due_time ? `, ${task.due_time.slice(0, 5)}` : ''}`
              : 'Planeje o próximo passo'}
          </span>
        </div>
      </div>

      <nav className={styles.canvasActions} aria-label="Atalhos do início">
        <Link href="/demandas" className={styles.primaryAction}>
          Abrir tarefas <ArrowUpRight aria-hidden="true" />
        </Link>
        <Link href="/demandas?visao=semana">
          Planejar semana <ArrowRight aria-hidden="true" />
        </Link>
      </nav>

      <div className={styles.canvasMetrics} aria-label="Resumo da semana">
        <Metric
          icon={CheckCircle2}
          value={completed}
          label="Concluídas"
          detail={`de ${weekTotal} na semana`}
          tone="success"
        />
        <Metric
          icon={Clock3}
          value={inProgress}
          label="Em curso"
          detail={`${todayCount} para hoje`}
          tone="accent"
        />
        <Metric
          icon={TriangleAlert}
          value={overdue}
          label="Atrasadas"
          detail="pedem atenção"
          tone={overdue ? 'danger' : 'neutral'}
        />
        <div className={styles.weekProgress}>
          <div>
            <span>Ritmo</span>
            <strong>{completionRate}%</strong>
          </div>
          <span className={styles.progressTrack} aria-hidden="true">
            <i style={{ width: `${completionRate}%` }} />
          </span>
        </div>
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
  detail,
  tone,
}: {
  icon: typeof CheckCircle2;
  value: number;
  label: string;
  detail: string;
  tone: 'success' | 'accent' | 'danger' | 'neutral';
}) {
  return (
    <div className={styles.metric} data-tone={tone}>
      <Icon aria-hidden="true" />
      <strong>{value}</strong>
      <span>
        <b>{label}</b>
        <small>{detail}</small>
      </span>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  detail,
  href,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <header className={styles.sectionHeader}>
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {href && linkLabel ? (
        <Link href={href}>
          {linkLabel}
          <ArrowUpRight aria-hidden="true" />
        </Link>
      ) : (
        <span>{detail}</span>
      )}
    </header>
  );
}

function PrioritySection({
  tasks,
  openCount,
  overdueIds,
  statuses,
  role,
  currentUserId,
}: {
  tasks: TaskOverview[];
  openCount: number;
  overdueIds: Set<string>;
  statuses: TaskStatus[];
  role: WorkspaceRole;
  currentUserId: string;
}) {
  return (
    <section
      className={cn(styles.section, styles.prioritySection)}
      aria-label="Prioridades"
    >
      <SectionHeader
        eyebrow="Hoje"
        title="Prioridades"
        detail={`${openCount} abertas`}
      />
      {tasks.length ? (
        <ol className={styles.taskList}>
          {tasks.map((task, index) => (
            <HomeTaskRow
              key={task.id}
              task={task}
              index={index}
              statuses={statuses}
              overdue={overdueIds.has(task.id)}
              canEdit={canEditTaskOverview(role, currentUserId, task)}
            />
          ))}
        </ol>
      ) : (
        <EmptyState
          title="Tudo em dia"
          text="Não há tarefas abertas atribuídas a você."
        />
      )}
      <Link href="/demandas" className={styles.textLink}>
        Ver todas as tarefas <ArrowRight aria-hidden="true" />
      </Link>
    </section>
  );
}

function WeekSection({
  days,
  completed,
  completionRate,
  today,
}: {
  days: WeekDay[];
  completed: number;
  completionRate: number;
  today: string;
}) {
  const planned = days.reduce((sum, day) => sum + day.planned, 0);
  return (
    <section
      className={cn(styles.section, styles.weekSection)}
      aria-label="Sua semana"
    >
      <SectionHeader
        eyebrow="Planejamento"
        title="Sua semana"
        href="/demandas?visao=semana"
        linkLabel="Abrir"
      />
      <div className={styles.weekDays}>
        {days.map((day) => (
          <Link
            key={day.dateKey}
            href={`/demandas?visao=semana&data=${day.dateKey}`}
            className={styles.weekDay}
            data-today={day.dateKey === today || undefined}
            aria-label={`${day.fullLabel}: ${day.planned} tarefas, ${day.completed} concluídas`}
          >
            <span>{day.label}</span>
            <strong>{format(dateFromKey(day.dateKey), 'd')}</strong>
            <i aria-hidden="true" data-active={day.planned > 0 || undefined} />
            <small>{day.planned || '—'}</small>
          </Link>
        ))}
      </div>
      <div className={styles.weekSummary}>
        <span>
          {completed} de {planned} concluídas
        </span>
        <strong>{completionRate}%</strong>
      </div>
      <span className={styles.progressTrack} aria-hidden="true">
        <i style={{ width: `${completionRate}%` }} />
      </span>
    </section>
  );
}

function ProjectSection({
  event,
  tasks,
  fallbackProgress,
  today,
}: {
  event: EventSummary | null;
  tasks: TaskOverview[];
  fallbackProgress: number;
  today: string;
}) {
  const progress = event
    ? (event.progress ??
      (event.totalTasks
        ? Math.round((event.doneTasks / event.totalTasks) * 100)
        : 0))
    : fallbackProgress;
  const countdown = event ? eventCountdown(event, today) : null;
  return (
    <section
      className={cn(styles.section, styles.projectSection)}
      aria-label="Projeto em foco"
    >
      <SectionHeader
        eyebrow="Em foco"
        title={event?.name ?? 'Seu trabalho'}
        href={event ? `/projetos/${event.id}` : '/demandas'}
        linkLabel={event ? 'Abrir projeto' : 'Abrir tarefas'}
      />
      <div className={styles.projectBody}>
        <div className={styles.projectNarrative}>
          <p>
            {event?.summary ??
              (tasks.length
                ? `${tasks.length} entregas abertas formam o próximo ciclo de trabalho.`
                : 'Nenhuma entrega aberta neste momento.')}
          </p>
          <div className={styles.projectFacts}>
            <span>
              <small>Progresso</small>
              <strong>{progress}%</strong>
            </span>
            <span>
              <small>Tarefas</small>
              <strong>
                {event
                  ? `${event.doneTasks}/${event.totalTasks}`
                  : tasks.length}
              </strong>
            </span>
            <span>
              <small>{countdown?.label ?? 'Equipe'}</small>
              <strong>{countdown?.value ?? event?.teamCount ?? 0}</strong>
            </span>
          </div>
        </div>
        <div className={styles.projectMeter}>
          <span className={styles.progressTrack} aria-hidden="true">
            <i style={{ width: `${progress}%` }} />
          </span>
          <div>
            <b>Início</b>
            <b>Entrega</b>
          </div>
        </div>
      </div>
    </section>
  );
}

function ActivitySection({
  activity,
  timezone,
}: {
  activity: ActivitySummary[];
  timezone: string;
}) {
  return (
    <section
      className={cn(styles.section, styles.activitySection)}
      aria-label="Atividade recente"
    >
      <SectionHeader
        eyebrow="Equipe"
        title="Atividade recente"
        href="/historico"
        linkLabel="Histórico"
      />
      {activity.length ? (
        <ol className={styles.activityList}>
          {activity.slice(0, 4).map((item) => (
            <li key={item.id}>
              <CircleDot aria-hidden="true" />
              <div>
                <p>
                  <strong>{item.actorName}</strong> {activityActionLabel(item)}
                </p>
                <small>{item.taskTitle ?? 'Tarefa arquivada'}</small>
              </div>
              <time dateTime={item.createdAt}>
                {new Intl.DateTimeFormat('pt-BR', {
                  timeZone: timezone,
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(item.createdAt))}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="Tudo calmo"
          text="As próximas alterações da equipe aparecerão aqui."
        />
      )}
    </section>
  );
}

function ProjectRail({ events }: { events: EventSummary[] }) {
  return (
    <section className={styles.projectRail} aria-label="Próximos projetos">
      <SectionHeader
        eyebrow="Horizonte"
        title="Próximos projetos"
        href="/projetos"
        linkLabel="Ver portfólio"
      />
      <div className={styles.railGrid}>
        {events.map((event, index) => (
          <Link
            href={`/projetos/${event.id}`}
            key={event.id}
            className={styles.railItem}
          >
            <span>0{index + 1}</span>
            <FolderKanban aria-hidden="true" />
            <div>
              <small>{event.productName ?? 'Projeto'}</small>
              <strong>{event.name}</strong>
            </div>
            <b>{event.progress ?? 0}%</b>
            <ChevronRight aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className={styles.empty}>
      <Check aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function HomeTaskRow({
  task,
  index,
  statuses,
  overdue,
  canEdit,
}: {
  task: TaskOverview;
  index: number;
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
      if (previousTask)
        queryClient.setQueryData<TaskOverview[]>(
          taskKeys.all(task.workspace_id),
          (items) =>
            items?.map((item) => (item.id === task.id ? previousTask : item)),
        );
      toast.error(
        error.message.includes('PTA_VERSION_CONFLICT')
          ? 'Esta tarefa foi atualizada por outra pessoa.'
          : 'Não foi possível salvar. O valor anterior foi restaurado.',
      );
    } else toast.success('Tarefa concluída.');
    await queryClient.invalidateQueries({
      queryKey: taskKeys.all(task.workspace_id),
    });
    setSaving(false);
  }
  return (
    <li className={styles.taskRow}>
      <span className={styles.taskIndex}>
        {String(index + 1).padStart(2, '0')}
      </span>
      {canEdit ? (
        <Checkbox
          checked={isClosed(task.status_category)}
          onCheckedChange={() => void completeTask()}
          disabled={!doneStatus || saving}
          className={styles.taskCheck}
          aria-label={`Concluir ${task.title}`}
        />
      ) : (
        <span className={styles.taskCheck} aria-hidden="true" />
      )}
      <TaskDetailLink
        taskId={task.id}
        workspaceId={task.workspace_id}
        className={styles.taskMain}
      >
        <strong>{task.title}</strong>
        <span>
          <i className={cn(styles.status, statusTone(task.status_category))}>
            {task.status_name}
          </i>
          {task.event_name ?? task.type_name}
        </span>
      </TaskDetailLink>
      <span className={cn(styles.taskDue, overdue && styles.taskDueLate)}>
        {overdue ? <TriangleAlert aria-hidden="true" /> : null}
        {formatDueDate(task.due_date)}
        {task.due_time ? ` · ${task.due_time.slice(0, 5)}` : ''}
      </span>
      <ChevronRight aria-hidden="true" className={styles.taskArrow} />
    </li>
  );
}

function activityActionLabel(item: ActivitySummary) {
  switch (item.action) {
    case 'task.created':
      return 'criou uma tarefa';
    case 'task.updated':
      return 'atualizou uma tarefa';
    case 'task.assignee_added':
      return `atribuiu ${item.subjectName ?? 'uma pessoa'}`;
    case 'task.assignee_changed':
      return 'alterou a responsabilidade';
    case 'task.assignee_removed':
      return `removeu ${item.subjectName ?? 'uma pessoa'}`;
    default:
      return 'registrou uma movimentação';
  }
}

function eventCountdown(event: EventSummary, today: string) {
  const target = event.phase === 'active' ? event.endDate : event.startDate;
  if (!target) return null;
  const days = Math.max(
    0,
    Math.ceil(
      (dateFromKey(target).getTime() - dateFromKey(today).getTime()) /
        86_400_000,
    ),
  );
  return {
    label: event.phase === 'active' ? 'Termina em' : 'Começa em',
    value: days === 1 ? '1 dia' : `${days} dias`,
  };
}

function sentenceCase(value: string) {
  const normalized = value.toLocaleLowerCase('pt-BR');
  return normalized.charAt(0).toLocaleUpperCase('pt-BR') + normalized.slice(1);
}

function HomeSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[1480px] space-y-8 px-8 pb-16"
      aria-busy="true"
      aria-label="Carregando visão geral"
    >
      <Skeleton className="h-40 rounded-3xl" />
      <Skeleton className="h-64 rounded-3xl" />
      <div className="grid gap-8 lg:grid-cols-2">
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    </div>
  );
}
