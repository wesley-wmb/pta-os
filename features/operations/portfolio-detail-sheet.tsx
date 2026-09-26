'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  Circle,
  FileText,
  LayoutGrid,
  ListChecks,
  LoaderCircle,
  Pencil,
  Plus,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { WorkspaceMember } from '@/features/workspace/types';
import type { TaskStatus } from '@/features/tasks/types';
import {
  TaskBoardColumn,
  TaskBoardEmpty,
  TaskBoardViewport,
} from '@/features/tasks/task-board';
import { createClient } from '@/lib/supabase/client';

import {
  EventEditorDialog,
  ProductEditorDialog,
} from './portfolio-editor-dialog';
import {
  portfolioKeys,
  useEventDetail,
  useProductDetail,
} from './portfolio-queries';
import type { PortfolioTask, ProductSummary, ProjectPhase } from './types';

type CommonProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  members: WorkspaceMember[];
  taskPrefix: string;
  statuses?: TaskStatus[];
  initialEdit?: boolean;
  onSaved: (id: string) => void;
};

export function EventDetailSheet({
  eventId,
  products,
  ...props
}: CommonProps & { eventId: string | null; products: ProductSummary[] }) {
  const query = useEventDetail(props.workspaceId, eventId);
  const [editOpen, setEditOpen] = useState(Boolean(props.initialEdit));
  const [taskOpen, setTaskOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);

  return (
    <>
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent className="gap-0 overflow-hidden p-0 data-[side=right]:!w-screen data-[side=right]:sm:!max-w-[min(1320px,calc(100vw-32px))]">
          {query.isPending ? (
            <DetailLoading />
          ) : query.isError || !query.data ? (
            <DetailError />
          ) : (
            <>
              <SheetHeader className="relative max-h-[40dvh] shrink-0 overflow-y-auto border-b bg-card px-4 py-6 pr-14 text-foreground sm:px-6 sm:pr-16">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={query.data.event.status} />
                  {query.data.event.totalTasks === 0 &&
                  query.data.event.healthOverride === null ? (
                    <Badge variant="outline">Sem avaliação</Badge>
                  ) : (
                    <HealthStateBadge value={query.data.event.health} />
                  )}
                  {query.data.event.productName ? (
                    <Badge variant="outline">
                      {query.data.event.productName}
                    </Badge>
                  ) : null}
                </div>
                <SheetTitle className="relative mt-3 max-w-4xl text-[28px] font-semibold leading-tight tracking-[-0.025em] text-foreground [overflow-wrap:anywhere] sm:text-[32px]">
                  {query.data.event.name}
                </SheetTitle>
                <SheetDescription className="relative text-muted-foreground">
                  {formatRange(
                    query.data.event.startDate,
                    query.data.event.endDate,
                  )}
                </SheetDescription>
                <div className="relative mt-4 flex flex-wrap gap-2">
                  {query.data.capabilities.canCreateTask ? (
                    <Button
                      size="sm"
                      className="bg-primary text-primary-foreground hover:bg-primary-hover"
                      onClick={() => setTaskOpen(true)}
                    >
                      <Plus aria-hidden="true" />
                      Nova tarefa
                    </Button>
                  ) : null}
                  {query.data.capabilities.canEdit ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-border bg-card text-foreground hover:bg-accent hover:text-foreground"
                      onClick={() => setEditOpen(true)}
                    >
                      <Pencil aria-hidden="true" />
                      Editar
                    </Button>
                  ) : null}
                </div>
              </SheetHeader>
              <Tabs
                defaultValue="overview"
                className="min-h-0 flex-1 px-4 py-4 sm:px-6 sm:py-5"
              >
                <TabsList
                  variant="line"
                  className="max-w-full justify-start overflow-x-auto"
                >
                  <TabsTrigger value="overview">Visão geral</TabsTrigger>
                  <TabsTrigger value="board">
                    Quadro <Count value={query.data.tasks.length} />
                  </TabsTrigger>
                  <TabsTrigger value="tasks">Lista</TabsTrigger>
                  <TabsTrigger value="resources">
                    Recursos <Count value={query.data.resources.length} />
                  </TabsTrigger>
                  <TabsTrigger value="timeline">Cronograma</TabsTrigger>
                  <TabsTrigger value="team">Equipe</TabsTrigger>
                  <TabsTrigger value="history">Histórico</TabsTrigger>
                </TabsList>
                <TabsContent
                  value="overview"
                  className="min-h-0 overflow-y-auto pt-6"
                >
                  <div className="relative grid grid-cols-2 gap-y-3 rounded-lg bg-muted/50 py-2 sm:grid-cols-4">
                    <HeroMetric
                      label="Progresso"
                      value={
                        query.data.event.progress === null
                          ? 'Sem tarefas'
                          : `${query.data.event.progress}%`
                      }
                    />
                    <HeroMetric
                      label="Concluídas"
                      value={`${query.data.event.doneTasks} de ${query.data.event.totalTasks}`}
                    />
                    <HeroMetric
                      label="Abertas"
                      value={String(query.data.event.openTasks)}
                    />
                    <HeroMetric
                      label="Em atraso"
                      value={String(query.data.event.overdueTasks)}
                    />
                  </div>
                  {query.data.event.progress !== null ? (
                    <div
                      className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-border"
                      role="progressbar"
                      aria-label={`Progresso do projeto ${query.data.event.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={query.data.event.progress}
                    >
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${query.data.event.progress}%` }}
                      />
                    </div>
                  ) : null}

                  <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
                    <div>
                      <TextSection
                        title="Resumo"
                        value={query.data.event.summary}
                      />
                      <TextSection
                        title="Objetivo"
                        value={query.data.event.objective}
                      />
                    </div>
                    <aside className="rounded-xl border bg-muted/45 p-4">
                      <OverviewGrid
                        items={[
                          [
                            'Responsável',
                            query.data.event.ownerName ?? 'Não definido',
                          ],
                          [
                            'Produto',
                            query.data.event.productName ?? 'Não associado',
                          ],
                          [
                            'Período',
                            formatRange(
                              query.data.event.startDate,
                              query.data.event.endDate,
                            ),
                          ],
                          [
                            'Métrica de sucesso',
                            query.data.event.successMetric ?? 'Não definida',
                          ],
                        ]}
                      />
                    </aside>
                  </div>
                </TabsContent>
                <TabsContent
                  value="board"
                  className="min-h-0 overflow-hidden pt-4"
                >
                  <ProjectTaskBoard
                    items={query.data.tasks}
                    statuses={props.statuses ?? []}
                  />
                </TabsContent>
                <TabsContent
                  value="tasks"
                  className="min-h-0 overflow-y-auto pt-6"
                >
                  <TaskList items={query.data.tasks} />
                </TabsContent>
                <TabsContent
                  value="resources"
                  className="min-h-0 overflow-y-auto pt-6"
                >
                  <ResourceList items={query.data.resources} />
                </TabsContent>
                <TabsContent
                  value="timeline"
                  className="min-h-0 overflow-y-auto pt-6"
                >
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <h3 className="font-semibold">Marcos do projeto</h3>
                    {query.data.capabilities.canEdit ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setMilestoneOpen(true)}
                      >
                        <Plus aria-hidden="true" />
                        Novo marco
                      </Button>
                    ) : null}
                  </div>
                  <MilestoneList
                    workspaceId={props.workspaceId}
                    eventId={query.data.event.id}
                    items={query.data.milestones}
                    canEdit={query.data.capabilities.canEdit}
                  />
                </TabsContent>
                <TabsContent
                  value="team"
                  className="min-h-0 overflow-y-auto pt-6"
                >
                  <TeamList items={query.data.team} />
                </TabsContent>
                <TabsContent
                  value="history"
                  className="min-h-0 overflow-y-auto pt-6"
                >
                  <HistoryList items={query.data.history} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
      {query.data ? (
        <EventEditorDialog
          key={`${query.data.event.id}-${query.data.event.version}`}
          open={editOpen}
          onOpenChange={setEditOpen}
          workspaceId={props.workspaceId}
          members={props.members}
          products={products}
          detail={query.data}
          onSaved={props.onSaved}
        />
      ) : null}
      {eventId ? (
        <ContextTaskDialog
          open={taskOpen}
          onOpenChange={setTaskOpen}
          workspaceId={props.workspaceId}
          contextType="event"
          contextId={eventId}
          members={props.members}
          statuses={props.statuses}
        />
      ) : null}
      {eventId ? (
        <MilestoneDialog
          open={milestoneOpen}
          onOpenChange={setMilestoneOpen}
          workspaceId={props.workspaceId}
          eventId={eventId}
        />
      ) : null}
    </>
  );
}

