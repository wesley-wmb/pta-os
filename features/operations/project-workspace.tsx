'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQueryClient } from '@tanstack/react-query';
import { addMonths } from 'date-fns';
import {
  Activity,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  FileText,
  GripVertical,
  LayoutGrid,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Target,
  Trash2,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  calendarMonthGridKeys,
  currentDateInTimeZone,
  dateFromKey,
  toDateKey,
} from '@/features/tasks/date-utils';
import { useTasks } from '@/features/tasks/queries';
import type { TaskStatus } from '@/features/tasks/types';
import { ProjectTaskKanban } from '@/features/tasks/task-pipeline';
import type {
  WorkspaceMember,
  WorkspaceRole,
} from '@/features/workspace/types';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

import {
  ContextTaskDialog,
  Count,
  DetailError,
  DetailLoading,
  HealthStateBadge,
  HistoryList,
  MilestoneDialog,
  ResourceList,
  StatusBadge,
  TaskList,
  TeamList,
} from './portfolio-detail-sheet';
import {
  portfolioKeys,
  useEventDetail,
  useProjectTimeline,
} from './portfolio-queries';
import {
  getPhaseArchiveErrorMessage,
  getPhaseCreationErrorMessage,
  getPhaseUpdateErrorMessage,
} from './project-timeline-errors';
import { ProjectOverview } from './project-overview';
import {
  ProjectTimeline,
  type TimelineMilestoneChange,
} from './project-timeline';
import { TimelineMilestoneDialog } from './timeline-milestone-dialog';
import {
  defaultProjectViewLayout,
  hiddenProjectViews,
  hideProjectView,
  normalizeProjectViewLayout,
  projectViewLayoutPreferenceKey,
  reorderVisibleProjectViews,
  showProjectView,
  visibleProjectViews,
  type ProjectView,
  type ProjectViewLayout,
} from './project-view-layout';
import { eventFormSchema, portfolioMutationSchema } from './portfolio-schemas';
import type {
  EventDetail,
  EventMilestone,
  PortfolioTask,
  ProjectPhase,
  ProductSummary,
} from './types';

const views: Array<{
  value: ProjectView;
  label: string;
  icon: typeof LayoutGrid;
}> = [
  { value: 'overview', label: 'Visão geral', icon: Target },
  { value: 'board', label: 'Quadro', icon: LayoutGrid },
  { value: 'list', label: 'Lista', icon: ListChecks },
  { value: 'timeline', label: 'Cronograma', icon: CalendarRange },
  { value: 'calendar', label: 'Calendário', icon: CalendarDays },
  { value: 'resources', label: 'Recursos', icon: FileText },
  { value: 'team', label: 'Equipe', icon: UsersRound },
  { value: 'activity', label: 'Atividade', icon: Activity },
  { value: 'settings', label: 'Configurações', icon: Settings2 },
];

function projectViewPreferenceKey(
  userId: string,
  workspaceId: string,
  projectId: string,
) {
  return `pta-project-view:${userId}:${workspaceId}:${projectId}`;
}

const PROJECT_VIEW_EVENT = 'pta-project-view-change';
const PROJECT_VIEW_LAYOUT_EVENT = 'pta-project-view-layout-change';

function subscribeToProjectView(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(PROJECT_VIEW_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(PROJECT_VIEW_EVENT, onStoreChange);
  };
}

function subscribeToProjectViewLayout(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(PROJECT_VIEW_LAYOUT_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(PROJECT_VIEW_LAYOUT_EVENT, onStoreChange);
  };
}

function readProjectViewLayout(value: string | null) {
  if (!value) return defaultProjectViewLayout;
  try {
    return normalizeProjectViewLayout(JSON.parse(value));
  } catch {
    return defaultProjectViewLayout;
  }
}

function subscribeToClientEnvironment() {
  return () => undefined;
}

export function ProjectWorkspace({
  projectId,
  initialData,
  workspaceId,
  members,
  products,
  statuses,
  currentUserId,
  workspaceRole,
  timezone,
  taskPrefix,
}: {
  projectId: string;
  initialData: EventDetail;
  workspaceId: string;
  members: WorkspaceMember[];
  products: ProductSummary[];
  statuses: TaskStatus[];
  currentUserId: string;
  workspaceRole: WorkspaceRole;
  timezone: string;
  taskPrefix: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedView = searchParams.get('visao');
  const initialView = views.some((view) => view.value === requestedView)
    ? (requestedView as ProjectView)
    : 'overview';
  const view = initialView;
  const [taskOpen, setTaskOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const [assignee, setAssignee] = useState('all');
  const viewLayoutKey = useMemo(
    () => projectViewLayoutPreferenceKey(currentUserId, workspaceId, projectId),
    [currentUserId, projectId, workspaceId],
  );
  const serializedViewLayout = useSyncExternalStore(
    subscribeToProjectViewLayout,
    useCallback(() => {
      try {
        return window.localStorage.getItem(viewLayoutKey);
      } catch {
        return null;
      }
    }, [viewLayoutKey]),
    () => null,
  );
  const viewLayout = useMemo(
    () => readProjectViewLayout(serializedViewLayout),
    [serializedViewLayout],
  );
  const hasHydrated = useSyncExternalStore(
    subscribeToClientEnvironment,
    () => true,
    () => false,
  );
  const deferredTaskSearch = useDeferredValue(taskSearch);
  const query = useEventDetail(workspaceId, projectId, initialData);

  const navigateToView = useCallback(
    (nextView: ProjectView) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextView === 'overview') params.delete('visao');
      else params.set('visao', nextView);
      const suffix = params.toString();
      router.replace(`/projetos/${projectId}${suffix ? `?${suffix}` : ''}`, {
        scroll: false,
      });
    },
    [projectId, router, searchParams],
  );

  const commitViewLayout = useCallback(
    (nextLayout: ProjectViewLayout) => {
      try {
        window.localStorage.setItem(viewLayoutKey, JSON.stringify(nextLayout));
        window.dispatchEvent(new Event(PROJECT_VIEW_LAYOUT_EVENT));
      } catch {
        toast.error('Não foi possível salvar a organização das abas.');
      }
    },
    [viewLayoutKey],
  );

  useEffect(() => {
    if (!hasHydrated || requestedView) return;
    try {
      const saved = window.localStorage.getItem(
        projectViewPreferenceKey(currentUserId, workspaceId, projectId),
      );
      if (
        saved &&
        saved !== 'overview' &&
        views.some((item) => item.value === saved) &&
        !viewLayout.hidden.includes(saved as ProjectView)
      ) {
        router.replace(`/projetos/${projectId}?visao=${saved}`, {
          scroll: false,
        });
      }
    } catch {
      // Uma preferência local inválida não impede a abertura do projeto.
    }
  }, [
    currentUserId,
    hasHydrated,
    projectId,
    requestedView,
    router,
    viewLayout,
    workspaceId,
  ]);

  useEffect(() => {
    if (!hasHydrated || !viewLayout.hidden.includes(view)) return;
    navigateToView(visibleProjectViews(viewLayout)[0] ?? 'overview');
  }, [hasHydrated, navigateToView, view, viewLayout]);
  const assignableMembers =
    workspaceRole === 'member'
      ? members.filter((member) => member.id === currentUserId)
      : members;

  const filteredTasks = useMemo(() => {
    const normalizedSearch = deferredTaskSearch
      .trim()
      .toLocaleLowerCase('pt-BR');
    return (query.data?.tasks ?? []).filter((task) => {
      if (assignee !== 'all' && task.assigneeName !== assignee) return false;
      if (!normalizedSearch) return true;
      return [task.title, task.statusName, task.assigneeName]
        .filter(Boolean)
        .some((value) =>
          value!.toLocaleLowerCase('pt-BR').includes(normalizedSearch),
        );
    });
  }, [assignee, deferredTaskSearch, query.data?.tasks]);

  const assignees = useMemo(
    () =>
      [
        ...new Set(
          (query.data?.tasks ?? []).flatMap((task) => task.assigneeName ?? []),
        ),
      ].sort((left, right) => left.localeCompare(right, 'pt-BR')),
    [query.data?.tasks],
  );

  function changeView(nextView: string) {
    const safeView = nextView as ProjectView;
    if (!views.some((item) => item.value === safeView)) return;
    if (viewLayout.hidden.includes(safeView)) {
      commitViewLayout(showProjectView(viewLayout, safeView));
    }
    navigateToView(safeView);
  }

  function moveView(active: ProjectView, over: ProjectView) {
    commitViewLayout(reorderVisibleProjectViews(viewLayout, active, over));
  }

  function restoreView(restoredView: ProjectView) {
    const nextLayout = showProjectView(viewLayout, restoredView);
    if (nextLayout === viewLayout) return;
    commitViewLayout(nextLayout);
  }

  function hideView(hiddenView: ProjectView) {
    const label = views.find((item) => item.value === hiddenView)?.label;
    const nextLayout = hideProjectView(viewLayout, hiddenView);
    if (nextLayout === viewLayout) return;

    commitViewLayout(nextLayout);
    if (view === hiddenView) {
      navigateToView(visibleProjectViews(nextLayout)[0] ?? 'overview');
    }
    toast.success(`${label ?? 'Aba'} ocultada.`, {
      action: {
        label: 'Desfazer',
        onClick: () =>
          commitViewLayout(showProjectView(nextLayout, hiddenView)),
      },
    });
  }

  function openMilestone() {
    setMilestoneOpen(true);
  }

  if (query.isPending) return <DetailLoading />;
  if (query.isError || !query.data) return <DetailError />;

  const detail = query.data;
  return (
    <div className="flex min-h-full min-w-0 flex-col">
      <header className="border-b bg-background/95">
        <div className="px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 basis-64 items-center gap-2.5">
              <Link
                href="/projetos"
                aria-label="Voltar para projetos"
                className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LayoutGrid aria-hidden="true" className="size-4" />
              </Link>
              <h1 className="min-w-0 truncate text-lg font-semibold tracking-[-0.02em]">
                {detail.event.name}
              </h1>
              <div className="flex shrink-0 items-center gap-1.5">
                <StatusBadge value={detail.event.status} />
                {detail.event.totalTasks === 0 &&
                detail.event.healthOverride === null ? null : (
                  <HealthStateBadge value={detail.event.health} />
                )}
              </div>
            </div>

            <div className="flex shrink-0 justify-end">
              {detail.capabilities.canEdit ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => changeView('settings')}
                >
                  <Pencil aria-hidden="true" />
                  Personalizar
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <Tabs value={view} onValueChange={changeView} className="gap-0">
          <ProjectViewTabs
            layout={viewLayout}
            taskCount={detail.tasks.length}
            onActivate={changeView}
            onHide={hideView}
            onMove={moveView}
            onShow={restoreView}
          />
        </Tabs>
      </header>

      <Tabs value={view} onValueChange={changeView} className="min-h-0 flex-1">
        <div
          className={cn(
            'px-4 sm:px-6',
            ['timeline', 'board', 'list'].includes(view) ? 'pt-0' : 'py-6',
          )}
        >
          {view === 'board' || view === 'list' ? (
            <TaskToolbar
              search={taskSearch}
              setSearch={setTaskSearch}
              assignee={assignee}
              setAssignee={setAssignee}
              assignees={assignees}
              total={filteredTasks.length}
              onAddTask={
                workspaceRole !== 'viewer' ? () => setTaskOpen(true) : undefined
              }
            />
          ) : null}

          <TabsContent value="overview" className="mt-0">
            <ProjectOverview
              detail={detail}
              onAddTask={() => setTaskOpen(true)}
              onAddMilestone={() => openMilestone()}
              onOpenList={() => changeView('list')}
            />
          </TabsContent>
          <TabsContent
            value="board"
            className="-mx-4 mt-0 flex h-[calc(100dvh-220px)] min-h-[420px] flex-col sm:-mx-6"
          >
            <ProjectTaskKanban
              projectId={projectId}
              workspaceId={workspaceId}
              currentUserId={currentUserId}
              timezone={timezone}
              role={workspaceRole}
              statuses={statuses}
              taskPrefix={taskPrefix}
              members={members}
              search={deferredTaskSearch}
              assigneeName={assignee}
            />
          </TabsContent>
          <TabsContent value="list" className="mt-5">
            <TaskList items={filteredTasks} />
          </TabsContent>
          <TabsContent value="timeline" className="mt-0">
            <ProjectRoadmap
              workspaceId={workspaceId}
              projectId={projectId}
              tasks={detail.tasks}
              statuses={statuses}
              milestones={detail.milestones}
              projectStart={detail.event.startDate}
              projectEnd={detail.event.endDate}
              canEdit={detail.capabilities.canEdit}
              today={currentDateInTimeZone(timezone)}
              onAddTask={() => setTaskOpen(true)}
            />
          </TabsContent>
          <TabsContent value="calendar" className="mt-0">
            <ProjectCalendar
              items={detail.tasks}
              today={currentDateInTimeZone(timezone)}
            />
          </TabsContent>
          <TabsContent value="resources" className="mt-0">
            <SectionHeading
              title="Recursos"
              description="Links, documentos e referências relacionados ao projeto."
              action={{ label: 'Abrir central', href: '/recursos' }}
            />
            <ResourceList items={detail.resources} />
          </TabsContent>
          <TabsContent value="team" className="mt-0">
            <SectionHeading
              title="Equipe do projeto"
              description="Pessoas responsáveis pela execução e acompanhamento."
              action={
                detail.capabilities.canEdit
                  ? {
                      label: 'Configurar equipe',
                      onClick: () => changeView('settings'),
                    }
                  : undefined
              }
            />
            <TeamList items={detail.team} />
          </TabsContent>
          <TabsContent value="activity" className="mt-0">
            <SectionHeading
              title="Atividade"
              description="Histórico das mudanças importantes deste projeto."
            />
            <HistoryList items={detail.history} />
          </TabsContent>
          <TabsContent value="settings" className="mt-0">
            <ProjectSettings
              key={`${detail.event.id}-${detail.event.version}`}
              detail={detail}
              workspaceId={workspaceId}
              currentUserId={currentUserId}
              members={members}
              products={products}
              onNavigate={changeView}
            />
          </TabsContent>
        </div>
      </Tabs>

      <ContextTaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        workspaceId={workspaceId}
        contextType="event"
        contextId={projectId}
        members={assignableMembers}
        statuses={statuses}
      />
      <MilestoneDialog
        key={milestoneOpen ? 'open' : 'closed'}
        open={milestoneOpen}
        onOpenChange={setMilestoneOpen}
        workspaceId={workspaceId}
        eventId={projectId}
      />
    </div>
  );
}