export function ProductDetailSheet({
  productId,
  ...props
}: CommonProps & { productId: string | null }) {
  const query = useProductDetail(props.workspaceId, productId);
  const [editOpen, setEditOpen] = useState(Boolean(props.initialEdit));
  const [taskOpen, setTaskOpen] = useState(false);
  return (
    <>
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent className="w-[min(100vw,860px)] gap-0 overflow-y-auto p-0 sm:max-w-[860px]">
          {query.isPending ? (
            <DetailLoading />
          ) : query.isError || !query.data ? (
            <DetailError />
          ) : (
            <>
              <SheetHeader className="border-b px-5 py-6 sm:px-8">
                <StatusBadge value={query.data.product.status} />
                <SheetTitle className="mt-3 max-w-2xl text-2xl font-semibold tracking-[-0.035em] [overflow-wrap:anywhere] sm:text-3xl">
                  {query.data.product.name}
                </SheetTitle>
                <SheetDescription>
                  {query.data.product.ownerName ?? 'Sem responsável definido'}
                </SheetDescription>
                <div className="mt-4 flex flex-wrap gap-2">
                  {query.data.capabilities.canCreateTask ? (
                    <Button size="sm" onClick={() => setTaskOpen(true)}>
                      <Plus aria-hidden="true" />
                      Nova tarefa
                    </Button>
                  ) : null}
                  {query.data.capabilities.canEdit ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditOpen(true)}
                    >
                      <Pencil aria-hidden="true" />
                      Editar
                    </Button>
                  ) : null}
                </div>
              </SheetHeader>
              <Tabs defaultValue="overview" className="px-5 py-6 sm:px-8">
                <TabsList
                  variant="line"
                  className="max-w-full justify-start overflow-x-auto"
                >
                  <TabsTrigger value="overview">Visão geral</TabsTrigger>
                  <TabsTrigger value="events">
                    Projetos <Count value={query.data.events.length} />
                  </TabsTrigger>
                  <TabsTrigger value="tasks">
                    Tarefas <Count value={query.data.tasks.length} />
                  </TabsTrigger>
                  <TabsTrigger value="resources">Recursos</TabsTrigger>
                  <TabsTrigger value="team">Equipe</TabsTrigger>
                  <TabsTrigger value="history">Histórico</TabsTrigger>
                </TabsList>
                <TabsContent
                  value="overview"
                  className="min-h-0 overflow-y-auto pt-6"
                >
                  <OverviewGrid
                    items={[
                      [
                        'Responsável',
                        query.data.product.ownerName ?? 'Não definido',
                      ],
                      ['Status', statusLabel(query.data.product.status)],
                      [
                        'Atualizado',
                        formatDateTime(query.data.product.updatedAt),
                      ],
                    ]}
                  />
                  <TextSection
                    title="Descrição"
                    value={query.data.product.description}
                  />
                </TabsContent>
                <TabsContent value="events" className="pt-6">
                  <EventRelationList items={query.data.events} />
                </TabsContent>
                <TabsContent
                  value="tasks"
                  className="min-h-0 overflow-y-auto pt-6"
                >
                  <TaskList items={query.data.tasks} />
                </TabsContent>
                <TabsContent
                  value="resources"
                  className="min-h-0 overflow-y-auto pt-6"
                >
                  <ResourceList items={query.data.resources} />
                </TabsContent>
                <TabsContent
                  value="team"
                  className="min-h-0 overflow-y-auto pt-6"
                >
                  <TeamList items={query.data.team} />
                </TabsContent>
                <TabsContent
                  value="history"
                  className="min-h-0 overflow-y-auto pt-6"
                >
                  <HistoryList items={query.data.history} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
      {query.data ? (
        <ProductEditorDialog
          key={`${query.data.product.id}-${query.data.product.version}`}
          open={editOpen}
          onOpenChange={setEditOpen}
          workspaceId={props.workspaceId}
          members={props.members}
          detail={query.data}
          onSaved={props.onSaved}
        />
      ) : null}
      {productId ? (
        <ContextTaskDialog
          open={taskOpen}
          onOpenChange={setTaskOpen}
          workspaceId={props.workspaceId}
          contextType="product"
          contextId={productId}
          members={props.members}
          statuses={props.statuses}
        />
      ) : null}
    </>
  );
}