const PROJECT_TAB_SCREEN_READER_INSTRUCTIONS = {
  draggable:
    'Para reordenar uma aba, pressione espaço. Use as setas para escolher a nova posição e pressione espaço novamente para confirmar.',
};

const PROJECT_TAB_ANNOUNCEMENTS = {
  onDragStart: ({ active }: { active: { id: string | number } }) =>
    `${projectViewLabel(active.id)} selecionada.`,
  onDragOver: ({
    active,
    over,
  }: {
    active: { id: string | number };
    over: { id: string | number } | null;
  }) =>
    over
      ? `${projectViewLabel(active.id)} antes de ${projectViewLabel(over.id)}.`
      : `${projectViewLabel(active.id)} fora da faixa de abas.`,
  onDragEnd: ({
    active,
    over,
  }: {
    active: { id: string | number };
    over: { id: string | number } | null;
  }) =>
    over
      ? `${projectViewLabel(active.id)} movida para a posição de ${projectViewLabel(over.id)}.`
      : `Movimento de ${projectViewLabel(active.id)} cancelado.`,
  onDragCancel: ({ active }: { active: { id: string | number } }) =>
    `Movimento de ${projectViewLabel(active.id)} cancelado.`,
};

function ProjectViewTabs({
  layout,
  taskCount,
  onActivate,
  onHide,
  onMove,
  onShow,
}: {
  layout: ProjectViewLayout;
  taskCount: number;
  onActivate: (view: ProjectView) => void;
  onHide: (view: ProjectView) => void;
  onMove: (active: ProjectView, over: ProjectView) => void;
  onShow: (view: ProjectView) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const visibleValues = visibleProjectViews(layout);
  const hiddenValues = hiddenProjectViews(layout);
  const visibleItems = visibleValues.flatMap((value) => {
    const item = views.find((view) => view.value === value);
    return item ? [item] : [];
  });
  const hiddenItems = hiddenValues.flatMap((value) => {
    const item = views.find((view) => view.value === value);
    return item ? [item] : [];
  });

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over) return;
    onMove(event.active.id as ProjectView, event.over.id as ProjectView);
  }

  return (
    <DndContext
      id="project-view-tabs"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{
        screenReaderInstructions: PROJECT_TAB_SCREEN_READER_INSTRUCTIONS,
        announcements: PROJECT_TAB_ANNOUNCEMENTS,
      }}
    >
      <div className="flex min-w-0 items-center">
        <TabsList
          variant="line"
          className="pta-tabs-scroll h-9 min-w-0 flex-1 justify-start overflow-x-auto pr-0 pl-4 sm:pl-6"
        >
          <SortableContext
            items={visibleValues}
            strategy={horizontalListSortingStrategy}
          >
            {visibleItems.map((item) => (
              <SortableProjectTab
                key={item.value}
                item={item}
                taskCount={taskCount}
                canHide={visibleItems.length > 1}
                onActivate={onActivate}
                onHide={onHide}
              />
            ))}
          </SortableContext>
        </TabsList>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="mx-2 sm:mr-4"
              disabled={hiddenItems.length === 0}
              aria-label={
                hiddenItems.length
                  ? 'Adicionar aba'
                  : 'Todas as abas estão visíveis'
              }
              title={
                hiddenItems.length
                  ? 'Adicionar aba'
                  : 'Todas as abas estão visíveis'
              }
            >
              <Plus aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {hiddenItems.map((item) => (
              <DropdownMenuItem
                key={item.value}
                onSelect={() => onShow(item.value)}
              >
                <item.icon aria-hidden="true" />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </DndContext>
  );
}

function SortableProjectTab({
  item,
  taskCount,
  canHide,
  onActivate,
  onHide,
}: {
  item: (typeof views)[number];
  taskCount: number;
  canHide: boolean;
  onActivate: (view: ProjectView) => void;
  onHide: (view: ProjectView) => void;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: item.value,
    data: { label: item.label },
  });
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={{
            transform: CSS.Transform.toString(transform),
            transition,
          }}
          className={cn(
            'relative inline-flex h-full shrink-0 items-center motion-reduce:!transition-none',
            isDragging && 'z-10 bg-card/90 opacity-80 shadow-lg',
          )}
        >
          <TabsTrigger
            value={item.value}
            className="h-full pr-7"
            title="Clique com o botão direito para ocultar."
            onClick={() => onActivate(item.value)}
          >
            <item.icon aria-hidden="true" />
            {item.label}
            {item.value === 'board' || item.value === 'list' ? (
              <Count value={taskCount} />
            ) : null}
          </TabsTrigger>
          <button
            ref={setActivatorNodeRef}
            type="button"
            className="absolute right-1 inline-flex size-6 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/65 transition-colors hover:bg-interactive hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            aria-label={`Reordenar aba ${item.label}`}
            title={`Reordenar aba ${item.label}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent aria-label={`Opções de ${item.label}`}>
        <ContextMenuItem
          disabled={!canHide}
          onSelect={() => onHide(item.value)}
        >
          <EyeOff aria-hidden="true" />
          Ocultar aba
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function projectViewLabel(id: string | number) {
  return views.find((view) => view.value === String(id))?.label ?? 'Aba';
}

function TaskToolbar({
  search,
  setSearch,
  assignee,
  setAssignee,
  assignees,
  total,
  onAddTask,
}: {
  search: string;
  setSearch: (value: string) => void;
  assignee: string;
  setAssignee: (value: string) => void;
  assignees: string[];
  total: number;
  onAddTask?: () => void;
}) {
  return (
    <div className="-mx-4 flex min-h-14 flex-wrap items-center gap-2 border-b px-4 py-2 sm:-mx-6 sm:px-6">
      {onAddTask ? (
        <Button variant="outline" size="sm" onClick={onAddTask}>
          <Plus aria-hidden="true" />
          Adicionar uma tarefa
        </Button>
      ) : null}
      <span className="mr-auto text-xs tabular-nums text-muted-foreground">
        {total} {total === 1 ? 'tarefa' : 'tarefas'}
      </span>
      <div className="relative min-w-40 flex-1 sm:max-w-64">
        <Search
          aria-hidden="true"
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar tarefas neste projeto"
          aria-label="Buscar tarefas neste projeto"
          className="h-9 bg-transparent pl-9 shadow-none"
        />
      </div>
      <label className="sr-only" htmlFor="project-assignee-filter">
        Filtrar por responsável
      </label>
      <select
        id="project-assignee-filter"
        value={assignee}
        onChange={(event) => setAssignee(event.target.value)}
        className="h-9 max-w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="all">Todas as pessoas</option>
        {assignees.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}

function ProjectRoadmap({
  workspaceId,
  projectId,
  tasks,
  statuses,
  milestones,
  projectStart,
  projectEnd,
  canEdit,
  today,
  onAddTask,
}: {
  workspaceId: string;
  projectId: string;
  tasks: PortfolioTask[];
  statuses: TaskStatus[];
  milestones: EventMilestone[];
  projectStart: string | null;
  projectEnd: string | null;
  canEdit: boolean;
  today: string;
  onAddTask: () => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const timelineQuery = useProjectTimeline(workspaceId, projectId);
  const taskOverviewQuery = useTasks(workspaceId);
  const hasHydrated = useSyncExternalStore(
    subscribeToClientEnvironment,
    () => true,
    () => false,
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [timelineMilestoneOpen, setTimelineMilestoneOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] =
    useState<EventMilestone | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<
    ProjectPhase | 'new' | null
  >(null);
  const fallbackTasks = useMemo(() => {
    const overviews = (taskOverviewQuery.data ?? []).filter(
      (task) => task.event_id === projectId,
    );
    if (!overviews.length) return tasks;
    return overviews.map((task) => ({
      id: task.id,
      taskNumber: task.task_number,
      title: task.title,
      priority: task.priority,
      dueDate: task.due_date,
      dueTime: task.due_time,
      startDate: null,
      startTime: null,
      eventPhaseId: null,
      statusId: task.status_id,
      statusName: task.status_name,
      statusCategory: task.status_category,
      version: task.version,
      canEdit,
      assigneeId: task.primary_assignee_id,
      assigneeName: task.primary_assignee_name,
    }));
  }, [canEdit, projectId, taskOverviewQuery.data, tasks]);
  const timelineTasks =
    timelineQuery.data?.tasks ?? (hasHydrated ? fallbackTasks : tasks);
  const timelineMilestones = timelineQuery.data?.milestones ?? milestones;

  async function changeTaskTimeline({
    taskId,
    expectedVersion,
    patch,
  }: {
    taskId: string;
    expectedVersion: number;
    patch: {
      start_date?: string | null;
      start_time?: string | null;
      due_date?: string | null;
      due_time?: string | null;
      status_id?: string;
      event_phase_id?: string | null;
    };
  }) {
    const task = timelineTasks.find((item) => item.id === taskId);
    if (!task?.statusId) throw new Error('PTA_TIMELINE_TASK_NOT_READY');
    if (timelineQuery.isError) {
      if (
        patch.start_date !== undefined ||
        patch.event_phase_id !== undefined
      ) {
        toast.error(
          'O intervalo completo depende da atualização pendente do banco. Ainda é possível mover prazo e status.',
        );
        throw new Error('PTA_TIMELINE_RANGE_NOT_PUBLISHED');
      }
      const legacy = await createClient().rpc('update_task', {
        p_task_id: taskId,
        p_expected_version: expectedVersion,
        p_patch: {
          ...(patch.status_id ? { status_id: patch.status_id } : {}),
          ...(patch.due_date !== undefined ? { due_date: patch.due_date } : {}),
        },
      });
      if (legacy.error) {
        toast.error('Não foi possível alterar a tarefa no cronograma.');
        throw legacy.error;
      }
      await Promise.all([
        taskOverviewQuery.refetch(),
        queryClient.invalidateQueries({
          queryKey: portfolioKeys.event(workspaceId, projectId),
        }),
      ]);
      return;
    }
    const result = await createClient().rpc('move_task_in_timeline', {
      p_workspace_id: workspaceId,
      p_event_id: projectId,
      p_task_id: taskId,
      p_expected_version: expectedVersion,
      p_status_id: patch.status_id ?? task.statusId,
      p_event_phase_id:
        patch.event_phase_id !== undefined
          ? patch.event_phase_id
          : (task.eventPhaseId ?? null),
      p_start_date:
        patch.start_date !== undefined
          ? patch.start_date
          : (task.startDate ?? null),
      p_start_time:
        patch.start_time !== undefined
          ? patch.start_time
          : (task.startTime ?? null),
      p_due_date: patch.due_date !== undefined ? patch.due_date : task.dueDate,
      p_due_time:
        patch.due_time !== undefined ? patch.due_time : (task.dueTime ?? null),
    });
    if (result.error) {
      toast.error(
        result.error.message.includes('PTA_VERSION_CONFLICT')
          ? 'A tarefa mudou em outra sessão. O cronograma foi atualizado.'
          : 'Não foi possível alterar a tarefa no cronograma.',
      );
      await timelineQuery.refetch();
      throw result.error;
    }
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: portfolioKeys.timeline(workspaceId, projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: portfolioKeys.event(workspaceId, projectId),
      }),
    ]);
  }

  async function toggleMilestone(item: EventMilestone) {
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
    await queryClient.invalidateQueries({
      queryKey: portfolioKeys.event(workspaceId, projectId),
    });
    router.refresh();
  }

  async function changeMilestoneTimeline({
    milestoneId,
    expectedVersion,
    dueDate,
    eventPhaseId,
  }: TimelineMilestoneChange) {
    if (timelineQuery.isError) {
      toast.error(
        'Mover marcos depende da atualização pendente do banco. Recarregue após publicar as migrations do cronograma.',
      );
      throw new Error('PTA_TIMELINE_MILESTONE_BACKEND_NOT_PUBLISHED');
    }
    const result = await createClient().rpc(
      'move_event_milestone_in_timeline',
      {
        p_workspace_id: workspaceId,
        p_milestone_id: milestoneId,
        p_expected_version: expectedVersion,
        p_event_phase_id: eventPhaseId,
        p_due_date: dueDate,
      },
    );
    if (result.error) {
      toast.error(
        result.error.message.includes('PTA_VERSION_CONFLICT')
          ? 'O marco mudou em outra sessão. O cronograma foi atualizado.'
          : 'Não foi possível mover o marco no cronograma.',
      );
      await timelineQuery.refetch();
      throw result.error;
    }
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: portfolioKeys.timeline(workspaceId, projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: portfolioKeys.event(workspaceId, projectId),
      }),
    ]);
  }

  return (
    <>
      <ProjectTimeline
        projectId={projectId}
        tasks={timelineTasks}
        statuses={statuses}
        milestones={timelineMilestones}
        phases={timelineQuery.data?.phases ?? []}
        today={today}
        projectStart={projectStart}
        projectEnd={projectEnd}
        canEdit={timelineQuery.data?.capabilities.canEditTasks ?? canEdit}
        canManageStructure={
          timelineQuery.data?.capabilities.canManageStructure ?? canEdit
        }
        pendingMilestoneId={pendingId}
        onAddTask={onAddTask}
        onAddPhase={() => setSelectedPhase('new')}
        onEditPhase={setSelectedPhase}
        onAddMilestone={() => setTimelineMilestoneOpen(true)}
        onToggleMilestone={(milestone) => void toggleMilestone(milestone)}
        onEditMilestone={setEditingMilestone}
        onMilestoneChange={changeMilestoneTimeline}
        onTaskChange={changeTaskTimeline}
      />
      <MilestoneDialog
        key={timelineMilestoneOpen ? 'timeline-open' : 'timeline-closed'}
        open={timelineMilestoneOpen}
        onOpenChange={setTimelineMilestoneOpen}
        workspaceId={workspaceId}
        eventId={projectId}
        phases={timelineQuery.data?.phases ?? []}
      />
      <PhaseDialog
        key={
          selectedPhase === 'new'
            ? 'new-phase'
            : (selectedPhase?.id ?? 'closed-phase')
        }
        open={selectedPhase !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPhase(null);
        }}
        workspaceId={workspaceId}
        projectId={projectId}
        phase={selectedPhase === 'new' ? null : selectedPhase}
      />
      <TimelineMilestoneDialog
        open={Boolean(editingMilestone)}
        onOpenChange={(open) => {
          if (!open) setEditingMilestone(null);
        }}
        workspaceId={workspaceId}
        projectId={projectId}
        milestone={editingMilestone}
        phases={timelineQuery.data?.phases ?? []}
      />
    </>
  );
}

function PhaseDialog({
  open,
  onOpenChange,
  workspaceId,
  projectId,
  phase,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  projectId: string;
  phase: ProjectPhase | null;
}) {
  const queryClient = useQueryClient();
  const editing = Boolean(phase);
  const [name, setName] = useState(phase?.name ?? '');
  const [startDate, setStartDate] = useState(phase?.startDate ?? '');
  const [endDate, setEndDate] = useState(phase?.endDate ?? '');
  const [color, setColor] = useState(phase?.color ?? 'blue');
  const [pending, setPending] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function invalidatePhaseData() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: portfolioKeys.timeline(workspaceId, projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: portfolioKeys.event(workspaceId, projectId),
      }),
    ]);
  }

  async function submit() {
    if (name.trim().length < 2) return;
    if (startDate && endDate && endDate < startDate) {
      setSubmitError('A data final deve ser igual ou posterior ao início.');
      return;
    }
    setSubmitError(null);
    setPending(true);
    const client = createClient();
    const result = phase
      ? await client.rpc('update_event_phase', {
          p_workspace_id: workspaceId,
          p_phase_id: phase.id,
          p_expected_version: phase.version,
          p_patch: {
            name: name.trim(),
            color,
            start_date: startDate || null,
            end_date: endDate || null,
          },
        })
      : await client.rpc('create_event_phase', {
          p_workspace_id: workspaceId,
          p_event_id: projectId,
          p_name: name.trim(),
          p_color: color,
          p_start_date: startDate || undefined,
          p_end_date: endDate || undefined,
        });
    setPending(false);
    if (result.error) {
      const message = phase
        ? getPhaseUpdateErrorMessage(result.error)
        : getPhaseCreationErrorMessage(result.error);
      setSubmitError(message);
      toast.error(message);
      return;
    }
    await invalidatePhaseData();
    onOpenChange(false);
    toast.success(phase ? 'Fase atualizada.' : 'Fase criada.');
  }

  async function archivePhase() {
    if (!phase || pending) return;
    setPending(true);
    setSubmitError(null);
    const result = await createClient().rpc('archive_event_phase', {
      p_workspace_id: workspaceId,
      p_phase_id: phase.id,
      p_expected_version: phase.version,
    });
    setPending(false);
    if (result.error) {
      const message = getPhaseArchiveErrorMessage(result.error);
      setSubmitError(message);
      toast.error(message);
      return;
    }
    await invalidatePhaseData();
    setArchiveOpen(false);
    onOpenChange(false);
    toast.success('Fase excluída. As tarefas e os marcos foram preservados.');
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar fase' : 'Nova fase'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Ajuste o intervalo, o nome e a cor usados no cronograma.'
                : 'Crie uma etapa real do projeto, como Captação, Vendas ou Entrega.'}
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
              <Label htmlFor="phase-name">Nome da fase</Label>
              <Input
                id="phase-name"
                name="name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setSubmitError(null);
                }}
                placeholder="Ex.: Captação"
                minLength={2}
                maxLength={120}
                autoFocus
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phase-start">Início</Label>
                <Input
                  id="phase-start"
                  name="start_date"
                  type="date"
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    setSubmitError(null);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phase-end">Final</Label>
                <Input
                  id="phase-end"
                  name="end_date"
                  type="date"
                  min={startDate || undefined}
                  value={endDate}
                  onChange={(event) => {
                    setEndDate(event.target.value);
                    setSubmitError(null);
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phase-color">Cor</Label>
              <select
                id="phase-color"
                name="color"
                value={color}
                onChange={(event) => {
                  setColor(event.target.value);
                  setSubmitError(null);
                }}
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="blue">Azul</option>
                <option value="violet">Violeta</option>
                <option value="pink">Rosa</option>
                <option value="orange">Laranja</option>
                <option value="emerald">Verde</option>
                <option value="teal">Turquesa</option>
                <option value="slate">Cinza</option>
              </select>
            </div>
            {submitError ? (
              <p className="text-sm text-destructive" role="alert">
                {submitError}
              </p>
            ) : null}
            <DialogFooter
              className={
                editing ? 'gap-3 sm:flex-wrap sm:justify-between' : undefined
              }
            >
              {editing ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={pending}
                  onClick={() => setArchiveOpen(true)}
                >
                  <Trash2 aria-hidden="true" />
                  Excluir fase
                </Button>
              ) : null}
              <div className="flex flex-col-reverse gap-2 min-[400px]:flex-row">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={pending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={pending || name.trim().length < 2}
                >
                  {pending
                    ? 'Salvando…'
                    : editing
                      ? 'Salvar alterações'
                      : 'Criar fase'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a fase “{phase?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              A fase será removida do cronograma. Tarefas e marcos serão
              preservados e ficarão sem fase.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() => void archivePhase()}
            >
              {pending ? 'Excluindo…' : 'Excluir fase'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const defaultProjectViews = views.filter((item) => item.value !== 'settings');

function ProjectSettings({
  detail,
  workspaceId,
  currentUserId,
  members,
  products,
  onNavigate,
}: {
  detail: EventDetail;
  workspaceId: string;
  currentUserId: string;
  members: WorkspaceMember[];
  products: ProductSummary[];
  onNavigate: (view: ProjectView) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preferenceKey = projectViewPreferenceKey(
    currentUserId,
    workspaceId,
    detail.event.id,
  );
  const defaultView = useSyncExternalStore(
    subscribeToProjectView,
    useCallback(() => {
      try {
        const saved = window.localStorage.getItem(preferenceKey);
        return defaultProjectViews.some((item) => item.value === saved)
          ? (saved as ProjectView)
          : 'overview';
      } catch {
        return 'overview';
      }
    }, [preferenceKey]),
    () => 'overview',
  );
  const [name, setName] = useState(detail.event.name);
  const [status, setStatus] = useState(detail.event.status);
  const [healthOverride, setHealthOverride] = useState<
    'auto' | 'healthy' | 'attention' | 'risk'
  >(detail.event.healthOverride ?? 'auto');
  const [productId, setProductId] = useState(detail.event.productId ?? 'none');
  const [ownerId, setOwnerId] = useState(detail.event.ownerId ?? 'none');
  const [startDate, setStartDate] = useState(detail.event.startDate ?? '');
  const [endDate, setEndDate] = useState(detail.event.endDate ?? '');
  const [summary, setSummary] = useState(detail.event.summary ?? '');
  const [objective, setObjective] = useState(detail.event.objective ?? '');
  const [successMetric, setSuccessMetric] = useState(
    detail.event.successMetric ?? '',
  );
  const [teamIds, setTeamIds] = useState(
    () => new Set(detail.team.map((member) => member.id)),
  );

  function updateDefaultView(nextView: string) {
    const safeView = defaultProjectViews.some((item) => item.value === nextView)
      ? (nextView as ProjectView)
      : 'overview';
    try {
      window.localStorage.setItem(preferenceKey, safeView);
      window.dispatchEvent(new Event(PROJECT_VIEW_EVENT));
      toast.success('Visão inicial atualizada.');
    } catch {
      toast.error('O navegador não permitiu salvar esta preferência.');
    }
  }

  function toggleMember(memberId: string, checked: boolean) {
    setTeamIds((current) => {
      const next = new Set(current);
      if (checked) next.add(memberId);
      else next.delete(memberId);
      return next;
    });
  }

  async function saveProject() {
    const parsed = eventFormSchema.safeParse({
      name,
      status,
      healthOverride,
      productId,
      ownerId,
      startDate,
      endDate,
      summary,
      objective,
      successMetric,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revise os campos.');
      return;
    }

    setPending(true);
    setError(null);
    const values = parsed.data;
    const result = await createClient().rpc('update_event_operational', {
      p_event_id: detail.event.id,
      p_expected_version: detail.event.version,
      p_patch: {
        name: values.name,
        status: values.status,
        health_override:
          values.healthOverride === 'auto' ? null : values.healthOverride,
        product_id: values.productId === 'none' ? null : values.productId,
        owner_id: values.ownerId === 'none' ? null : values.ownerId,
        start_date: values.startDate || null,
        end_date: values.endDate || null,
        summary: values.summary,
        objective: values.objective,
        success_metric: values.successMetric,
      },
      p_member_ids: [...teamIds],
    });
    setPending(false);

    if (result.error) {
      setError(
        result.error.message.includes('PTA_VERSION_CONFLICT')
          ? 'Este projeto mudou em outra sessão. Recarregue a página antes de salvar novamente.'
          : 'Não foi possível salvar as configurações do projeto.',
      );
      return;
    }
    if (!portfolioMutationSchema.safeParse(result.data).success) {
      setError('O projeto foi salvo, mas a resposta não pôde ser validada.');
      router.refresh();
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: portfolioKeys.event(workspaceId, detail.event.id),
    });
    toast.success('Configurações do projeto salvas.');
    router.refresh();
  }

  return (
    <div className="mx-auto grid max-w-6xl items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Settings2 aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.02em]">
                Preferências pessoais
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Escolha onde este projeto abre para você. Esta preferência fica
                somente neste navegador e não muda a visão da equipe.
              </p>
            </div>
          </div>
          <div className="mt-6 max-w-sm">
            <Label htmlFor="project-default-view">Visão inicial</Label>
            <Select value={defaultView} onValueChange={updateDefaultView}>
              <SelectTrigger id="project-default-view" className="mt-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {defaultProjectViews.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.02em]">
                Estrutura do projeto
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Propósito, governança e período compartilhados com toda a
                equipe.
              </p>
            </div>
            <Badge
              variant={detail.capabilities.canEdit ? 'secondary' : 'outline'}
            >
              <ShieldCheck aria-hidden="true" />
              {detail.capabilities.canEdit
                ? 'Você pode editar'
                : 'Somente leitura'}
            </Badge>
          </div>

          <fieldset
            disabled={!detail.capabilities.canEdit || pending}
            className="mt-7 space-y-6 disabled:opacity-70"
          >
            <SettingsField label="Nome" htmlFor="project-settings-name">
              <Input
                id="project-settings-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={180}
              />
            </SettingsField>

            <div className="grid gap-5 md:grid-cols-2">
              <SettingsField label="Status" htmlFor="project-settings-status">
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value as typeof status)}
                >
                  <SelectTrigger
                    id="project-settings-status"
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planejamento</SelectItem>
                    <SelectItem value="active">Em curso</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsField>
              <SettingsField label="Saúde" htmlFor="project-settings-health">
                <Select
                  value={healthOverride}
                  onValueChange={(value) =>
                    setHealthOverride(value as typeof healthOverride)
                  }
                >
                  <SelectTrigger
                    id="project-settings-health"
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">
                      Calculada automaticamente
                    </SelectItem>
                    <SelectItem value="healthy">Saudável</SelectItem>
                    <SelectItem value="attention">Atenção</SelectItem>
                    <SelectItem value="risk">Em risco</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsField>
              <SettingsField
                label="Responsável"
                htmlFor="project-settings-owner"
              >
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger id="project-settings-owner" className="w-full">
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
              </SettingsField>
              <SettingsField
                label="Produto relacionado"
                htmlFor="project-settings-product"
              >
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger
                    id="project-settings-product"
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem produto</SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsField>
              <SettingsField label="Início" htmlFor="project-settings-start">
                <Input
                  id="project-settings-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </SettingsField>
              <SettingsField label="Fim" htmlFor="project-settings-end">
                <Input
                  id="project-settings-end"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </SettingsField>
            </div>

            <SettingsField label="Resumo" htmlFor="project-settings-summary">
              <Textarea
                id="project-settings-summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={3}
                maxLength={4000}
              />
            </SettingsField>
            <div className="grid gap-5 md:grid-cols-2">
              <SettingsField
                label="Objetivo"
                htmlFor="project-settings-objective"
              >
                <Textarea
                  id="project-settings-objective"
                  value={objective}
                  onChange={(event) => setObjective(event.target.value)}
                  rows={4}
                  maxLength={1000}
                />
              </SettingsField>
              <SettingsField
                label="Métrica de sucesso"
                htmlFor="project-settings-metric"
              >
                <Textarea
                  id="project-settings-metric"
                  value={successMetric}
                  onChange={(event) => setSuccessMetric(event.target.value)}
                  rows={4}
                  maxLength={500}
                />
              </SettingsField>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold">Equipe do projeto</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                As pessoas selecionadas acompanham o contexto completo do
                projeto.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {members.map((member) => (
                  <label
                    key={member.id}
                    className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 transition-colors hover:bg-muted/60"
                  >
                    <Checkbox
                      checked={teamIds.has(member.id)}
                      onCheckedChange={(checked) =>
                        toggleMember(member.id, checked === true)
                      }
                    />
                    <span className="text-sm font-medium">
                      {member.fullName}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </fieldset>

          {error ? (
            <p role="alert" className="mt-5 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {detail.capabilities.canEdit ? (
            <div className="mt-6 flex justify-end border-t pt-5">
              <Button onClick={saveProject} disabled={pending}>
                {pending ? 'Salvando…' : 'Salvar alterações'}
              </Button>
            </div>
          ) : null}
        </section>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-6">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">Áreas relacionadas</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Continue a organização sem sair do projeto.
          </p>
          <div className="mt-4 grid gap-2">
            <SettingsShortcut
              label="Equipe"
              detail={`${detail.team.length} pessoa${detail.team.length === 1 ? '' : 's'}`}
              onClick={() => onNavigate('team')}
            />
            <SettingsShortcut
              label="Recursos"
              detail={`${detail.resources.length} item${detail.resources.length === 1 ? '' : 's'}`}
              onClick={() => onNavigate('resources')}
            />
            <SettingsShortcut
              label="Atividade"
              detail="Histórico compartilhado"
              onClick={() => onNavigate('activity')}
            />
          </div>
        </section>
        <section className="rounded-2xl border bg-muted/40 p-5">
          <div className="flex gap-3">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-primary"
            />
            <div>
              <h2 className="font-semibold">Permissões</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {detail.capabilities.canEdit
                  ? 'Suas alterações afetam todos que trabalham neste projeto e ficam protegidas por controle de versão.'
                  : 'Você pode consultar o projeto e personalizar sua visão inicial. A estrutura é gerenciada por responsáveis autorizados.'}
              </p>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}

function SettingsField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function SettingsShortcut({
  label,
  detail,
  onClick,
}: {
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center justify-between rounded-xl px-3 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
      <span aria-hidden="true" className="text-muted-foreground">
        →
      </span>
    </button>
  );
}

function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; onClick?: () => void; href?: string };
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b pb-5">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.02em]">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action ? (
        action.href ? (
          <Button asChild variant="outline">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button variant="outline" onClick={action.onClick}>
            <Plus aria-hidden="true" />
            {action.label}
          </Button>
        )
      ) : null}
    </div>
  );
}

const CALENDAR_WEEKDAYS = [
  ['Seg', 'Segunda-feira'],
  ['Ter', 'Terça-feira'],
  ['Qua', 'Quarta-feira'],
  ['Qui', 'Quinta-feira'],
  ['Sex', 'Sexta-feira'],
  ['Sáb', 'Sábado'],
  ['Dom', 'Domingo'],
] as const;

function ProjectCalendar({
  items,
  today,
}: {
  items: PortfolioTask[];
  today: string;
}) {
  const [visibleMonth, setVisibleMonth] = useState(today.slice(0, 7));
  const monthStart = `${visibleMonth}-01`;
  const gridDays = useMemo(
    () => calendarMonthGridKeys(monthStart),
    [monthStart],
  );
  const datedTasks = useMemo(
    () =>
      items
        .filter((item): item is PortfolioTask & { dueDate: string } =>
          Boolean(item.dueDate),
        )
        .sort((left, right) => {
          const byDate = left.dueDate.localeCompare(right.dueDate);
          if (byDate) return byDate;
          return left.title.localeCompare(right.title, 'pt-BR');
        }),
    [items],
  );
  const tasksByDate = useMemo(
    () =>
      datedTasks.reduce((result, task) => {
        const dayTasks = result.get(task.dueDate) ?? [];
        dayTasks.push(task);
        result.set(task.dueDate, dayTasks);
        return result;
      }, new Map<string, Array<PortfolioTask & { dueDate: string }>>()),
    [datedTasks],
  );
  const unscheduledTasks = useMemo(
    () => items.filter((item) => !item.dueDate),
    [items],
  );
  const monthTaskCount = datedTasks.filter((task) =>
    task.dueDate.startsWith(visibleMonth),
  ).length;

  function moveMonth(amount: number) {
    setVisibleMonth(
      toDateKey(addMonths(dateFromKey(monthStart), amount)).slice(0, 7),
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4 border-b pb-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Calendário do projeto
          </p>
          <h2
            className="mt-1 text-xl font-semibold tracking-[-0.02em]"
            aria-live="polite"
          >
            {formatCalendarMonth(monthStart)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatTaskCount(monthTaskCount, 'com prazo neste mês')}
            {unscheduledTasks.length
              ? ` · ${formatTaskCount(unscheduledTasks.length, 'sem data')}`
              : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setVisibleMonth(today.slice(0, 7))}
            disabled={visibleMonth === today.slice(0, 7)}
          >
            Hoje
          </Button>
          <div className="flex items-center rounded-md border bg-card">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-r-none"
              onClick={() => moveMonth(-1)}
              aria-label="Mês anterior"
              title="Mês anterior"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-l-none border-l"
              onClick={() => moveMonth(1)}
              aria-label="Próximo mês"
              title="Próximo mês"
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      <div
        className="overflow-x-auto rounded-xl border bg-card"
        tabIndex={0}
        role="region"
        aria-label={`Calendário de ${formatCalendarMonth(monthStart)}`}
      >
        <table className="w-full min-w-[760px] table-fixed border-collapse">
          <caption className="sr-only">
            Tarefas do projeto em {formatCalendarMonth(monthStart)}
          </caption>
          <thead>
            <tr>
              {CALENDAR_WEEKDAYS.map(([shortLabel, fullLabel]) => (
                <th
                  key={shortLabel}
                  scope="col"
                  className="h-10 border-r bg-muted/45 px-2 text-left text-xs font-semibold text-muted-foreground last:border-r-0"
                >
                  <abbr title={fullLabel} className="no-underline">
                    {shortLabel}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }, (_, weekIndex) => (
              <tr key={gridDays[weekIndex * 7]}>
                {gridDays
                  .slice(weekIndex * 7, weekIndex * 7 + 7)
                  .map((dateKey) => {
                    const isCurrentMonth = dateKey.startsWith(visibleMonth);
                    const isToday = dateKey === today;
                    const dayTasks = tasksByDate.get(dateKey) ?? [];

                    return (
                      <td
                        key={dateKey}
                        className={cn(
                          'h-32 align-top border-t border-r p-2 last:border-r-0',
                          !isCurrentMonth && 'bg-muted/25',
                          isToday && 'bg-primary/[0.045]',
                        )}
                      >
                        <time
                          dateTime={dateKey}
                          aria-current={isToday ? 'date' : undefined}
                          className={cn(
                            'grid size-7 place-items-center rounded-full text-xs font-semibold tabular-nums',
                            !isCurrentMonth && 'text-muted-foreground',
                            isToday &&
                              'bg-primary text-primary-foreground shadow-sm',
                          )}
                          title={formatProjectDate(dateKey)}
                        >
                          {Number(dateKey.slice(-2))}
                        </time>

                        {dayTasks.length ? (
                          <ul className="mt-1.5 space-y-1">
                            {dayTasks.map((task) => (
                              <li key={task.id}>
                                <Link
                                  href={`/tarefa/${task.id}`}
                                  className={cn(
                                    'block rounded-md border border-l-2 border-l-primary/55 bg-background px-2 py-1.5 text-xs font-medium leading-4 shadow-xs transition-[border-color,background-color] hover:border-primary/45 hover:bg-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    !isCurrentMonth && 'opacity-65',
                                  )}
                                  title={`${task.title} · ${task.statusName}`}
                                  aria-label={`${task.title}, ${task.statusName}`}
                                >
                                  <span className="line-clamp-2">
                                    {task.title}
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </td>
                    );
                  })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {unscheduledTasks.length ? (
        <section className="mt-6 border-t pt-5" aria-labelledby="undated-title">
          <div className="mb-3 flex items-center gap-2">
            <h3 id="undated-title" className="font-semibold">
              Sem data
            </h3>
            <Count value={unscheduledTasks.length} />
          </div>
          <TaskList items={unscheduledTasks} />
        </section>
      ) : null}
    </div>
  );
}

function formatProjectDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(dateFromKey(value));
}

function formatCalendarMonth(value: string) {
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(dateFromKey(value));
  return label.charAt(0).toLocaleUpperCase('pt-BR') + label.slice(1);
}

function formatTaskCount(value: number, suffix: string) {
  return `${value} ${value === 1 ? 'tarefa' : 'tarefas'} ${suffix}`;
}