export function DetailLoading() {
  return (
    <div className="flex min-h-72 items-center justify-center">
      <LoaderCircle
        aria-label="Carregando detalhes"
        className="size-6 animate-spin text-muted-foreground"
      />
    </div>
  );
}
export function DetailError() {
  return (
    <div className="px-6 py-20 text-center">
      <p className="font-medium">Não foi possível abrir este item.</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Atualize a página e tente novamente.
      </p>
    </div>
  );
}
export function Count({ value }: { value: number }) {
  return (
    <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">
      {value}
    </span>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-border px-4 py-2 first:border-0">
      <span className="block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <strong className="mt-1 block text-lg font-semibold text-foreground">
        {value}
      </strong>
    </div>
  );
}

export function StatusBadge({ value }: { value: string }) {
  return <Badge variant="outline">{statusLabel(value)}</Badge>;
}
export function HealthStateBadge({
  value,
}: {
  value: 'healthy' | 'attention' | 'risk';
}) {
  const presentation = {
    healthy: ['Saudável', 'border-emerald-200 bg-emerald-50 text-emerald-800'],
    attention: ['Atenção', 'border-amber-200 bg-amber-50 text-amber-800'],
    risk: ['Risco', 'border-red-200 bg-red-50 text-red-800'],
  } as const;
  return (
    <Badge variant="outline" className={presentation[value][1]}>
      {presentation[value][0]}
    </Badge>
  );
}
function statusLabel(value: string) {
  return (
    (
      {
        planning: 'Planejamento',
        active: 'Ativo',
        paused: 'Pausado',
        completed: 'Concluído',
        cancelled: 'Cancelado',
      } as Record<string, string>
    )[value] ?? value
  );
}
function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${value}T12:00:00Z`))
    : 'Não definida';
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
export function formatRange(start: string | null, end: string | null) {
  if (!start && !end) return 'Período não definido';
  if (start && end)
    return start === end
      ? formatDate(start)
      : `${formatDate(start)} a ${formatDate(end)}`;
  return start ? `A partir de ${formatDate(start)}` : `Até ${formatDate(end)}`;
}

function OverviewGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid border-y sm:grid-cols-2">
      {items.map(([label, value], index) => (
        <div
          key={label}
          className={`py-4 ${index % 2 ? 'sm:border-l sm:pl-5' : 'sm:pr-5'} ${index > 1 ? 'border-t' : ''}`}
        >
          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="mt-1 [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function TextSection({
  title,
  value,
}: {
  title: string;
  value: string | null;
}) {
  return (
    <section className="mt-7">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h3>
      <p className="mt-3 whitespace-pre-wrap leading-7 [overflow-wrap:anywhere]">
        {value || 'Ainda não informado.'}
      </p>
    </section>
  );
}

export function TaskList({
  items,
}: {
  items: Array<{
    id: string;
    taskNumber: number;
    title: string;
    statusName: string;
    assigneeName: string | null;
    dueDate: string | null;
  }>;
}) {
  if (!items.length)
    return <EmptyLine icon={ListChecks} text="Nenhuma tarefa relacionada." />;
  return (
    <ul className="divide-y border-y">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/tarefa/${item.id}`}
            className="group flex min-h-16 items-center justify-between gap-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{item.statusName}</p>
              <p className="mt-1 truncate font-medium group-hover:text-primary">
                {item.title}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {item.assigneeName ?? formatDate(item.dueDate)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ProjectTaskBoard({
  items,
  statuses,
}: {
  items: PortfolioTask[];
  statuses: TaskStatus[];
}) {
  const tasksByStatus = items.reduce((result, item) => {
    const group = result.get(item.statusName) ?? [];
    group.push(item);
    result.set(item.statusName, group);
    return result;
  }, new Map<string, PortfolioTask[]>());
  const groups = statuses.length
    ? statuses.map(
        (status) =>
          [status.name, tasksByStatus.get(status.name) ?? []] as const,
      )
    : Array.from(tasksByStatus);

  if (!groups.length)
    return <EmptyLine icon={LayoutGrid} text="Nenhuma tarefa neste projeto." />;

  return (
    <div className="-mx-4 flex h-full min-h-0 flex-col sm:-mx-6">
      <TaskBoardViewport label="Tarefas do projeto por status">
        {groups.map(([status, tasks], index) => (
          <TaskBoardColumn
            key={status}
            ref={null}
            id={`project-status-${index}`}
            title={status === 'Bloqueada' ? 'Revisão' : status}
            count={tasks.length}
            isOver={false}
          >
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={`/tarefa/${task.id}`}
                className="pta-task-card block rounded-xl border bg-card p-4 transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="text-base font-semibold leading-6 [overflow-wrap:anywhere]">
                  {task.title}
                </p>
                <div className="mt-3">
                  <PriorityDot value={task.priority} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/55 pt-3 text-xs text-muted-foreground">
                  <span className="truncate">
                    {task.assigneeName ?? 'Sem responsável'}
                  </span>
                  <span className="shrink-0">{formatDate(task.dueDate)}</span>
                </div>
              </Link>
            ))}
            {!tasks.length ? (
              <TaskBoardEmpty>Nenhuma tarefa aqui.</TaskBoardEmpty>
            ) : null}
          </TaskBoardColumn>
        ))}
      </TaskBoardViewport>
    </div>
  );
}

function PriorityDot({ value }: { value: PortfolioTask['priority'] }) {
  const labels = {
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
    urgent: 'Urgente',
  } as const;
  const colors = {
    low: 'bg-slate-400',
    medium: 'bg-amber-400',
    high: 'bg-orange-500',
    urgent: 'bg-red-500',
  } as const;
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`size-2 rounded-full ${colors[value]}`} />
      {labels[value]}
    </span>
  );
}
export function ResourceList({
  items,
}: {
  items: Array<{ id: string; title: string; type: string }>;
}) {
  if (!items.length)
    return <EmptyLine icon={FileText} text="Nenhum recurso relacionado." />;
  return (
    <ul className="divide-y border-y">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/recursos?recurso=${item.id}`}
            className="flex min-h-14 items-center justify-between gap-4 py-3 font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="[overflow-wrap:anywhere]">{item.title}</span>
            <Badge variant="outline">{item.type}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}
export function TeamList({
  items,
}: {
  items: Array<{ id: string; name: string; roleLabel: string | null }>;
}) {
  if (!items.length)
    return (
      <EmptyLine icon={UsersRound} text="Nenhuma pessoa adicionada à equipe." />
    );
  return (
    <ul className="divide-y border-y">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex min-h-14 items-center justify-between gap-4 py-3"
        >
          <span className="font-medium">{item.name}</span>
          <span className="text-xs text-muted-foreground">
            {item.roleLabel ?? 'Equipe'}
          </span>
        </li>
      ))}
    </ul>
  );
}
export function HistoryList({
  items,
}: {
  items: Array<{
    id: string;
    action: string;
    actorName: string | null;
    createdAt: string;
  }>;
}) {
  if (!items.length)
    return (
      <EmptyLine icon={CalendarDays} text="Nenhuma atividade registrada." />
    );
  return (
    <ol className="border-l pl-5">
      {items.map((item) => (
        <li
          key={item.id}
          className="relative pb-6 before:absolute before:-left-[25px] before:top-1 before:size-2 before:rounded-full before:bg-primary"
        >
          <p className="font-medium">{activityLabel(item.action)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.actorName ?? 'Sistema'} · {formatDateTime(item.createdAt)}
          </p>
        </li>
      ))}
    </ol>
  );
}
function EventRelationList({
  items,
}: {
  items: Array<{
    id: string;
    name: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
  }>;
}) {
  if (!items.length)
    return <EmptyLine icon={CalendarDays} text="Nenhum projeto relacionado." />;
  return (
    <ul className="divide-y border-y">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/projetos/${item.id}`}
            className="flex min-h-16 items-center justify-between gap-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatRange(item.startDate, item.endDate)}
              </p>
            </div>
            <StatusBadge value={item.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
function EmptyLine({
  icon: Icon,
  text,
}: {
  icon: typeof FileText;
  text: string;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center border-y text-center text-sm text-muted-foreground">
      <Icon aria-hidden="true" className="mb-3 size-5" />
      {text}
    </div>
  );
}
function activityLabel(action: string) {
  return (
    (
      {
        'event.created': 'Projeto criado',
        'event.updated': 'Projeto atualizado',
        'event.milestone_created': 'Marco criado',
        'event.milestone_completed': 'Marco concluído',
        'event.milestone_reopened': 'Marco reaberto',
        'product.created': 'Produto criado',
        'product.updated': 'Produto atualizado',
      } as Record<string, string>
    )[action] ?? 'Atividade registrada'
  );
}

export function MilestoneList({
  workspaceId,
  eventId,
  items,
  canEdit,
}: {
  workspaceId: string;
  eventId: string;
  items: Array<{
    id: string;
    title: string;
    dueDate: string | null;
    completedAt: string | null;
    phase: string;
    version: number;
  }>;
  canEdit: boolean;
}) {
  const client = useQueryClient();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  if (!items.length)
    return <EmptyLine icon={Circle} text="Nenhum marco definido." />;
  async function toggle(item: (typeof items)[number]) {
    setPendingId(item.id);
    const result = await createClient().rpc('toggle_event_milestone', {
      p_milestone_id: item.id,
      p_expected_version: item.version,
      p_completed: !item.completedAt,
    });
    setPendingId(null);
    if (result.error) {
      toast.error('Não foi possível atualizar o marco.');
      return;
    }
    await Promise.all([
      client.invalidateQueries({
        queryKey: portfolioKeys.event(workspaceId, eventId),
      }),
      client.invalidateQueries({
        queryKey: portfolioKeys.timeline(workspaceId, eventId),
      }),
    ]);
    router.refresh();
  }
  return (
    <ol className="divide-y border-y">
      {items.map((item) => (
        <li key={item.id} className="flex min-h-16 items-center gap-3 py-3">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={!canEdit || pendingId === item.id}
            aria-label={
              item.completedAt
                ? `Reabrir ${item.title}`
                : `Concluir ${item.title}`
            }
            onClick={() => void toggle(item)}
          >
            {pendingId === item.id ? (
              <LoaderCircle className="animate-spin" />
            ) : item.completedAt ? (
              <Check />
            ) : (
              <Circle />
            )}
          </Button>
          <div className="min-w-0">
            <p
              className={`font-medium [overflow-wrap:anywhere] ${item.completedAt ? 'text-muted-foreground line-through' : ''}`}
            >
              {item.title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(item.dueDate)} · {item.phase}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ContextTaskDialog({
  open,
  onOpenChange,
  workspaceId,
  contextType,
  contextId,
  members,
  statuses = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  contextType: 'event' | 'product';
  contextId: string;
  members: WorkspaceMember[];
  statuses?: TaskStatus[];
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('none');
  const [statusId, setStatusId] = useState('default');
  const [priority, setPriority] = useState<
    'low' | 'medium' | 'high' | 'urgent'
  >('medium');
  const [pending, setPending] = useState(false);
  async function submit() {
    if (title.trim().length < 3) return;
    setPending(true);
    const result = await createClient().rpc('create_context_task', {
      p_workspace_id: workspaceId,
      p_context_type: contextType,
      p_context_id: contextId,
      p_title: title.trim(),
      p_status_id: statusId === 'default' ? undefined : statusId,
      p_priority: priority,
      p_due_date: dueDate || undefined,
      p_primary_assignee_id: assigneeId === 'none' ? undefined : assigneeId,
    });
    setPending(false);
    if (result.error) {
      toast.error('Não foi possível criar a tarefa.');
      return;
    }
    await queryClient.invalidateQueries({
      queryKey:
        contextType === 'event'
          ? portfolioKeys.event(workspaceId, contextId)
          : portfolioKeys.product(workspaceId, contextId),
    });
    toast.success('Demanda criada no contexto.');
    setTitle('');
    onOpenChange(false);
    router.refresh();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>
            A relação com este {contextType === 'event' ? 'projeto' : 'produto'}{' '}
            será aplicada automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={`${contextType}-task-title`}>Título</Label>
            <Input
              id={`${contextType}-task-title`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              minLength={3}
              maxLength={180}
              autoFocus
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${contextType}-task-status`}>
                Status inicial
              </Label>
              <Select value={statusId} onValueChange={setStatusId}>
                <SelectTrigger
                  id={`${contextType}-task-status`}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Status padrão</SelectItem>
                  {statuses
                    .filter((status) => status.category !== 'blocked')
                    .map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${contextType}-task-priority`}>Prioridade</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as typeof priority)}
              >
                <SelectTrigger
                  id={`${contextType}-task-priority`}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${contextType}-task-date`}>Prazo</Label>
              <Input
                id={`${contextType}-task-date`}
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${contextType}-task-owner`}>Responsável</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger
                  id={`${contextType}-task-owner`}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || title.trim().length < 3}>
              {pending ? <LoaderCircle className="animate-spin" /> : null}Criar
              tarefa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MilestoneDialog({
  open,
  onOpenChange,
  workspaceId,
  eventId,
  initialPhase = 'preparation',
  phases,
  initialPhaseId = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  eventId: string;
  initialPhase?: string;
  phases?: ProjectPhase[];
  initialPhaseId?: string | null;
}) {
  const client = useQueryClient();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [phaseId, setPhaseId] = useState(initialPhaseId ?? 'none');
  const [pending, setPending] = useState(false);
  async function submit() {
    if (title.trim().length < 2) return;
    setPending(true);
    let result = phases
      ? await createClient().rpc('create_event_milestone_in_phase', {
          p_workspace_id: workspaceId,
          p_event_id: eventId,
          p_event_phase_id: phaseId === 'none' ? null : phaseId,
          p_title: title.trim(),
          p_due_date: dueDate || null,
        })
      : await createClient().rpc('create_event_milestone', {
          p_event_id: eventId,
          p_title: title.trim(),
          p_due_date: dueDate || undefined,
          p_phase: initialPhase,
        });
    if (
      phases &&
      result.error &&
      /create_event_milestone_in_phase|function.*does not exist|schema cache/i.test(
        result.error.message,
      )
    ) {
      result = await createClient().rpc('create_event_milestone', {
        p_event_id: eventId,
        p_title: title.trim(),
        p_due_date: dueDate || undefined,
        p_phase: initialPhase,
      });
    }
    setPending(false);
    if (result.error) {
      toast.error('Não foi possível criar o marco.');
      return;
    }
    await Promise.all([
      client.invalidateQueries({
        queryKey: portfolioKeys.event(workspaceId, eventId),
      }),
      client.invalidateQueries({
        queryKey: portfolioKeys.timeline(workspaceId, eventId),
      }),
    ]);
    toast.success('Marco criado.');
    setTitle('');
    onOpenChange(false);
    router.refresh();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo marco</DialogTitle>
          <DialogDescription>
            Registre uma entrega ou mudança importante no ciclo do projeto.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="milestone-title">Título</Label>
            <Input
              id="milestone-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
              minLength={2}
              maxLength={180}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="milestone-date">Data opcional</Label>
            <Input
              id="milestone-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Você pode deixar sem data enquanto o planejamento ainda estiver
              aberto.
            </p>
          </div>
          {phases ? (
            <div className="space-y-2">
              <Label htmlFor="milestone-phase">Fase do projeto</Label>
              <Select value={phaseId} onValueChange={setPhaseId}>
                <SelectTrigger id="milestone-phase">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem fase</SelectItem>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs leading-5 text-muted-foreground">
                Use fases para separar, por exemplo, início e encerramento da
                captação ou das vendas.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || title.trim().length < 2}>
              {pending ? <LoaderCircle className="animate-spin" /> : null}Criar
              marco
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
