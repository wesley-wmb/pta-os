'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardCode,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQueryClient } from '@tanstack/react-query';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  FileText,
  Filter,
  GripVertical,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Lightbulb,
  Link2,
  List,
  ListTodo,
  PanelTop,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Trash2,
  UsersRound,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
  type ComponentProps,
} from 'react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { TaskCardPreferencesProvider } from '@/features/settings/card-preferences-context';
import { TaskCardActions } from './task-card-actions';
import { TaskCardContent } from './task-card-content';
import {
  BoardColumnControls,
  BoardColumnIconGlyph,
  type BoardColumnColor,
  type BoardColumnEditableValues,
  type BoardColumnIcon,
  type BoardColumnWeekLink,
} from './board-column-controls';
import {
  useReorderTaskBoardColumns,
  useSetTaskBoardLaneLink,
  useTaskBoardConfiguration,
  useUpdateTaskBoardColumn,
  type TaskBoardStatusColumn,
} from './board-configuration';
import { taskHrefWithReturn } from './task-return-path';
import {
  TaskBoardColumn,
  TaskBoardEmpty,
  TaskBoardViewport,
} from './task-board';

import { EmptyTasks, QueryError } from '@/components/system/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  WorkspaceMember,
  WorkspaceRole,
} from '@/features/workspace/types';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

import {
  calendarWeekKeysFromDate,
  currentDateInTimeZone,
  dateFromKey,
  normalizeDateReference,
  toDateKey,
} from './date-utils';
import {
  formatDueDate,
  isClosed,
  priorityLabels,
  statusTone,
} from './formatters';
import { canEditTaskOverview } from './permissions';
import {
  buildPipelineViewLocation,
  buildWeeklyPresentationLocation,
} from './pipeline-navigation';
import {
  isPlanningPipelineView,
  parseWeeklyPresentationFormat,
  type WeeklyPresentationFormat,
} from './pipeline-presentation-state';
import {
  isReferenceInCurrentPeriod,
  parsePipelineView,
  type PipelineView,
} from './pipeline-state';
import { taskKeys, useTasks } from './queries';
import { NewTaskDialog } from './new-task-dialog';
import {
  countActiveTaskFilters,
  EMPTY_ADVANCED_TASK_FILTERS,
  filterPipelineTasks,
  isTaskOverdue,
  pipelineScopeCounts,
  sanitizeSpreadsheetCell,
  type AdvancedTaskFilters,
  type ScopeFilter,
  uniqueTaskOptions,
} from './task-pipeline-model';
import {
  applyBoardMove,
  compareBoardTasks,
  planBoardMove,
  type BoardMovePlan,
} from './task-board-ordering';
import type { TaskOverview, TaskStatus, TaskWeekLane } from './types';

type TaskCreationContext = {
  workspaceId: string;
  taskPrefix: string;
  members: WorkspaceMember[];
  role: WorkspaceRole;
  currentUserId: string;
  initialEventId?: string;
};

type AuxiliaryWeekLane = Exclude<TaskWeekLane, 'scheduled'>;

type WeekLaneDefinition = {
  id: AuxiliaryWeekLane;
  label: string;
  description: string;
  icon: typeof Inbox;
  tone: string;
  iconKey?: BoardColumnIcon;
  coverUrl?: string | null;
  color?: string;
  position?: number;
  version?: number;
};

const EMERGENCY_BOARD_STATUS_ID = 'week-lane:emergency';
const EMERGENCY_BOARD_STATUS: TaskStatus = {
  id: EMERGENCY_BOARD_STATUS_ID,
  name: 'Emergência',
  category: 'todo',
  color: 'red',
  position: -1,
};

const WEEK_LANE_DEFINITIONS: ReadonlyArray<WeekLaneDefinition> = [
  {
    id: 'emergency',
    label: 'Emergência',
    description: 'Atenção imediata',
    icon: Zap,
    tone: 'text-destructive',
  },
  {
    id: 'important',
    label: 'Links importantes',
    description: 'Referências da operação',
    icon: Link2,
    tone: 'text-pta-blue',
  },
  {
    id: 'backlog',
    label: 'Para planejar',
    description: 'Ainda sem dia definido',
    icon: Inbox,
    tone: 'text-muted-foreground',
  },
  {
    id: 'delivered',
    label: 'Concluídos',
    description: 'Entregues e publicados',
    icon: CheckCircle2,
    tone: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'revision',
    label: 'Alterações',
    description: 'Ajustes solicitados',
    icon: RotateCcw,
    tone: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'ideas',
    label: 'Ideias criativas',
    description: 'Sugestões para desenvolver',
    icon: Lightbulb,
    tone: 'text-pta-purple',
  },
  {
    id: 'discarded',
    label: 'Arquivados',
    description: 'Itens fora do fluxo',
    icon: Trash2,
    tone: 'text-muted-foreground',
  },
];

type TaskViewTab = 'kanban' | 'table' | 'week' | 'calendar';
const taskViews: Array<{
  id: TaskViewTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'kanban', label: 'Quadro', icon: LayoutDashboard },
  { id: 'table', label: 'Lista', icon: List },
  { id: 'week', label: 'Semana', icon: Columns3 },
  { id: 'calendar', label: 'Calendário', icon: CalendarRange },
];

const scopeFilters: Array<{ id: ScopeFilter; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'mine', label: 'Minhas' },
  { id: 'overdue', label: 'Atrasadas' },
  { id: 'blocked', label: 'Bloqueadas' },
  { id: 'review', label: 'Alterações' },
  { id: 'done', label: 'Concluídas' },
];

type TableField = 'status' | 'context' | 'assignee' | 'due' | 'priority';

const tableFieldOptions: Array<{ id: TableField; label: string }> = [
  { id: 'status', label: 'Status' },
  { id: 'context', label: 'Contexto' },
  { id: 'assignee', label: 'Responsável' },
  { id: 'due', label: 'Prazo' },
  { id: 'priority', label: 'Prioridade' },
];

const EMPTY_TASKS: TaskOverview[] = [];
const PIPELINE_SCREEN_READER_INSTRUCTIONS = {
  draggable:
    'Para mover uma tarefa, pressione espaço. Use as setas para escolher o destino e pressione espaço novamente para confirmar.',
};

type TaskPipelineProps = {
  workspaceId: string;
  currentUserId: string;
  timezone: string;
  role: WorkspaceRole;
  statuses: TaskStatus[];
  taskPrefix: string;
  members: WorkspaceMember[];
};

export function TaskPipeline(props: TaskPipelineProps) {
  return (
    <TaskCardPreferencesProvider
      userId={props.currentUserId}
      workspaceId={props.workspaceId}
    >
      <TaskPipelineContent {...props} />
    </TaskCardPreferencesProvider>
  );
}

type ProjectTaskKanbanProps = TaskPipelineProps & {
  projectId: string;
  search: string;
  assigneeName: string;
};

/**
 * The project board is a scoped view of the canonical task pipeline. Keeping
 * the same component here makes cards, preferences, ordering and drag/drop
 * behavior consistent everywhere a status board is shown.
 */
export function ProjectTaskKanban(props: ProjectTaskKanbanProps) {
  // Other shell queries can populate the browser cache before this boundary
  // hydrates. Match the server's loading state for that first render.
  const mounted = useSyncExternalStore(
    subscribeToClientEnvironment,
    () => true,
    () => false,
  );
  if (!mounted) return <PipelineSkeleton view="kanban" />;

  return (
    <TaskCardPreferencesProvider
      userId={props.currentUserId}
      workspaceId={props.workspaceId}
    >
      <ProjectTaskKanbanContent {...props} />
    </TaskCardPreferencesProvider>
  );
}

function ProjectTaskKanbanContent({
  projectId,
  search,
  assigneeName,
  workspaceId,
  currentUserId,
  timezone,
  role,
  statuses,
  taskPrefix,
  members,
}: ProjectTaskKanbanProps) {
  const query = useTasks(workspaceId);
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  useEffect(() => {
    const timer = window.setInterval(
      () => setNowIso(new Date().toISOString()),
      60_000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
  const tasks = useMemo(
    () =>
      (query.data ?? EMPTY_TASKS).filter((task) => {
        if (task.event_id !== projectId) return false;
        if (
          assigneeName !== 'all' &&
          task.primary_assignee_name !== assigneeName
        )
          return false;
        if (!normalizedSearch) return true;
        return [
          task.title,
          task.status_name,
          task.primary_assignee_name,
          task.type_name,
          task.product_name,
        ]
          .filter(Boolean)
          .some((value) =>
            value!.toLocaleLowerCase('pt-BR').includes(normalizedSearch),
          );
      }),
    [assigneeName, normalizedSearch, projectId, query.data],
  );

  if (query.isPending) return <PipelineSkeleton view="kanban" />;
  if (query.isError) return <QueryError onRetry={() => void query.refetch()} />;

  return (
    <StatusKanban
      workspaceId={workspaceId}
      tasks={tasks}
      statuses={statuses}
      role={role}
      currentUserId={currentUserId}
      taskPrefix={taskPrefix}
      members={members}
      today={currentDateInTimeZone(timezone)}
      nowIso={nowIso}
      initialEventId={projectId}
    />
  );
}

function TaskPipelineContent({
  workspaceId,
  currentUserId,
  timezone,
  role,
  statuses,
  taskPrefix,
  members,
}: TaskPipelineProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = currentDateInTimeZone(timezone);
  const view = parsePipelineView(searchParams.get('visao'), 'kanban');
  const isPlanningScreen = isPlanningPipelineView(view);
  const requestedWeekFormat = parseWeeklyPresentationFormat(
    searchParams.get('formato'),
  );
  const activeWeekFormat: WeeklyPresentationFormat =
    view === 'month'
      ? 'calendar'
      : view === 'day'
        ? 'list'
        : requestedWeekFormat;
  const referenceDate = normalizeDateReference(searchParams.get('data'), today);
  const query = useTasks(workspaceId);
  const [scope, setScope] = useState<ScopeFilter>('mine');
  const [search, setSearch] = useState('');
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedTaskFilters>(
    EMPTY_ADVANCED_TASK_FILTERS,
  );
  const [visibleFields, setVisibleFields] = useState<Set<TableField>>(
    () => new Set(tableFieldOptions.map((field) => field.id)),
  );
  const appliedScope = scope;
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  useEffect(() => {
    const timer = window.setInterval(
      () => setNowIso(new Date().toISOString()),
      60_000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const allTasks = query.data ?? EMPTY_TASKS;
  const tasks = useMemo(
    () =>
      filterPipelineTasks(allTasks, {
        scope: appliedScope,
        search,
        currentUserId,
        nowIso,
        filters: advancedFilters,
      }),
    [advancedFilters, allTasks, appliedScope, currentUserId, nowIso, search],
  );
  const scopeCounts = useMemo(
    () => pipelineScopeCounts(allTasks, currentUserId, nowIso),
    [allTasks, currentUserId, nowIso],
  );
  const activeFilterCount = countActiveTaskFilters(advancedFilters);
  const contextOptions = useMemo(
    () => ({
      types: uniqueTaskOptions(allTasks, 'type_id', 'type_name'),
      products: uniqueTaskOptions(allTasks, 'product_id', 'product_name'),
      events: uniqueTaskOptions(allTasks, 'event_id', 'event_name'),
    }),
    [allTasks],
  );
  const creation = {
    workspaceId,
    taskPrefix,
    members,
    role,
    currentUserId,
  };

  function setLocation(nextView: PipelineView, nextDate = referenceDate) {
    window.history.replaceState(
      null,
      '',
      buildPipelineViewLocation({
        pathname,
        currentSearch: searchParams.toString(),
        view: nextView,
        referenceDate: nextDate,
      }),
    );
  }

  function setWeekFormat(
    nextFormat: WeeklyPresentationFormat,
    nextDate = referenceDate,
  ) {
    window.history.replaceState(
      null,
      '',
      buildWeeklyPresentationLocation({
        pathname,
        currentSearch: searchParams.toString(),
        format: nextFormat,
        referenceDate: nextDate,
      }),
    );
  }

  function openDay(dateKey: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('visao', 'dia');
    params.set('data', dateKey);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function movePeriod(direction: -1 | 1) {
    const date = dateFromKey(referenceDate);
    if (isPlanningScreen) {
      const next =
        view === 'month'
          ? addMonths(date, direction)
          : addDays(date, direction * 7);
      if (view === 'month') setLocation('month', toDateKey(next));
      else setWeekFormat(activeWeekFormat, toDateKey(next));
      return;
    }
    setLocation(view, toDateKey(addDays(date, direction)));
  }

  const filtered =
    appliedScope !== 'all' || search.trim().length > 0 || activeFilterCount > 0;

  function clearFilters() {
    setScope('all');
    setSearch('');
    setAdvancedFilters(EMPTY_ADVANCED_TASK_FILTERS);
  }

  function updateAdvancedFilter<Key extends keyof AdvancedTaskFilters>(
    key: Key,
    value: AdvancedTaskFilters[Key],
  ) {
    setAdvancedFilters((current) => ({ ...current, [key]: value }));
  }

  function toggleTableField(field: TableField) {
    setVisibleFields((current) => {
      const next = new Set(current);
      if (next.has(field)) {
        if (next.size > 1) next.delete(field);
      } else next.add(field);
      return next;
    });
  }

  function exportTasks() {
    downloadTasksCsv(tasks);
    toast.success(
      tasks.length === 1
        ? '1 tarefa exportada.'
        : `${tasks.length} tarefas exportadas.`,
    );
  }

  const periodView: Extract<PipelineView, 'week' | 'month'> =
    view === 'month' ? 'month' : 'week';
  const weekDayKeys = calendarWeekKeysFromDate(referenceDate);
  const isBoardView =
    (!isPlanningScreen && view === 'kanban') ||
    (isPlanningScreen && activeWeekFormat === 'week');

  return (
    <div className="pta-task-pipeline flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="shrink-0 border-b bg-background/95 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <h1 className="truncate text-2xl font-semibold leading-none tracking-[-0.03em]">
            Tarefas
          </h1>
          <PrimaryCreateTaskButton
            creation={creation}
            label="Nova tarefa"
            initialDueDate={isPlanningScreen ? referenceDate : undefined}
          />
        </div>
        <div className="flex min-h-12 items-center gap-2 border-t px-4 sm:px-6">
          <div
            role="group"
            aria-label="Visualizações de tarefas"
            className="flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {taskViews.map(({ id, label, icon: Icon }) => {
              const selected =
                id ===
                (isPlanningScreen
                  ? activeWeekFormat === 'calendar'
                    ? 'calendar'
                    : activeWeekFormat === 'list'
                      ? 'table'
                      : 'week'
                  : view);
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected}
                  className={cn(
                    'relative flex h-12 shrink-0 items-center gap-2 px-3 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground',
                    selected &&
                      'text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary',
                  )}
                  onClick={() =>
                    id === 'calendar'
                      ? setLocation('month')
                      : id === 'week'
                        ? setWeekFormat('week')
                        : setLocation(id)
                  }
                >
                  <Icon aria-hidden="true" className="size-[18px]" />
                  {label}
                </button>
              );
            })}
          </div>
          {isPlanningScreen ? (
            <div className="hidden shrink-0 xl:block">
              <PeriodNavigation
                view={periodView}
                referenceDate={referenceDate}
                today={today}
                onPrevious={() => movePeriod(-1)}
                onToday={() =>
                  view === 'month'
                    ? setLocation('month', today)
                    : setWeekFormat(activeWeekFormat, today)
                }
                onNext={() => movePeriod(1)}
              />
            </div>
          ) : null}
          <div className="ml-auto flex shrink-0 items-center justify-end gap-1">
            <TaskSearchPopover search={search} onChange={setSearch} />
            <ScopeFilterMenu
              scope={scope}
              counts={scopeCounts}
              onChange={setScope}
            />
            <TaskFiltersPopover
              filters={advancedFilters}
              onChange={updateAdvancedFilter}
              onClear={() => setAdvancedFilters(EMPTY_ADVANCED_TASK_FILTERS)}
              count={activeFilterCount}
              statuses={statuses}
              members={members}
              contextOptions={contextOptions}
            />
            {view === 'table' ||
            (activeWeekFormat === 'list' && isPlanningScreen) ? (
              <TableFieldsPopover
                visibleFields={visibleFields}
                onToggle={toggleTableField}
              />
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={tasks.length === 0}
              onClick={exportTasks}
              aria-label="Exportar tarefas"
              title="Exportar tarefas"
              className="hidden size-10 shrink-0 text-muted-foreground hover:text-foreground md:inline-flex"
            >
              <Download aria-hidden="true" />
            </Button>
          </div>
        </div>
        {isPlanningScreen ? (
          <div className="border-t px-4 py-2 xl:hidden">
            <PeriodNavigation
              view={periodView}
              referenceDate={referenceDate}
              today={today}
              onPrevious={() => movePeriod(-1)}
              onToday={() =>
                view === 'month'
                  ? setLocation('month', today)
                  : setWeekFormat(activeWeekFormat, today)
              }
              onNext={() => movePeriod(1)}
            />
          </div>
        ) : null}
      </header>
      <section
        className={cn(
          'mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col',
          !isBoardView && 'pta-scrollbar overflow-y-auto pb-8',
        )}
        aria-labelledby="task-pipeline-title"
      >
        <h2 id="task-pipeline-title" className="sr-only">
          Organização de tarefas
        </h2>

        {query.isPending ? (
          <PipelineSkeleton view={isPlanningScreen ? periodView : view} />
        ) : null}
        {query.isError ? (
          <div className="mt-4 border-y">
            <QueryError onRetry={() => void query.refetch()} />
          </div>
        ) : null}
        {query.isSuccess && !isPlanningScreen && tasks.length === 0 ? (
          <div className="mt-4 border-y">
            <EmptyTasks
              filtered={filtered}
              onClear={filtered ? clearFilters : undefined}
            />
          </div>
        ) : null}
        {query.isSuccess &&
        (isPlanningScreen ||
          (!filtered && tasks.length > 0) ||
          tasks.length > 0) ? (
          <div
            className={cn(
              isBoardView
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                : 'px-4 pt-4 sm:px-6',
            )}
          >
            {isPlanningScreen && activeWeekFormat === 'week' ? (
              <WeekBoard
                workspaceId={workspaceId}
                tasks={tasks}
                statuses={statuses}
                dayKeys={weekDayKeys}
                today={today}
                role={role}
                currentUserId={currentUserId}
                taskPrefix={taskPrefix}
                members={members}
                nowIso={nowIso}
              />
            ) : null}
            {isPlanningScreen && activeWeekFormat === 'list' ? (
              view === 'day' ? (
                <DayAgenda
                  tasks={tasks}
                  dateKey={referenceDate}
                  workspaceId={workspaceId}
                  taskPrefix={taskPrefix}
                  members={members}
                  role={role}
                  currentUserId={currentUserId}
                />
              ) : (
                <WeekList
                  tasks={tasks}
                  dayKeys={weekDayKeys}
                  today={today}
                  nowIso={nowIso}
                  visibleFields={visibleFields}
                />
              )
            ) : null}
            {isPlanningScreen && activeWeekFormat === 'calendar' ? (
              <WeekCalendar
                workspaceId={workspaceId}
                tasks={tasks}
                referenceDate={referenceDate}
                month={view === 'month'}
                today={today}
                role={role}
                currentUserId={currentUserId}
                onOpenDay={openDay}
              />
            ) : null}
            {!isPlanningScreen && view === 'kanban' ? (
              <StatusKanban
                workspaceId={workspaceId}
                tasks={tasks}
                statuses={statuses}
                role={role}
                currentUserId={currentUserId}
                taskPrefix={taskPrefix}
                members={members}
                today={today}
                nowIso={nowIso}
              />
            ) : null}
            {!isPlanningScreen && view === 'table' && tasks.length > 0 ? (
              <TaskTable
                tasks={tasks}
                today={today}
                nowIso={nowIso}
                visibleFields={visibleFields}
              />
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function PrimaryCreateTaskButton({
  creation,
  initialDueDate,
  label = 'Nova tarefa',
}: {
  creation: TaskCreationContext;
  initialDueDate?: string;
  label?: string;
}) {
  if (creation.role === 'viewer') return null;
  return (
    <NewTaskDialog
      workspaceId={creation.workspaceId}
      taskPrefix={creation.taskPrefix}
      members={creation.members}
      role={creation.role}
      currentUserId={creation.currentUserId}
      initialDueDate={initialDueDate}
      trigger={
        <Button type="button" className="shadow-none">
          <Plus aria-hidden="true" />
          {label}
        </Button>
      }
    />
  );
}

function TaskSearchPopover({
  search,
  onChange,
}: {
  search: string;
  onChange: (value: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(
            'size-10 text-muted-foreground hover:text-foreground',
            search && 'bg-primary/10 text-primary',
          )}
          aria-label={search ? `Buscar tarefas: ${search}` : 'Buscar tarefas'}
          title="Buscar tarefas"
        >
          <Search aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(90vw,320px)] p-2">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Buscar por título ou conteúdo"
            className="h-10 border-0 bg-muted/60 pl-9 shadow-none"
            aria-label="Buscar tarefas"
            autoFocus
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ScopeFilterMenu({
  scope,
  counts,
  onChange,
}: {
  scope: ScopeFilter;
  counts: Record<ScopeFilter, number>;
  onChange: (scope: ScopeFilter) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'h-10 shrink-0 gap-2 px-2.5 text-muted-foreground hover:text-foreground',
            scope !== 'all' && 'bg-primary/10 text-primary',
          )}
          aria-label={`Visão: ${scopeFilters.find((item) => item.id === scope)?.label ?? 'Todas'}`}
          title={`Visão: ${scopeFilters.find((item) => item.id === scope)?.label ?? 'Todas'}`}
        >
          <UsersRound aria-hidden="true" className="size-[18px]" />
          <span className="hidden sm:inline">
            {scopeFilters.find((item) => item.id === scope)?.label ?? 'Todas'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <PopoverHeader className="px-2 pb-1 pt-1">
          <PopoverTitle className="text-sm">Mostrar tarefas</PopoverTitle>
        </PopoverHeader>
        <div
          className="grid gap-0.5"
          role="group"
          aria-label="Filtro de tarefas"
        >
          {scopeFilters.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={scope === item.id}
              onClick={() => onChange(item.id)}
              className={cn(
                'flex min-h-10 items-center justify-between rounded-md px-3 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground',
                scope === item.id && 'bg-accent font-medium text-foreground',
              )}
            >
              <span>{item.label}</span>
              <span className="text-xs tabular-nums">{counts[item.id]}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TaskFiltersPopover({
  filters,
  onChange,
  onClear,
  count,
  statuses,
  members,
  contextOptions,
}: {
  filters: AdvancedTaskFilters;
  onChange: <Key extends keyof AdvancedTaskFilters>(
    key: Key,
    value: AdvancedTaskFilters[Key],
  ) => void;
  onClear: () => void;
  count: number;
  statuses: TaskStatus[];
  members: WorkspaceMember[];
  contextOptions: {
    types: Array<{ id: string; name: string }>;
    products: Array<{ id: string; name: string }>;
    events: Array<{ id: string; name: string }>;
  };
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'relative h-10 gap-2 px-2.5 text-muted-foreground hover:bg-pta-blue/[0.06] hover:text-pta-blue',
            count > 0 && 'border-pta-blue/30 bg-pta-blue/[0.08] text-pta-blue',
          )}
          aria-label={count ? `Filtros, ${count} ativos` : 'Filtros'}
        >
          <Filter aria-hidden="true" />
          <span className="hidden sm:inline">Filtros</span>
          {count ? (
            <span className="absolute ml-5 -mt-5 grid size-4 place-items-center rounded-full bg-pta-blue text-[10px] text-primary-foreground">
              {count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,360px)] p-4">
        <PopoverHeader>
          <PopoverTitle>Refinar tarefas</PopoverTitle>
          <PopoverDescription>
            Combine os campos para encontrar a fila certa.
          </PopoverDescription>
        </PopoverHeader>
        <div className="grid gap-3 pt-1 sm:grid-cols-2">
          <PipelineFilterSelect
            label="Responsável"
            value={filters.assigneeId}
            onValueChange={(value) => onChange('assigneeId', value)}
            options={[
              { value: 'all', label: 'Todo o time' },
              { value: 'unassigned', label: 'Sem responsável' },
              ...members.map((member) => ({
                value: member.id,
                label: member.fullName,
              })),
            ]}
          />
          <PipelineFilterSelect
            label="Status"
            value={filters.statusId}
            onValueChange={(value) => onChange('statusId', value)}
            options={[
              { value: 'all', label: 'Todos os status' },
              ...statuses.map((status) => ({
                value: status.id,
                label: status.name,
              })),
            ]}
          />
          <PipelineFilterSelect
            label="Prioridade"
            value={filters.priority}
            onValueChange={(value) =>
              onChange('priority', value as AdvancedTaskFilters['priority'])
            }
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'urgent', label: 'Urgente' },
              { value: 'high', label: 'Alta' },
              { value: 'medium', label: 'Média' },
              { value: 'low', label: 'Baixa' },
            ]}
          />
          <PipelineFilterSelect
            label="Tipo"
            value={filters.typeId}
            onValueChange={(value) => onChange('typeId', value)}
            options={contextFilterOptions(
              'Todos os tipos',
              contextOptions.types,
            )}
          />
          <PipelineFilterSelect
            label="Produto"
            value={filters.productId}
            onValueChange={(value) => onChange('productId', value)}
            options={contextFilterOptions(
              'Todos os produtos',
              contextOptions.products,
            )}
          />
          <PipelineFilterSelect
            label="Projeto"
            value={filters.eventId}
            onValueChange={(value) => onChange('eventId', value)}
            options={contextFilterOptions(
              'Todos os projetos',
              contextOptions.events,
            )}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={count === 0}
          onClick={onClear}
          className="mt-1 justify-center"
        >
          Limpar filtros
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function PipelineFilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          id={id}
          className="w-full bg-background shadow-none hover:border-pta-blue/30"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TableFieldsPopover({
  visibleFields,
  onToggle,
}: {
  visibleFields: Set<TableField>;
  onToggle: (field: TableField) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="hidden justify-center hover:border-pta-blue/35 hover:bg-pta-blue/[0.06] hover:text-pta-blue md:inline-flex"
        >
          <Settings2 aria-hidden="true" />
          Campos
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-4">
        <PopoverHeader>
          <PopoverTitle>Campos da tabela</PopoverTitle>
          <PopoverDescription>
            Escolha quais informações ficam visíveis.
          </PopoverDescription>
        </PopoverHeader>
        <div className="space-y-1 pt-1">
          {tableFieldOptions.map((field) => (
            <label
              key={field.id}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 transition-colors hover:bg-pta-blue/[0.07] hover:text-pta-blue"
            >
              <Checkbox
                checked={visibleFields.has(field.id)}
                onCheckedChange={() => onToggle(field.id)}
                aria-label={field.label}
              />
              <span>{field.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function contextFilterOptions(
  allLabel: string,
  options: Array<{ id: string; name: string }>,
) {
  return [
    { value: 'all', label: allLabel },
    { value: 'none', label: 'Sem vínculo' },
    ...options.map((option) => ({ value: option.id, label: option.name })),
  ];
}

function PeriodNavigation({
  view,
  referenceDate,
  today,
  onPrevious,
  onToday,
  onNext,
}: {
  view: PipelineView;
  referenceDate: string;
  today: string;
  onPrevious: () => void;
  onToday: () => void;
  onNext: () => void;
}) {
  if (view === 'kanban' || view === 'table') {
    return (
      <p className="px-1 text-sm text-muted-foreground">
        {view === 'kanban' ? 'Fluxo completo por status' : 'Visão detalhada'}
      </p>
    );
  }

  return (
    <div className="flex min-w-0 items-center justify-between gap-2 lg:justify-end">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="hover:border-pta-blue/35 hover:bg-pta-blue/[0.07] hover:text-pta-blue"
        onClick={onPrevious}
        aria-label="Período anterior"
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <button
        type="button"
        onClick={onToday}
        className="min-h-9 min-w-0 rounded-lg px-2 text-center text-sm font-medium transition-colors hover:bg-pta-blue/[0.07] hover:text-pta-blue sm:min-w-44 sm:px-3"
        aria-label={
          isReferenceInCurrentPeriod(view, referenceDate, today)
            ? `${periodLabel(view, referenceDate)}, período atual`
            : `${periodLabel(view, referenceDate)}. Voltar para hoje`
        }
      >
        {periodLabel(view, referenceDate)}
      </button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="hover:border-pta-blue/35 hover:bg-pta-blue/[0.07] hover:text-pta-blue"
        onClick={onNext}
        aria-label="Próximo período"
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}

function StatusKanban({
  workspaceId,
  tasks,
  statuses,
  role,
  currentUserId,
  taskPrefix,
  members,
  today,
  nowIso,
  initialEventId,
}: {
  workspaceId: string;
  tasks: TaskOverview[];
  statuses: TaskStatus[];
  role: WorkspaceRole;
  currentUserId: string;
  taskPrefix: string;
  members: WorkspaceMember[];
  today: string;
  nowIso: string;
  initialEventId?: string;
}) {
  const queryClient = useQueryClient();
  const [draggingTask, setDraggingTask] = useState<TaskOverview | null>(null);
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const [previewTasks, setPreviewTasks] = useState<TaskOverview[] | null>(null);
  const [previewStatuses, setPreviewStatuses] = useState<TaskStatus[] | null>(
    null,
  );
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [blockedMove, setBlockedMove] = useState<{
    task: TaskOverview;
    status: TaskStatus;
    plan: BoardMovePlan;
  }>();
  const [blockedReason, setBlockedReason] = useState('');
  const sensors = useKanbanSensors();
  const displayedTasks = previewTasks ?? tasks;
  const boardConfiguration = useTaskBoardConfiguration(workspaceId, statuses);
  const updateColumn = useUpdateTaskBoardColumn(workspaceId);
  const reorderColumns = useReorderTaskBoardColumns(workspaceId);
  const setLaneLink = useSetTaskBoardLaneLink(workspaceId);
  const statusColumns = boardConfiguration.data?.status_board.columns;
  const configuredStatuses = useMemo(
    () =>
      statusColumns
        ?.filter((column) => column.is_active)
        .map(taskStatusFromBoardColumn) ??
      statuses.toSorted((left, right) => left.position - right.position),
    [statusColumns, statuses],
  );
  const canManageColumns =
    boardConfiguration.data?.source === 'remote' &&
    boardConfiguration.data.permissions.can_manage_columns;
  const emergencyColumn = statusColumns?.find(
    (column) => column.key === 'emergency',
  );
  const emergencyStatus =
    configuredStatuses.find(
      (status) =>
        status.id === emergencyColumn?.id || isEmergencyBoardStatus(status),
    ) ?? EMERGENCY_BOARD_STATUS;
  const kanbanStatuses = useMemo(() => {
    const activeIds = new Set([
      emergencyStatus.id,
      ...configuredStatuses.map((status) => status.id),
    ]);
    const archived = new Map<string, TaskStatus>();
    for (const task of tasks) {
      if (isLinkedBoardLane(task.week_lane)) continue;
      if (activeIds.has(task.status_id) || archived.has(task.status_id))
        continue;
      archived.set(task.status_id, {
        id: task.status_id,
        name: `${task.status_name} arquivado`,
        category: task.status_category,
        color: task.status_color,
        position: Number.MAX_SAFE_INTEGER,
      });
    }
    const activeStatuses =
      emergencyStatus.id === EMERGENCY_BOARD_STATUS_ID
        ? [emergencyStatus, ...configuredStatuses]
        : configuredStatuses;
    return [...activeStatuses, ...archived.values()];
  }, [configuredStatuses, emergencyStatus, tasks]);
  const displayedStatuses = previewStatuses ?? kanbanStatuses;
  const reviewStatus = configuredStatuses.find(
    (status) => status.category === 'review',
  );
  const boardTasks = useMemo(
    () =>
      displayedTasks.map((task) =>
        normalizeTaskForLinkedBoard(task, reviewStatus, emergencyStatus),
      ),
    [displayedTasks, emergencyStatus, reviewStatus],
  );

  function linkedLaneForStatus(status: TaskStatus) {
    const link = boardConfiguration.data?.links.find(
      (item) => item.status_id === status.id,
    );
    return link?.direction === 'week_to_status'
      ? null
      : (link?.week_lane_key ?? linkedLaneForBoardStatus(status));
  }

  async function updateStatusColumn(
    columnId: string,
    value: BoardColumnEditableValues,
  ) {
    const configuration = boardConfiguration.data;
    const column = configuration?.status_board.columns.find(
      (item) => item.id === columnId,
    );
    if (!configuration || configuration.source !== 'remote' || !column) {
      throw new Error('PTA_TASK_BOARD_CONFIGURATION_UNAVAILABLE');
    }

    let nextConfiguration = await updateColumn.mutateAsync({
      boardKind: 'status',
      columnKey: column.key,
      name: value.name,
      color: value.color,
      iconKey: value.icon,
      coverUrl: value.coverUrl,
      expectedBoardVersion: configuration.status_board.version,
      expectedColumnVersion: column.version,
    });
    const currentLink = nextConfiguration.links.find(
      (link) => link.status_id === columnId,
    );
    const nextWeekLane = value.weekLink === 'none' ? null : value.weekLink;
    if (currentLink?.week_lane_key === nextWeekLane) return;
    if (!currentLink && !nextWeekLane) return;

    nextConfiguration = await setLaneLink.mutateAsync({
      statusId: columnId,
      weekLaneKey: nextWeekLane ?? currentLink!.week_lane_key,
      direction: 'both',
      enabled: Boolean(nextWeekLane),
      expectedBoardVersion: nextConfiguration.status_board.version,
    });
    toast.success(
      nextWeekLane
        ? 'Coluna e automação atualizadas.'
        : 'Coluna atualizada e automação removida.',
    );
  }

  async function reorderStatusColumns(orderedIds: string[]) {
    const configuration = boardConfiguration.data;
    if (!configuration || configuration.source !== 'remote') return;
    const activeKeys = orderedIds
      .map(
        (id) =>
          configuration.status_board.columns.find((column) => column.id === id)
            ?.key,
      )
      .filter((key): key is string => Boolean(key));
    const activeColumnCount = configuration.status_board.columns.filter(
      (column) => column.is_active,
    ).length;
    if (activeKeys.length !== activeColumnCount) return;
    try {
      await reorderColumns.mutateAsync({
        boardKind: 'status',
        orderedKeys: activeKeys,
        expectedBoardVersion: configuration.status_board.version,
      });
      toast.success('Ordem das colunas atualizada.');
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.includes('CONFLICT')
          ? 'A ordem mudou em outra sessão. O quadro foi recarregado.'
          : 'Não foi possível reordenar as colunas.',
      );
      await boardConfiguration.refetch();
    }
  }

  function moveStatusColumn(columnId: string, direction: 'left' | 'right') {
    const currentIndex = displayedStatuses.findIndex(
      (status) => status.id === columnId,
    );
    const targetIndex = currentIndex + (direction === 'left' ? -1 : 1);
    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= displayedStatuses.length
    )
      return;
    const reordered = arrayMove(displayedStatuses, currentIndex, targetIndex);
    setPreviewStatuses(reordered);
    void reorderStatusColumns(reordered.map((status) => status.id)).finally(
      () => setPreviewStatuses(null),
    );
  }

  async function moveAcrossLinkedLanes(
    task: TaskOverview,
    status: TaskStatus,
    plan: BoardMovePlan,
    reason?: string,
  ) {
    if (pending.has(task.id) || !canEditTaskOverview(role, currentUserId, task))
      return;

    const previousTasks = queryClient.getQueryData<TaskOverview[]>(
      taskKeys.all(workspaceId),
    );
    const targetLane = linkedLaneForStatus(status);
    const neutralLane: TaskWeekLane = task.due_date ? 'scheduled' : 'backlog';
    const weekLane = targetLane ?? neutralLane;
    const weekPosition = targetLane
      ? plan.position
      : nextWeekLanePosition(previousTasks ?? tasks, task.id, weekLane);

    setPending((current) => new Set(current).add(task.id));
    queryClient.setQueryData<TaskOverview[]>(
      taskKeys.all(workspaceId),
      (items) =>
        items?.map((item) => {
          if (item.id !== task.id) return item;
          if (targetLane) {
            return {
              ...item,
              week_lane: targetLane,
              week_position: weekPosition,
            };
          }
          return {
            ...item,
            status_id: status.id,
            status_name: status.name,
            status_category: status.category,
            status_color: status.color,
            board_position: plan.position,
            week_lane: neutralLane,
            week_position: weekPosition,
          };
        }),
    );

    const client = createClient();
    const weekResult = await client.rpc('move_task_in_week', {
      p_task_id: task.id,
      p_week_lane: weekLane,
      p_due_date: weekLane === 'scheduled' ? task.due_date : null,
      p_position: weekPosition,
      p_expected_version: task.version,
    });
    let error = weekResult.error;
    const version = rpcResultVersion(weekResult.data, task.version + 1);

    if (!error && !targetLane && task.status_id !== status.id) {
      const boardResult = await client.rpc('move_task_in_board', {
        p_workspace_id: workspaceId,
        p_task_id: task.id,
        p_status_id: status.id,
        p_before_task_id: plan.beforeTaskId,
        p_after_task_id: plan.afterTaskId,
        p_expected_version: version,
        p_blocked_reason: reason ?? null,
      });
      error = boardResult.error;
      if (
        error &&
        (error.code === 'PGRST202' ||
          error.message.includes('move_task_in_board'))
      ) {
        const fallback = await client.rpc('update_task', {
          p_task_id: task.id,
          p_expected_version: version,
          p_patch: {
            status_id: status.id,
            blocked_reason:
              status.category === 'blocked' ? (reason ?? null) : null,
          },
        });
        error = fallback.error;
      }
    }

    if (error) {
      if (previousTasks)
        queryClient.setQueryData<TaskOverview[]>(
          taskKeys.all(workspaceId),
          previousTasks,
        );
      toast.error(
        error.message.includes('PTA_VERSION_CONFLICT')
          ? 'Esta tarefa foi atualizada por outra pessoa.'
          : 'Não foi possível sincronizar Quadro e Semana.',
      );
    }
    await queryClient.invalidateQueries({
      queryKey: taskKeys.all(workspaceId),
    });
    setPending((current) => {
      const next = new Set(current);
      next.delete(task.id);
      return next;
    });
    if (!error) {
      setBlockedMove(undefined);
      setBlockedReason('');
    }
  }

  async function moveInBoard(
    task: TaskOverview,
    status: TaskStatus,
    plan: BoardMovePlan,
    reason?: string,
  ) {
    if (pending.has(task.id) || !canEditTaskOverview(role, currentUserId, task))
      return;
    const previousTasks = queryClient.getQueryData<TaskOverview[]>(
      taskKeys.all(workspaceId),
    );
    setPending((current) => new Set(current).add(task.id));
    queryClient.setQueryData<TaskOverview[]>(
      taskKeys.all(workspaceId),
      (items) =>
        items ? applyBoardMove(items, configuredStatuses, plan) : items,
    );

    const client = createClient();
    let { error } = await client.rpc('move_task_in_board', {
      p_workspace_id: workspaceId,
      p_task_id: task.id,
      p_status_id: status.id,
      p_before_task_id: plan.beforeTaskId,
      p_after_task_id: plan.afterTaskId,
      p_expected_version: task.version,
      p_blocked_reason: reason ?? null,
    });
    let unavailableOrdering = false;
    if (
      error &&
      (error.code === 'PGRST202' ||
        error.message.includes('move_task_in_board'))
    ) {
      if (task.status_id === status.id) {
        unavailableOrdering = true;
      } else {
        const fallback = await client.rpc('update_task', {
          p_task_id: task.id,
          p_expected_version: task.version,
          p_patch: {
            status_id: status.id,
            blocked_reason:
              status.category === 'blocked' ? (reason ?? null) : null,
          },
        });
        error = fallback.error;
      }
    }
    if (error) {
      if (previousTasks)
        queryClient.setQueryData<TaskOverview[]>(
          taskKeys.all(workspaceId),
          previousTasks,
        );
      if (unavailableOrdering) {
        toast.info(
          'A ordenação manual será liberada após a atualização do quadro no backend.',
        );
      } else
        toast.error(
          error.message.includes('PTA_VERSION_CONFLICT') ||
            error.message.includes('PTA_BOARD_ORDER_CONFLICT')
            ? 'Esta tarefa foi atualizada por outra pessoa.'
            : 'Não foi possível mover a tarefa.',
        );
    }
    await queryClient.invalidateQueries({
      queryKey: taskKeys.all(workspaceId),
    });
    setPending((current) => {
      const next = new Set(current);
      next.delete(task.id);
      return next;
    });
    if (!error) {
      setBlockedMove(undefined);
      setBlockedReason('');
    }
  }

  function planMove(event: DragOverEvent | DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return null;
    const workspaceTasks =
      queryClient.getQueryData<TaskOverview[]>(taskKeys.all(workspaceId)) ??
      tasks;
    return planBoardMove({
      tasks: workspaceTasks.map((task) =>
        normalizeTaskForLinkedBoard(task, reviewStatus, emergencyStatus),
      ),
      statuses: kanbanStatuses,
      taskId: String(event.active.id),
      overId: String(event.over.id),
      insertAfter: shouldInsertBoardTaskAfter(event, workspaceTasks),
    });
  }

  function onDragOver(event: DragOverEvent) {
    if (event.active.data.current?.type === 'kanban-column-sort') {
      const activeId = String(event.active.id);
      const overStatusId = String(
        event.over?.data.current?.statusId ?? event.over?.id ?? '',
      );
      const from = displayedStatuses.findIndex(
        (status) => status.id === activeId,
      );
      const to = displayedStatuses.findIndex(
        (status) => status.id === overStatusId,
      );
      if (from >= 0 && to >= 0 && from !== to)
        setPreviewStatuses(arrayMove(displayedStatuses, from, to));
      return;
    }
    const plan = planMove(event);
    if (!plan) return;
    setPreviewTasks(
      applyBoardMove(
        tasks.map((task) =>
          normalizeTaskForLinkedBoard(task, reviewStatus, emergencyStatus),
        ),
        kanbanStatuses,
        plan,
      ),
    );
  }

  function onDragEnd(event: DragEndEvent) {
    if (event.active.data.current?.type === 'kanban-column-sort') {
      const order = displayedStatuses.map((status) => status.id);
      setDraggingColumnId(null);
      setPreviewStatuses(null);
      void reorderStatusColumns(order);
      return;
    }
    setDraggingTask(null);
    setPreviewTasks(null);
    const task = tasks.find((item) => item.id === event.active.id);
    const plan = planMove(event);
    const status = kanbanStatuses.find((item) => item.id === plan?.statusId);
    if (!task || !status || !plan) return;
    const visualTask = normalizeTaskForLinkedBoard(
      task,
      reviewStatus,
      emergencyStatus,
    );
    if (
      visualTask.status_id === status.id &&
      visualTask.board_position === plan.position
    )
      return;
    if (status.category === 'blocked' && task.status_category !== 'blocked') {
      setBlockedMove({ task, status, plan });
      setBlockedReason('');
      return;
    }
    if (
      boardConfiguration.data?.source !== 'remote' &&
      (linkedLaneForStatus(status) || isLinkedBoardLane(task.week_lane))
    ) {
      void moveAcrossLinkedLanes(task, status, plan);
      return;
    }
    void moveInBoard(task, status, plan);
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={kanbanCardCollision}
        onDragStart={({ active }) => {
          if (active.data.current?.type === 'kanban-column-sort') {
            setDraggingColumnId(String(active.id));
            return;
          }
          setDraggingTask(tasks.find((task) => task.id === active.id) ?? null);
        }}
        onDragOver={onDragOver}
        onDragCancel={() => {
          setDraggingTask(null);
          setDraggingColumnId(null);
          setPreviewTasks(null);
          setPreviewStatuses(null);
        }}
        accessibility={{
          screenReaderInstructions: PIPELINE_SCREEN_READER_INSTRUCTIONS,
          announcements: statusDragAnnouncements(boardTasks, kanbanStatuses),
        }}
        onDragEnd={onDragEnd}
      >
        <TaskBoardViewport label="Quadro por status">
          <SortableContext
            items={displayedStatuses.map((status) => status.id)}
            strategy={horizontalListSortingStrategy}
          >
            {displayedStatuses.map((status, index) => {
              const column = statusColumns?.find(
                (item) => item.id === status.id,
              );
              const link = boardConfiguration.data?.links.find(
                (item) => item.status_id === status.id,
              );
              return (
                <StatusColumn
                  key={status.id}
                  status={status}
                  column={column}
                  linkedWeekLane={
                    link?.week_lane_key ??
                    linkedLaneForBoardStatus(status) ??
                    undefined
                  }
                  canManageColumns={Boolean(canManageColumns && column)}
                  canMoveLeft={index > 0}
                  canMoveRight={index < displayedStatuses.length - 1}
                  onMoveColumn={moveStatusColumn}
                  onUpdateColumn={updateStatusColumn}
                  archived={
                    status.id !== emergencyStatus.id &&
                    !configuredStatuses.some((item) => item.id === status.id)
                  }
                  tasks={boardTasks.filter(
                    (task) => task.status_id === status.id,
                  )}
                  role={role}
                  currentUserId={currentUserId}
                  pending={pending}
                  creation={{
                    workspaceId,
                    taskPrefix,
                    members,
                    role,
                    currentUserId,
                    initialEventId,
                  }}
                  today={today}
                  nowIso={nowIso}
                />
              );
            })}
          </SortableContext>
        </TaskBoardViewport>
        <TaskDragPreview task={draggingTask} today={today} nowIso={nowIso} />
        <ColumnDragPreview
          status={displayedStatuses.find(
            (status) => status.id === draggingColumnId,
          )}
        />
      </DndContext>

      <Dialog
        open={Boolean(blockedMove)}
        onOpenChange={(open) => {
          if (!open && (!blockedMove || !pending.has(blockedMove.task.id)))
            setBlockedMove(undefined);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Motivo do bloqueio</DialogTitle>
            <DialogDescription>
              Registre o impedimento para que a equipe saiba como destravar a
              tarefa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pipeline-blocked-reason">Motivo</Label>
            <Input
              id="pipeline-blocked-reason"
              autoFocus
              value={blockedReason}
              onChange={(event) => setBlockedReason(event.target.value)}
              placeholder="Ex.: aguardando aprovação"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(
                blockedMove && pending.has(blockedMove.task.id),
              )}
              onClick={() => setBlockedMove(undefined)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                !blockedReason.trim() ||
                !blockedMove ||
                pending.has(blockedMove.task.id)
              }
              onClick={() => {
                if (!blockedMove) return;
                if (isLinkedBoardLane(blockedMove.task.week_lane)) {
                  void moveAcrossLinkedLanes(
                    blockedMove.task,
                    blockedMove.status,
                    blockedMove.plan,
                    blockedReason.trim(),
                  );
                } else {
                  void moveInBoard(
                    blockedMove.task,
                    blockedMove.status,
                    blockedMove.plan,
                    blockedReason.trim(),
                  );
                }
              }}
            >
              {blockedMove && pending.has(blockedMove.task.id)
                ? 'Salvando…'
                : 'Bloquear tarefa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusColumn({
  status,
  column,
  linkedWeekLane,
  canManageColumns,
  canMoveLeft,
  canMoveRight,
  onMoveColumn,
  onUpdateColumn,
  archived,
  tasks,
  role,
  currentUserId,
  pending,
  creation,
  today,
  nowIso,
}: {
  status: TaskStatus;
  column?: TaskBoardStatusColumn;
  linkedWeekLane?: TaskWeekLane;
  canManageColumns: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMoveColumn: (columnId: string, direction: 'left' | 'right') => void;
  onUpdateColumn: (
    columnId: string,
    value: BoardColumnEditableValues,
  ) => Promise<void>;
  archived: boolean;
  tasks: TaskOverview[];
  role: WorkspaceRole;
  currentUserId: string;
  pending: Set<string>;
  creation: TaskCreationContext;
  today: string;
  nowIso: string;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: status.id,
    disabled: archived || !canManageColumns,
    data: { type: 'kanban-column-sort', statusId: status.id },
  });
  const orderedTasks = [...tasks].sort(compareBoardTasks);
  return (
    <div
      ref={setNodeRef}
      className={cn('h-full', isDragging && 'opacity-35')}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <TaskBoardColumn
        ref={null}
        id={`status-${status.id}`}
        title={statusDisplayName(status)}
        coverUrl={column?.cover_url}
        count={tasks.length}
        isOver={isOver}
        dragHandle={
          canManageColumns ? (
            <Button
              ref={setActivatorNodeRef}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Mover coluna ${statusDisplayName(status)}`}
              className="cursor-grab touch-none active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical aria-hidden="true" />
            </Button>
          ) : null
        }
        icon={
          <span
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-lg',
              boardColumnColorTone(column?.color, status.category),
            )}
            aria-hidden="true"
          >
            {column ? (
              <BoardColumnIconGlyph
                icon={boardColumnIcon(column.icon_key)}
                className="size-3.5"
              />
            ) : (
              <span className="size-2 rounded-full bg-current" />
            )}
          </span>
        }
        headerAction={
          column && canManageColumns ? (
            <BoardColumnControls
              columnId={status.id}
              value={{
                name: status.name,
                color: boardColumnColor(column.color),
                icon: boardColumnIcon(column.icon_key),
                coverUrl: column.cover_url,
                weekLink: boardColumnWeekLink(linkedWeekLane),
              }}
              canMoveLeft={canMoveLeft}
              canMoveRight={canMoveRight}
              automationCount={linkedWeekLane ? 1 : 0}
              onMove={onMoveColumn}
              onUpdate={onUpdateColumn}
              onOpenAutomations={() =>
                toast.info(
                  'O vínculo com a Semana fica no editor desta coluna.',
                )
              }
            />
          ) : null
        }
        action={
          archived ? null : (
            <CreateTaskButton
              creation={creation}
              initialStatusId={linkedWeekLane ? undefined : status.id}
              initialBlocked={status.category === 'blocked'}
              initialWeekLane={
                linkedWeekLane && linkedWeekLane !== 'scheduled'
                  ? linkedWeekLane
                  : undefined
              }
              label="Adicionar tarefa"
            />
          )
        }
      >
        <SortableContext
          items={orderedTasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {orderedTasks.map((task) => (
            <PipelineDraggableCard
              key={task.id}
              task={task}
              disabled={
                pending.has(task.id) ||
                !canEditTaskOverview(role, currentUserId, task)
              }
              today={today}
              nowIso={nowIso}
            />
          ))}
        </SortableContext>
        {!tasks.length ? (
          <TaskBoardEmpty>Nenhuma tarefa aqui.</TaskBoardEmpty>
        ) : null}
      </TaskBoardColumn>
    </div>
  );
}

function DayAgenda({
  tasks,
  dateKey,
  workspaceId,
  taskPrefix,
  members,
  role,
  currentUserId,
}: {
  tasks: TaskOverview[];
  dateKey: string;
  workspaceId: string;
  taskPrefix: string;
  members: WorkspaceMember[];
  role: WorkspaceRole;
  currentUserId: string;
}) {
  const dayTasks = tasks
    .filter((task) => task.due_date === dateKey)
    .sort(compareTaskSchedule);
  return (
    <div className="mx-auto max-w-4xl border-y">
      {dayTasks.length ? (
        <ol className="divide-y">
          {dayTasks.map((task) => (
            <li
              key={task.id}
              className="grid grid-cols-[5.5rem_1fr] gap-4 py-4 sm:grid-cols-[7rem_1fr] sm:py-5"
            >
              <div className="text-sm font-medium text-muted-foreground">
                {task.due_time ? task.due_time.slice(0, 5) : 'Sem horário'}
              </div>
              <TaskEditorialLink task={task} />
            </li>
          ))}
        </ol>
      ) : (
        <EmptyPeriod
          title="Dia livre"
          description="Não há tarefas com prazo nesta data."
        />
      )}
      <CreateTaskButton
        creation={{ workspaceId, taskPrefix, members, role, currentUserId }}
        initialDueDate={dateKey}
        label="Adicionar neste dia"
      />
    </div>
  );
}

function WeekList({
  tasks,
  dayKeys,
  today,
  nowIso,
  visibleFields,
}: {
  tasks: TaskOverview[];
  dayKeys: string[];
  today: string;
  nowIso: string;
  visibleFields: Set<TableField>;
}) {
  const weekTasks = tasks
    .filter((task) => dayKeys.includes(task.due_date ?? ''))
    .toSorted((left, right) => {
      const date = (left.due_date ?? '').localeCompare(right.due_date ?? '');
      return date || compareTaskSchedule(left, right);
    });

  if (!weekTasks.length) {
    return (
      <div className="rounded-xl border bg-card px-5">
        <EmptyPeriod
          title="Semana livre"
          description="Não há tarefas com prazo neste período."
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-muted/45 text-left text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            <tr className="border-b">
              <th className="w-[42%] px-5 py-3.5 font-medium">Tarefa</th>
              <th className="px-3 py-3.5 font-medium">Dia</th>
              {visibleFields.has('assignee') ? (
                <th className="px-3 py-3.5 font-medium">Responsável</th>
              ) : null}
              {visibleFields.has('status') ? (
                <th className="px-3 py-3.5 font-medium">Status</th>
              ) : null}
              {visibleFields.has('priority') ? (
                <th className="px-5 py-3.5 font-medium">Prioridade</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {weekTasks.map((task) => (
              <tr
                key={task.id}
                className="h-16 border-b transition-colors last:border-0 hover:bg-pta-blue/[0.04]"
              >
                <td className="px-5 py-2.5">
                  <TaskTitleLink task={task} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className="font-medium">
                    {capitalizeFirst(
                      format(dateFromKey(task.due_date ?? today), 'EEEE', {
                        locale: ptBR,
                      }),
                    )}
                  </span>
                  {task.due_time ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {task.due_time.slice(0, 5)}
                    </span>
                  ) : null}
                </td>
                {visibleFields.has('assignee') ? (
                  <td className="px-3 py-2.5">
                    <AssigneeSummary task={task} />
                  </td>
                ) : null}
                {visibleFields.has('status') ? (
                  <td className="px-3 py-2.5">
                    <TaskStatusBadge task={task} />
                  </td>
                ) : null}
                {visibleFields.has('priority') ? (
                  <td className="px-5 py-2.5">
                    <span
                      className={cn(
                        'inline-flex rounded-lg px-2 py-1 text-xs font-medium',
                        priorityTone(task.priority),
                      )}
                    >
                      {priorityLabels[task.priority]}
                    </span>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y lg:hidden">
        {weekTasks.map((task) => (
          <li key={task.id} className="px-4 py-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {capitalizeFirst(
                  format(
                    dateFromKey(task.due_date ?? today),
                    "EEEE, d 'de' MMM",
                    {
                      locale: ptBR,
                    },
                  ),
                )}
              </span>
              <TaskStatusBadge task={task} />
            </div>
            <TaskEditorialLink task={task} compact />
            {isTaskOverdue(task, nowIso) ? (
              <p className="mt-2 text-xs font-medium text-destructive">
                Prazo vencido
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WeekBoard({
  workspaceId,
  tasks,
  statuses,
  dayKeys,
  today,
  role,
  currentUserId,
  taskPrefix,
  members,
  nowIso,
}: {
  workspaceId: string;
  tasks: TaskOverview[];
  statuses: TaskStatus[];
  dayKeys: string[];
  today: string;
  role: WorkspaceRole;
  currentUserId: string;
  taskPrefix: string;
  members: WorkspaceMember[];
  nowIso: string;
}) {
  const [draggingTask, setDraggingTask] = useState<TaskOverview | null>(null);
  const [draggingLane, setDraggingLane] = useState<AuxiliaryWeekLane | null>(
    null,
  );
  const [previewLanes, setPreviewLanes] = useState<WeekLaneDefinition[] | null>(
    null,
  );
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const sensors = usePipelineSensors();
  const moveTask = useMoveTaskInWeek(workspaceId, tasks, pending, setPending);
  const boardConfiguration = useTaskBoardConfiguration(workspaceId, statuses);
  const updateColumn = useUpdateTaskBoardColumn(workspaceId);
  const reorderColumns = useReorderTaskBoardColumns(workspaceId);
  const weekColumns = boardConfiguration.data?.week_board.columns;
  const canManageColumns =
    boardConfiguration.data?.source === 'remote' &&
    boardConfiguration.data.permissions.can_manage_columns;
  const configuredLanes = useMemo(() => {
    if (!weekColumns) return [...WEEK_LANE_DEFINITIONS];
    const defaults = new Map(
      WEEK_LANE_DEFINITIONS.map((lane) => [lane.id, lane]),
    );
    return weekColumns
      .filter((column) => column.is_active && column.key !== 'scheduled')
      .flatMap((column): WeekLaneDefinition[] => {
        const fallback = defaults.get(column.key as AuxiliaryWeekLane);
        if (!fallback) return [];
        return [
          {
            ...fallback,
            label: column.name,
            iconKey: boardColumnIcon(column.icon_key),
            coverUrl: column.cover_url,
            color: column.color,
            position: column.position,
            version: column.version,
          },
        ];
      });
  }, [weekColumns]);
  const displayedLanes = previewLanes ?? configuredLanes;
  const workdayKeys = dayKeys.slice(0, 5);
  const weekendKeys = dayKeys.slice(5);
  const scheduledTasks = tasks.filter(
    (task) =>
      task.week_lane === 'scheduled' && dayKeys.includes(task.due_date ?? ''),
  );
  const weekendTasks = scheduledTasks.filter((task) =>
    weekendKeys.includes(task.due_date ?? ''),
  );
  const visibleDayKeys = weekendTasks.length ? dayKeys : workdayKeys;
  const planningLanes = displayedLanes.filter((lane) =>
    ['emergency', 'important', 'backlog'].includes(lane.id),
  );
  const remainingLanes = displayedLanes.filter(
    (lane) => !['emergency', 'important', 'backlog'].includes(lane.id),
  );
  const creation = {
    workspaceId,
    taskPrefix,
    members,
    role,
    currentUserId,
  };

  async function updateWeekColumn(
    columnKey: string,
    value: BoardColumnEditableValues,
  ) {
    const configuration = boardConfiguration.data;
    const column = configuration?.week_board.columns.find(
      (item) => item.key === columnKey,
    );
    if (!configuration || configuration.source !== 'remote' || !column)
      throw new Error('PTA_TASK_BOARD_CONFIGURATION_UNAVAILABLE');
    await updateColumn.mutateAsync({
      boardKind: 'week',
      columnKey,
      name: value.name,
      color: value.color,
      iconKey: value.icon,
      coverUrl: value.coverUrl,
      expectedBoardVersion: configuration.week_board.version,
      expectedColumnVersion: column.version,
    });
    toast.success('Coluna da Semana atualizada.');
  }

  async function persistWeekLaneOrder(lanes: WeekLaneDefinition[]) {
    const configuration = boardConfiguration.data;
    if (!configuration || configuration.source !== 'remote') return;
    const reorderedKeys = lanes.map((lane) => lane.id);
    let cursor = 0;
    const orderedKeys = configuration.week_board.columns
      .filter((column) => column.is_active)
      .map((column) =>
        column.key === 'scheduled'
          ? column.key
          : (reorderedKeys[cursor++] ?? column.key),
      );
    try {
      await reorderColumns.mutateAsync({
        boardKind: 'week',
        orderedKeys,
        expectedBoardVersion: configuration.week_board.version,
      });
      toast.success('Ordem da Semana atualizada.');
    } catch {
      toast.error('Não foi possível reordenar as colunas da Semana.');
      await boardConfiguration.refetch();
    }
  }

  function moveWeekLane(columnId: string, direction: 'left' | 'right') {
    const group = weekLaneGroup(displayedLanes, columnId as AuxiliaryWeekLane);
    const currentIndex = group.findIndex((lane) => lane.id === columnId);
    const targetIndex = currentIndex + (direction === 'left' ? -1 : 1);
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= group.length)
      return;
    const reordered = reorderWeekLaneGroup(
      displayedLanes,
      columnId as AuxiliaryWeekLane,
      group[targetIndex].id,
    );
    setPreviewLanes(reordered);
    void persistWeekLaneOrder(reordered).finally(() => setPreviewLanes(null));
  }

  function onWeekDragOver(event: DragOverEvent) {
    if (event.active.data.current?.type !== 'week-column-sort') return;
    const activeId = event.active.data.current.laneId as AuxiliaryWeekLane;
    const overId = event.over?.data.current?.laneId as
      AuxiliaryWeekLane | undefined;
    if (!overId) return;
    const group = weekLaneGroup(displayedLanes, activeId);
    if (!group.some((lane) => lane.id === overId)) return;
    if (activeId !== overId)
      setPreviewLanes(reorderWeekLaneGroup(displayedLanes, activeId, overId));
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={weekBoardCollision}
        onDragStart={({ active }) => {
          if (active.data.current?.type === 'week-column-sort') {
            const laneId = active.data.current.laneId as AuxiliaryWeekLane;
            setDraggingLane(laneId);
            return;
          }
          setDraggingTask(tasks.find((task) => task.id === active.id) ?? null);
        }}
        onDragOver={onWeekDragOver}
        onDragCancel={() => {
          setDraggingTask(null);
          setDraggingLane(null);
          setPreviewLanes(null);
        }}
        accessibility={{
          screenReaderInstructions: PIPELINE_SCREEN_READER_INSTRUCTIONS,
          announcements: weekDragAnnouncements(tasks, displayedLanes),
        }}
        onDragEnd={(event) => {
          if (event.active.data.current?.type === 'week-column-sort') {
            const order = displayedLanes;
            setDraggingLane(null);
            setPreviewLanes(null);
            void persistWeekLaneOrder(order);
            return;
          }
          setDraggingTask(null);
          const task = tasks.find((item) => item.id === event.active.id);
          const overTask = tasks.find((item) => item.id === event.over?.id);
          const target = overTask
            ? {
                lane: overTask.week_lane,
                dateKey:
                  overTask.week_lane === 'scheduled' ? overTask.due_date : null,
              }
            : parseWeekDropTarget(event.over?.id);
          if (
            task &&
            target &&
            task.id !== overTask?.id &&
            canEditTaskOverview(role, currentUserId, task)
          ) {
            const peers = tasks
              .filter(
                (item) =>
                  item.id !== task.id &&
                  item.week_lane === target.lane &&
                  (target.lane !== 'scheduled' ||
                    item.due_date === target.dateKey),
              )
              .sort((a, b) => a.week_position - b.week_position);
            let position: number | undefined;
            if (overTask) {
              const index = peers.findIndex((item) => item.id === overTask.id);
              const after = Boolean(
                event.active.rect.current.translated &&
                event.over &&
                event.active.rect.current.translated.top > event.over.rect.top,
              );
              const insertion = index + (after ? 1 : 0);
              const before = peers[insertion - 1]?.week_position;
              const next = peers[insertion]?.week_position;
              position =
                before === undefined
                  ? (next ?? 2000) / 2
                  : next === undefined
                    ? before + 1000
                    : (before + next) / 2;
            }
            void moveTask(task, target, position);
          }
        }}
      >
        <TaskBoardViewport label="Planejamento da minha semana">
          <SortableContext
            items={planningLanes.map((lane) => weekColumnSortId(lane.id))}
            strategy={horizontalListSortingStrategy}
          >
            {planningLanes.map((lane, index) => (
              <OperationalWeekLane
                key={lane.id}
                lane={lane}
                tasks={tasks.filter((task) =>
                  taskBelongsToAuxiliaryLane(task, lane.id, dayKeys[0]),
                )}
                today={today}
                nowIso={nowIso}
                role={role}
                currentUserId={currentUserId}
                pending={pending}
                creation={creation}
                canManageColumns={canManageColumns}
                canMoveLeft={index > 0}
                canMoveRight={index < planningLanes.length - 1}
                onMoveColumn={moveWeekLane}
                onUpdateColumn={updateWeekColumn}
              />
            ))}
          </SortableContext>
          {visibleDayKeys.map((dateKey) => (
            <DateColumn
              key={dateKey}
              dateKey={dateKey}
              today={today}
              tasks={scheduledTasks.filter((task) => task.due_date === dateKey)}
              role={role}
              currentUserId={currentUserId}
              pending={pending}
              creation={creation}
              nowIso={nowIso}
            />
          ))}
          <SortableContext
            items={remainingLanes.map((lane) => weekColumnSortId(lane.id))}
            strategy={horizontalListSortingStrategy}
          >
            {remainingLanes.map((lane, index) => (
              <OperationalWeekLane
                key={lane.id}
                lane={lane}
                tasks={tasks.filter((task) =>
                  taskBelongsToAuxiliaryLane(task, lane.id, dayKeys[0]),
                )}
                today={today}
                nowIso={nowIso}
                role={role}
                currentUserId={currentUserId}
                pending={pending}
                creation={creation}
                canManageColumns={canManageColumns}
                canMoveLeft={index > 0}
                canMoveRight={index < remainingLanes.length - 1}
                onMoveColumn={moveWeekLane}
                onUpdateColumn={updateWeekColumn}
              />
            ))}
          </SortableContext>
        </TaskBoardViewport>
        <TaskDragPreview task={draggingTask} today={today} nowIso={nowIso} />
        <WeekLaneDragPreview
          lane={displayedLanes.find((lane) => lane.id === draggingLane)}
        />
      </DndContext>
    </>
  );
}

function DateColumn({
  dateKey,
  today,
  tasks,
  role,
  currentUserId,
  pending,
  creation,
  nowIso,
}: {
  dateKey: string;
  today: string;
  tasks: TaskOverview[];
  role: WorkspaceRole;
  currentUserId: string;
  pending: Set<string>;
  creation: TaskCreationContext;
  nowIso: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: weekDayDropId(dateKey),
  });
  const date = dateFromKey(dateKey);
  return (
    <TaskBoardColumn
      ref={setNodeRef}
      id={`pipeline-day-${dateKey}`}
      title={capitalizeFirst(format(date, 'EEEE', { locale: ptBR }))}
      count={tasks.length}
      isOver={isOver}
      highlighted={dateKey === today}
      icon={
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-xl text-base font-semibold tabular-nums',
            dateKey === today
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-foreground',
          )}
        >
          {format(date, 'd')}
        </span>
      }
      description={
        <span className="flex items-center gap-2">
          <span>{format(date, "d 'de' MMM", { locale: ptBR })}</span>
          {dateKey === today ? (
            <span className="font-medium text-primary">Hoje</span>
          ) : null}
        </span>
      }
      action={
        <CreateTaskButton
          creation={creation}
          initialDueDate={dateKey}
          label="Adicionar tarefa"
          ariaLabel={`Adicionar tarefa em ${capitalizeFirst(format(date, 'EEEE', { locale: ptBR }))}`}
        />
      }
    >
      <SortableContext
        items={[...tasks]
          .sort((a, b) => a.week_position - b.week_position)
          .map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        {[...tasks]
          .sort((a, b) => a.week_position - b.week_position)
          .map((task) => (
            <PipelineDraggableCard
              key={task.id}
              task={task}
              today={today}
              nowIso={nowIso}
              disabled={
                pending.has(task.id) ||
                !canEditTaskOverview(role, currentUserId, task)
              }
            />
          ))}
      </SortableContext>
      {!tasks.length ? <TaskBoardEmpty>Nada planejado</TaskBoardEmpty> : null}
    </TaskBoardColumn>
  );
}

function OperationalWeekLane({
  lane,
  tasks,
  today,
  nowIso,
  role,
  currentUserId,
  pending,
  creation,
  canManageColumns,
  canMoveLeft,
  canMoveRight,
  onMoveColumn,
  onUpdateColumn,
}: {
  lane: WeekLaneDefinition;
  tasks: TaskOverview[];
  today: string;
  nowIso: string;
  role: WorkspaceRole;
  currentUserId: string;
  pending: Set<string>;
  creation: TaskCreationContext;
  canManageColumns: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMoveColumn: (columnId: string, direction: 'left' | 'right') => void;
  onUpdateColumn: (
    columnId: string,
    value: BoardColumnEditableValues,
  ) => Promise<void>;
}) {
  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: weekLaneDropId(lane.id),
    data: { type: 'week-task-lane', laneId: lane.id },
  });
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef: setSortNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: weekColumnSortId(lane.id),
    disabled: !canManageColumns,
    data: { type: 'week-column-sort', laneId: lane.id },
  });
  const Icon = lane.icon;
  return (
    <div
      ref={setSortNodeRef}
      className={cn('h-full', isDragging && 'opacity-35')}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <TaskBoardColumn
        ref={setDropNodeRef}
        id={`week-lane-${lane.id}`}
        title={lane.label}
        coverUrl={lane.coverUrl}
        description={lane.description}
        count={tasks.length}
        isOver={isOver}
        dragHandle={
          canManageColumns ? (
            <Button
              ref={setActivatorNodeRef}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Mover coluna ${lane.label}`}
              className="cursor-grab touch-none active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical aria-hidden="true" />
            </Button>
          ) : null
        }
        icon={
          <span
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-lg bg-background',
              lane.color ? boardColumnColorTone(lane.color) : lane.tone,
            )}
          >
            {lane.iconKey ? (
              <BoardColumnIconGlyph icon={lane.iconKey} className="size-4" />
            ) : (
              <Icon aria-hidden="true" className="size-4" />
            )}
          </span>
        }
        headerAction={
          canManageColumns ? (
            <BoardColumnControls
              columnId={lane.id}
              value={{
                name: lane.label,
                color: boardColumnColor(lane.color),
                icon: lane.iconKey ?? boardColumnIcon(undefined),
                coverUrl: lane.coverUrl,
                weekLink: 'none',
              }}
              canMoveLeft={canMoveLeft}
              canMoveRight={canMoveRight}
              showWeekLink={false}
              onMove={onMoveColumn}
              onUpdate={onUpdateColumn}
              onOpenAutomations={() =>
                toast.info(
                  'As automações com o Quadro são configuradas nas colunas de status.',
                )
              }
            />
          ) : null
        }
        action={
          <CreateTaskButton
            creation={creation}
            initialWeekLane={lane.id}
            label="Adicionar tarefa"
            ariaLabel={`Adicionar tarefa em ${lane.label}`}
          />
        }
      >
        <SortableContext
          items={[...tasks]
            .sort((a, b) => a.week_position - b.week_position)
            .map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {[...tasks]
            .sort((a, b) => a.week_position - b.week_position)
            .map((task) => (
              <PipelineDraggableCard
                key={task.id}
                task={task}
                today={today}
                nowIso={nowIso}
                disabled={
                  pending.has(task.id) ||
                  !canEditTaskOverview(role, currentUserId, task)
                }
              />
            ))}
        </SortableContext>
        {!tasks.length ? (
          <TaskBoardEmpty>Nenhuma tarefa aqui.</TaskBoardEmpty>
        ) : null}
      </TaskBoardColumn>
    </div>
  );
}

function WeekCalendar({
  workspaceId,
  tasks,
  referenceDate,
  month,
  today,
  role,
  currentUserId,
  onOpenDay,
}: {
  workspaceId: string;
  tasks: TaskOverview[];
  referenceDate: string;
  month: boolean;
  today: string;
  role: WorkspaceRole;
  currentUserId: string;
  onOpenDay: (dateKey: string) => void;
}) {
  const reference = dateFromKey(referenceDate);
  const gridKeys = month
    ? eachDayOfInterval({
        start: startOfWeek(startOfMonth(reference), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(reference), { weekStartsOn: 1 }),
      }).map(toDateKey)
    : calendarWeekKeysFromDate(referenceDate);
  const periodTasks = tasks.filter((task) =>
    gridKeys.includes(task.due_date ?? ''),
  );
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const sensors = usePipelineSensors();
  const moveTask = useMoveTaskToDate(workspaceId, tasks, pending, setPending);

  return (
    <>
      <DndContext
        sensors={sensors}
        accessibility={{
          screenReaderInstructions: PIPELINE_SCREEN_READER_INSTRUCTIONS,
          announcements: dateDragAnnouncements(tasks),
        }}
        onDragEnd={(event) => {
          const task = tasks.find((item) => item.id === event.active.id);
          const dateKey =
            typeof event.over?.id === 'string' ? event.over.id : '';
          if (
            task &&
            dateKey &&
            gridKeys.includes(dateKey) &&
            canEditTaskOverview(role, currentUserId, task)
          )
            void moveTask(task, dateKey);
        }}
      >
        <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
          <div className="grid grid-cols-7 border-b bg-muted/55">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
              <span
                key={day}
                className="border-r px-3 py-2 text-center text-xs font-medium text-muted-foreground last:border-r-0"
              >
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {gridKeys.map((dateKey) => (
              <MonthDay
                key={dateKey}
                dateKey={dateKey}
                today={today}
                tasks={tasks.filter((task) => task.due_date === dateKey)}
                role={role}
                currentUserId={currentUserId}
                pending={pending}
                onOpenDay={onOpenDay}
                muted={
                  month && dateKey.slice(0, 7) !== referenceDate.slice(0, 7)
                }
              />
            ))}
          </div>
        </div>
      </DndContext>
      <div className="space-y-3 md:hidden">
        {periodTasks.length ? (
          gridKeys.map((dateKey) => {
            const dayTasks = periodTasks
              .filter((task) => task.due_date === dateKey)
              .sort(compareTaskSchedule);
            if (!dayTasks.length) return null;
            return (
              <section key={dateKey} className="pta-panel overflow-hidden">
                <button
                  type="button"
                  onClick={() => onOpenDay(dateKey)}
                  className="flex min-h-11 w-full items-center justify-between border-b bg-muted/55 px-4 py-2 text-left text-sm font-semibold transition-colors hover:bg-pta-blue/[0.07] hover:text-pta-blue"
                >
                  {format(dateFromKey(dateKey), "EEEE, d 'de' MMMM", {
                    locale: ptBR,
                  })}
                  <ChevronRight aria-hidden="true" className="size-4" />
                </button>
                <div className="divide-y px-4">
                  {dayTasks.map((task) => (
                    <TaskEditorialLink key={task.id} task={task} compact />
                  ))}
                </div>
              </section>
            );
          })
        ) : (
          <div className="border-y">
            <EmptyPeriod
              title={month ? 'Mês livre' : 'Semana livre'}
              description={
                month
                  ? 'Não há tarefas com prazo neste mês.'
                  : 'Não há tarefas com prazo nesta semana.'
              }
            />
          </div>
        )}
      </div>
    </>
  );
}

function MonthDay({
  dateKey,
  today,
  tasks,
  role,
  currentUserId,
  pending,
  onOpenDay,
  muted = false,
}: {
  dateKey: string;
  today: string;
  tasks: TaskOverview[];
  role: WorkspaceRole;
  currentUserId: string;
  pending: Set<string>;
  onOpenDay: (dateKey: string) => void;
  muted?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey });
  const date = dateFromKey(dateKey);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-52 border-r p-2 transition-colors [&:nth-child(7n)]:border-r-0',
        dateKey === today && 'bg-pta-blue/[0.06]',
        muted && 'bg-muted/20 text-muted-foreground/65',
        isOver && 'bg-pta-blue/[0.12] ring-2 ring-inset ring-pta-blue/20',
      )}
    >
      <button
        type="button"
        onClick={() => onOpenDay(dateKey)}
        className={cn(
          'mb-1.5 grid size-7 place-items-center rounded-full text-xs font-medium transition-colors hover:bg-pta-blue/[0.09] hover:text-pta-blue',
          dateKey === today &&
            'bg-pta-blue text-primary-foreground shadow-sm hover:bg-pta-blue/90 hover:text-primary-foreground',
        )}
        aria-label={format(date, "d 'de' MMMM", { locale: ptBR })}
      >
        {format(date, 'd')}
      </button>
      <div className="space-y-1">
        {[...tasks]
          .sort(compareTaskSchedule)
          .slice(0, 3)
          .map((task) => (
            <CompactDraggableTask
              key={task.id}
              task={task}
              disabled={
                pending.has(task.id) ||
                !canEditTaskOverview(role, currentUserId, task)
              }
            />
          ))}
        {tasks.length > 3 ? (
          <button
            type="button"
            onClick={() => onOpenDay(dateKey)}
            className="w-full rounded px-1.5 py-1 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-pta-blue/[0.08] hover:text-pta-blue"
          >
            Mais {tasks.length - 3}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TaskTable({
  tasks,
  today,
  nowIso,
  visibleFields,
}: {
  tasks: TaskOverview[];
  today: string;
  nowIso: string;
  visibleFields: Set<TableField>;
}) {
  const pageSize = 20;
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const totalPages = Math.max(1, Math.ceil(tasks.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageTasks = tasks.slice((safePage - 1) * pageSize, safePage * pageSize);
  const firstItem = tasks.length ? (safePage - 1) * pageSize + 1 : 0;
  const lastItem = Math.min(safePage * pageSize, tasks.length);
  const allPageSelected =
    pageTasks.length > 0 && pageTasks.every((task) => selectedIds.has(task.id));
  const somePageSelected = pageTasks.some((task) => selectedIds.has(task.id));
  const selectedTasks = tasks.filter((task) => selectedIds.has(task.id));

  function togglePageSelection() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allPageSelected) pageTasks.forEach((task) => next.delete(task.id));
      else pageTasks.forEach((task) => next.add(task.id));
      return next;
    });
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {selectedTasks.length ? (
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b bg-pta-blue/[0.055] px-4 py-2 text-sm">
          <strong>
            {selectedTasks.length}{' '}
            {selectedTasks.length === 1
              ? 'tarefa selecionada'
              : 'tarefas selecionadas'}
          </strong>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadTasksCsv(selectedTasks)}
            >
              <Download aria-hidden="true" />
              Exportar seleção
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Limpar
            </Button>
          </div>
        </div>
      ) : null}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead className="bg-muted/55 text-left text-xs font-medium text-muted-foreground">
            <tr className="border-b">
              <th className="w-12 px-5 py-3.5 font-medium">
                <Checkbox
                  checked={
                    allPageSelected
                      ? true
                      : somePageSelected
                        ? 'indeterminate'
                        : false
                  }
                  onCheckedChange={togglePageSelection}
                  aria-label="Selecionar tarefas desta página"
                />
              </th>
              <th className="w-[38%] px-3 py-3.5 font-medium">Tarefa</th>
              {visibleFields.has('status') ? (
                <th className="px-3 py-3.5 font-medium">Status</th>
              ) : null}
              {visibleFields.has('context') ? (
                <th className="px-3 py-3.5 font-medium">Contexto</th>
              ) : null}
              {visibleFields.has('assignee') ? (
                <th className="px-3 py-3.5 font-medium">Responsável</th>
              ) : null}
              {visibleFields.has('due') ? (
                <th className="px-3 py-3.5 font-medium">Prazo</th>
              ) : null}
              {visibleFields.has('priority') ? (
                <th className="px-5 py-3.5 font-medium">Prioridade</th>
              ) : null}
              <th className="w-12 px-3 py-3.5 font-medium">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageTasks.map((task) => (
              <tr
                key={task.id}
                className="h-16 border-b transition-colors last:border-0 hover:bg-pta-blue/[0.045]"
              >
                <td className="px-5 py-2.5">
                  <Checkbox
                    checked={selectedIds.has(task.id)}
                    onCheckedChange={() => toggleTaskSelection(task.id)}
                    aria-label={`Selecionar ${task.title}`}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <TaskTypeIcon task={task} />
                    <TaskTitleLink task={task} />
                  </div>
                </td>
                {visibleFields.has('status') ? (
                  <td className="px-3 py-2.5">
                    <TaskStatusBadge task={task} />
                  </td>
                ) : null}
                {visibleFields.has('context') ? (
                  <td className="max-w-60 px-3 py-2.5">
                    <TaskContextBadges task={task} />
                  </td>
                ) : null}
                {visibleFields.has('assignee') ? (
                  <td className="px-3 py-2.5">
                    <AssigneeSummary task={task} />
                  </td>
                ) : null}
                {visibleFields.has('due') ? (
                  <td
                    className={cn(
                      'whitespace-nowrap px-3 py-2.5 text-muted-foreground',
                      isTaskOverdue(task, nowIso) &&
                        'font-medium text-destructive',
                    )}
                  >
                    <span className="block">
                      {formatDueDate(task.due_date, today)}
                    </span>
                    {task.due_time ? (
                      <span className="mt-0.5 block text-xs opacity-75">
                        {task.due_time.slice(0, 5)}
                      </span>
                    ) : null}
                  </td>
                ) : null}
                {visibleFields.has('priority') ? (
                  <td className="px-5 py-2.5">
                    <span
                      className={cn(
                        'inline-flex rounded-md px-2 py-1 text-xs font-medium',
                        priorityTone(task.priority),
                      )}
                    >
                      {priorityLabels[task.priority]}
                    </span>
                  </td>
                ) : null}
                <td className="w-12 px-3 py-2.5">
                  <Button
                    asChild
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:bg-pta-blue/[0.08] hover:text-pta-blue"
                  >
                    <TaskDetailLink
                      taskId={task.id}
                      aria-label={`Abrir ${task.title}`}
                    >
                      <ChevronRight aria-hidden="true" />
                    </TaskDetailLink>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y lg:hidden">
        {pageTasks.map((task) => (
          <li
            key={task.id}
            className="px-4 py-4 transition-colors hover:bg-pta-blue/[0.035]"
          >
            <div className="flex items-start gap-3">
              <Checkbox
                checked={selectedIds.has(task.id)}
                onCheckedChange={() => toggleTaskSelection(task.id)}
                aria-label={`Selecionar ${task.title}`}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <TaskEditorialLink task={task} compact />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <TaskContextBadges task={task} />
              <span
                className={cn(
                  'shrink-0 text-xs text-muted-foreground',
                  isTaskOverdue(task, nowIso) && 'font-medium text-destructive',
                )}
              >
                {formatDueDate(task.due_date, today)}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-t bg-muted/25 px-5 py-2 text-xs text-muted-foreground">
        <span>
          Mostrando {firstItem} a {lastItem} de {tasks.length}
        </span>
        {totalPages > 1 ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={safePage === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </Button>
            <span className="px-2 tabular-nums">
              {safePage} de {totalPages}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={safePage === totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              Próxima
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TaskContextBadges({ task }: { task: TaskOverview }) {
  if (!task.type_name && !task.product_name && !task.event_name)
    return <span className="text-xs text-muted-foreground">Geral</span>;

  return (
    <div className="flex max-w-60 flex-wrap gap-1.5">
      {task.type_name ? (
        <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
          {task.type_name}
        </span>
      ) : null}
      {task.product_name ? (
        <span className="rounded-md bg-pta-blue/10 px-2 py-1 text-xs font-medium text-pta-blue dark:bg-pta-blue/20">
          {task.product_name}
        </span>
      ) : null}
      {task.event_name ? (
        <span className="rounded-md bg-pta-purple/10 px-2 py-1 text-xs font-medium text-pta-purple dark:bg-pta-purple/20">
          {task.event_name}
        </span>
      ) : null}
    </div>
  );
}

function TaskTypeIcon({ task }: { task: TaskOverview }) {
  const type = task.type_name?.toLocaleLowerCase('pt-BR') ?? '';
  let icon = <ListTodo aria-hidden="true" className="size-4" />;
  if (type.includes('página') || type.includes('pagina'))
    icon = <PanelTop aria-hidden="true" className="size-4" />;
  else if (type.includes('criativ') || type.includes('design'))
    icon = <LayoutGrid aria-hidden="true" className="size-4" />;
  else if (type.includes('automa'))
    icon = <Zap aria-hidden="true" className="size-4" />;
  else if (type.includes('vídeo') || type.includes('video'))
    icon = <Play aria-hidden="true" className="size-4" />;
  else if (type.includes('texto') || type.includes('copy'))
    icon = <FileText aria-hidden="true" className="size-4" />;
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-pta-blue/10 text-pta-blue ring-1 ring-pta-blue/15 dark:bg-pta-blue/20">
      {icon}
    </span>
  );
}

function AssigneeSummary({ task }: { task: TaskOverview }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-foreground ring-1 ring-border">
        {personInitials(task.primary_assignee_name)}
      </span>
      <span className="max-w-32 truncate">
        {task.primary_assignee_name ?? 'Sem responsável'}
      </span>
    </div>
  );
}

function PipelineDraggableCard({
  task,
  disabled,
  today,
  nowIso,
}: {
  task: TaskOverview;
  disabled: boolean;
  today?: string;
  nowIso: string;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled,
    data: { type: 'kanban-task', statusId: task.status_id },
    transition: {
      duration: 150,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    },
  });
  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      onPointerDown={(event) => {
        if (event.pointerType !== 'touch') listeners?.onPointerDown?.(event);
      }}
      className={cn(
        'pta-task-card group relative overflow-hidden rounded-lg border border-border/65 bg-card transition-[border-color,box-shadow,opacity,transform] duration-150 hover:border-primary/35 focus-within:border-primary/50 motion-reduce:transition-none',
        !disabled && 'cursor-grab select-none active:cursor-grabbing',
        isDragging && 'opacity-30 ring-2 ring-primary/25',
      )}
    >
      <TaskDetailLink
        taskId={task.id}
        className="absolute inset-0 z-0 rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label={`Abrir ${task.title}`}
        draggable={false}
      />
      <TaskCardContent
        task={task}
        nowIso={nowIso}
        today={today}
        dragHandle={
          !disabled ? (
            <div className="flex items-center">
              <TaskCardActions task={task} />
              <button
                ref={setActivatorNodeRef}
                id={`task-drag-${task.id}`}
                type="button"
                className="grid size-11 shrink-0 touch-none place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:bg-accent lg:size-9"
                aria-label={`Mover ${task.title}`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  listeners?.onPointerDown?.(event);
                }}
                onKeyDown={(event) => listeners?.onKeyDown?.(event)}
                {...attributes}
              >
                <GripVertical aria-hidden="true" className="size-4" />
              </button>
            </div>
          ) : undefined
        }
      />
    </article>
  );
}

function TaskDragPreview({
  task,
  today,
  nowIso,
}: {
  task: TaskOverview | null;
  today: string;
  nowIso: string;
}) {
  const mounted = useSyncExternalStore(
    subscribeToClientEnvironment,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return createPortal(
    <DragOverlay
      dropAnimation={{
        duration: 180,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
      zIndex={70}
    >
      {task ? (
        <div
          aria-hidden="true"
          className="pta-task-card h-full cursor-grabbing overflow-hidden rounded-lg border border-primary/40 bg-card shadow-2xl"
        >
          <TaskCardContent
            task={task}
            today={today}
            nowIso={nowIso}
            dragHandle={
              <span className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground lg:size-9">
                <GripVertical className="size-4" />
              </span>
            }
          />
        </div>
      ) : null}
    </DragOverlay>,
    document.body,
  );
}

function ColumnDragPreview({ status }: { status?: TaskStatus }) {
  if (!status || typeof document === 'undefined') return null;
  return createPortal(
    <DragOverlay
      dropAnimation={{
        duration: 220,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
      zIndex={71}
    >
      <div className="w-[320px] rounded-2xl border border-primary/40 bg-popover/95 px-4 py-5 shadow-2xl backdrop-blur-xl xl:w-[336px]">
        <p className="text-[15px] font-semibold">{statusDisplayName(status)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Solte entre as colunas para reposicionar
        </p>
      </div>
    </DragOverlay>,
    document.body,
  );
}

function WeekLaneDragPreview({ lane }: { lane?: WeekLaneDefinition }) {
  if (!lane || typeof document === 'undefined') return null;
  return createPortal(
    <DragOverlay
      dropAnimation={{
        duration: 220,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
      zIndex={71}
    >
      <div className="w-[320px] rounded-2xl border border-primary/40 bg-popover/95 px-4 py-5 shadow-2xl backdrop-blur-xl xl:w-[336px]">
        <p className="text-[15px] font-semibold">{lane.label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Solte entre as colunas deste grupo para reposicionar
        </p>
      </div>
    </DragOverlay>,
    document.body,
  );
}

function subscribeToClientEnvironment() {
  return () => {};
}

const kanbanCardCollision: CollisionDetection = (args) => {
  const collisions = args.pointerCoordinates
    ? pointerWithin(args)
    : rectIntersection(args);
  if (args.active.data.current?.type === 'kanban-column-sort') {
    const columnCollisions = collisions.filter(
      (collision) =>
        args.droppableContainers.find(
          (container) => container.id === collision.id,
        )?.data.current?.type === 'kanban-column-sort',
    );
    return columnCollisions.length > 0 ? columnCollisions : collisions;
  }
  const cardCollisions = collisions.filter(
    (collision) =>
      args.droppableContainers.find(
        (container) => container.id === collision.id,
      )?.data.current?.type === 'kanban-task',
  );
  return cardCollisions.length > 0 ? cardCollisions : collisions;
};

const weekBoardCollision: CollisionDetection = (args) => {
  const collisions = args.pointerCoordinates
    ? pointerWithin(args)
    : rectIntersection(args);
  if (args.active.data.current?.type !== 'week-column-sort') {
    const cards = collisions.filter(
      (collision) =>
        args.droppableContainers.find(
          (container) => container.id === collision.id,
        )?.data.current?.type === 'kanban-task',
    );
    return cards.length ? cards : collisions;
  }
  const columnCollisions = collisions.filter(
    (collision) =>
      args.droppableContainers.find(
        (container) => container.id === collision.id,
      )?.data.current?.type === 'week-column-sort',
  );
  return columnCollisions.length > 0 ? columnCollisions : collisions;
};

function shouldInsertBoardTaskAfter(
  event: DragOverEvent | DragEndEvent,
  tasks: TaskOverview[],
) {
  const over = event.over;
  const activeTask = tasks.find((task) => task.id === event.active.id);
  const overTask = tasks.find((task) => task.id === over?.id);
  if (!activeTask || !overTask || !over) return false;

  if (activeTask.status_id === overTask.status_id) {
    const ordered = tasks
      .filter((task) => task.status_id === activeTask.status_id)
      .toSorted(compareBoardTasks);
    const activeIndex = ordered.findIndex((task) => task.id === activeTask.id);
    const overIndex = ordered.findIndex((task) => task.id === overTask.id);
    if (activeIndex >= 0 && overIndex >= 0 && activeIndex < overIndex)
      return true;
  }

  const translated = event.active.rect.current.translated;
  return translated
    ? translated.top + translated.height / 2 >
        over.rect.top + over.rect.height / 2
    : false;
}

function CompactDraggableTask({
  task,
  disabled,
}: {
  task: TaskOverview;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: task.id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        'group flex items-center gap-1 rounded-md bg-muted/75 px-1.5 py-1 text-xs transition-colors hover:bg-pta-blue/[0.09]',
        isDragging &&
          'z-50 bg-pta-blue/[0.12] opacity-75 shadow-lg ring-1 ring-pta-blue/30',
      )}
    >
      <TaskDetailLink
        taskId={task.id}
        className="min-w-0 flex-1 truncate rounded-sm font-medium"
      >
        {task.title}
      </TaskDetailLink>
      {!disabled ? (
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="grid size-11 shrink-0 touch-none place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary lg:size-8"
          aria-label={`Mover ${task.title}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical aria-hidden="true" className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

function TaskTitleLink({
  task,
  compact = false,
}: {
  task: TaskOverview;
  compact?: boolean;
}) {
  return (
    <TaskDetailLink
      taskId={task.id}
      className="block min-w-0 flex-1 rounded-sm transition-colors hover:text-pta-blue focus-visible:text-pta-blue"
    >
      <span
        className={cn(
          'block font-semibold leading-5',
          compact ? 'line-clamp-2 text-sm' : 'truncate',
          isClosed(task.status_category) &&
            'text-muted-foreground line-through',
        )}
      >
        {task.title}
      </span>
      {!compact ? (
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {task.type_name ?? 'Tarefa'}
        </span>
      ) : null}
    </TaskDetailLink>
  );
}

function TaskEditorialLink({
  task,
  compact = false,
}: {
  task: TaskOverview;
  compact?: boolean;
}) {
  return (
    <TaskDetailLink
      taskId={task.id}
      className={cn(
        'block min-w-0 rounded-sm transition-colors hover:text-pta-blue focus-visible:text-pta-blue',
        compact && 'py-4',
      )}
    >
      <h3
        className={cn(
          'font-semibold leading-6',
          compact ? 'text-[15px]' : 'text-lg',
          isClosed(task.status_category) &&
            'text-muted-foreground line-through',
        )}
      >
        {task.title}
      </h3>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <TaskStatusBadge task={task} />
      </div>
      {taskContextLabel(task) ? (
        <p className="mt-1 text-sm font-medium text-foreground/75">
          {taskContextLabel(task)}
        </p>
      ) : null}
      <p className="mt-1 text-sm text-muted-foreground">
        {task.primary_assignee_name ?? 'Sem responsável'}
        {task.due_time ? ` / ${task.due_time.slice(0, 5)}` : ''}
        {` / ${priorityLabels[task.priority]}`}
      </p>
    </TaskDetailLink>
  );
}

function TaskDetailLink({
  taskId,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href' | 'scroll'> & {
  taskId: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const returnPath = `${pathname}${search ? `?${search}` : ''}`;

  return (
    <Link
      {...props}
      href={taskHrefWithReturn(taskId, returnPath)}
      scroll={false}
    />
  );
}

function TaskStatusBadge({ task }: { task: TaskOverview }) {
  return (
    <Badge
      variant="secondary"
      className={cn('border-0 font-normal', statusTone(task.status_category))}
    >
      {task.status_name}
    </Badge>
  );
}

function EmptyPeriod({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="px-1 py-12">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-[15px] text-muted-foreground">{description}</p>
    </div>
  );
}

function CreateTaskButton({
  creation,
  initialDueDate,
  initialStatusId,
  initialBlocked,
  initialWeekLane,
  label,
  ariaLabel,
}: {
  creation: TaskCreationContext;
  initialDueDate?: string;
  initialStatusId?: string;
  initialBlocked?: boolean;
  initialWeekLane?: AuxiliaryWeekLane;
  label: string;
  ariaLabel?: string;
}) {
  if (creation.role === 'viewer') return null;
  return (
    <NewTaskDialog
      workspaceId={creation.workspaceId}
      taskPrefix={creation.taskPrefix}
      members={creation.members}
      role={creation.role}
      currentUserId={creation.currentUserId}
      initialDueDate={initialDueDate}
      initialStatusId={initialStatusId}
      initialBlocked={initialBlocked}
      initialWeekLane={initialWeekLane}
      initialEventId={creation.initialEventId}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 min-h-10 w-full justify-start rounded-lg px-2.5 text-[13px] text-muted-foreground hover:bg-pta-blue/[0.09] hover:text-pta-blue"
          aria-label={ariaLabel}
        >
          <Plus aria-hidden="true" />
          {label}
        </Button>
      }
    />
  );
}

function PipelineSkeleton({ view }: { view: PipelineView }) {
  const columns =
    view === 'month' ? 7 : view === 'kanban' ? 5 : view === 'week' ? 5 : 1;
  return (
    <div
      className="mt-5 grid gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      aria-busy="true"
      aria-label="Carregando pipeline"
    >
      {Array.from({ length: columns }).map((_, index) => (
        <div key={index} className="rounded-xl border p-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-4 h-24 w-full" />
          <Skeleton className="mt-2 h-20 w-full" />
        </div>
      ))}
    </div>
  );
}

function usePipelineSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: pipelineKeyboardCoordinates,
    }),
  );
}

function useKanbanSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
}

const pipelineKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { context },
) => {
  const direction = {
    [KeyboardCode.Left]: { x: -1, y: 0 },
    [KeyboardCode.Right]: { x: 1, y: 0 },
    [KeyboardCode.Up]: { x: 0, y: -1 },
    [KeyboardCode.Down]: { x: 0, y: 1 },
  }[event.code];
  const collisionRect = context.collisionRect;
  if (!direction || !collisionRect) return undefined;

  event.preventDefault();
  const origin = {
    x: collisionRect.left + collisionRect.width / 2,
    y: collisionRect.top + collisionRect.height / 2,
  };
  const candidates: Array<{
    x: number;
    y: number;
    primaryDistance: number;
    secondaryDistance: number;
  }> = [];

  for (const container of context.droppableContainers.getEnabled()) {
    if (container.id === context.over?.id) continue;
    const rect = context.droppableRects.get(container.id);
    if (!rect) continue;
    const center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    const delta = { x: center.x - origin.x, y: center.y - origin.y };
    const primaryDistance =
      direction.x !== 0 ? delta.x * direction.x : delta.y * direction.y;
    if (primaryDistance <= 0) continue;
    const secondaryDistance =
      direction.x !== 0 ? Math.abs(delta.y) : Math.abs(delta.x);
    candidates.push({
      x: rect.left + (rect.width - collisionRect.width) / 2,
      y: rect.top + (rect.height - collisionRect.height) / 2,
      primaryDistance,
      secondaryDistance,
    });
  }

  const next = candidates.toSorted(
    (left, right) =>
      left.primaryDistance - right.primaryDistance ||
      left.secondaryDistance - right.secondaryDistance,
  )[0];
  return next ? { x: next.x, y: next.y } : undefined;
};

function statusDragAnnouncements(
  tasks: TaskOverview[],
  statuses: TaskStatus[],
) {
  const taskLabel = (id: string | number) => {
    const task = tasks.find((item) => item.id === String(id));
    return task?.title ?? statuses.find((item) => item.id === String(id))?.name;
  };
  const isColumn = (id: string | number) =>
    statuses.some((status) => status.id === String(id));
  const statusByDropId = (id: string | number | undefined) => {
    const value = String(id);
    const overTask = tasks.find((item) => item.id === value);
    return statuses.find((item) => item.id === (overTask?.status_id ?? value));
  };
  const positionByDropId = (id: string | number | undefined) => {
    const overTask = tasks.find((item) => item.id === String(id));
    if (!overTask) return null;
    const ordered = tasks
      .filter((item) => item.status_id === overTask.status_id)
      .toSorted(compareBoardTasks);
    const position = ordered.findIndex((item) => item.id === overTask.id) + 1;
    return position > 0 ? { position, total: ordered.length } : null;
  };
  return {
    onDragStart: ({ active }: { active: { id: string | number } }) =>
      isColumn(active.id)
        ? `Coluna ${taskLabel(active.id)} selecionada.`
        : `${taskLabel(active.id) ?? 'Tarefa'} selecionada.`,
    onDragOver: ({
      active,
      over,
    }: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) => {
      if (isColumn(active.id)) {
        const destination = statuses.findIndex(
          (status) => status.id === String(over?.id),
        );
        return destination >= 0
          ? `Coluna ${taskLabel(active.id)} na posição ${destination + 1} de ${statuses.length}.`
          : `Coluna ${taskLabel(active.id)} fora do quadro.`;
      }
      const destination = statusByDropId(over?.id)?.name;
      const placement = positionByDropId(over?.id);
      return destination
        ? placement
          ? `${taskLabel(active.id) ?? 'Tarefa'} na posição ${placement.position} de ${placement.total}, em ${destination}.`
          : `${taskLabel(active.id) ?? 'Tarefa'} no fim de ${destination}.`
        : `${taskLabel(active.id) ?? 'Tarefa'} fora de uma coluna.`;
    },
    onDragEnd: ({
      active,
      over,
    }: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) => {
      if (isColumn(active.id)) {
        const destination = statuses.findIndex(
          (status) => status.id === String(over?.id),
        );
        return destination >= 0
          ? `Coluna ${taskLabel(active.id)} movida para a posição ${destination + 1}.`
          : `Movimento da coluna ${taskLabel(active.id)} cancelado.`;
      }
      const destination = statusByDropId(over?.id);
      return destination
        ? destination.category === 'blocked'
          ? `${taskLabel(active.id) ?? 'Tarefa'} exige um motivo antes de ir para ${destination.name}.`
          : `${taskLabel(active.id) ?? 'Tarefa'} movida para ${destination.name}.`
        : `Movimento de ${taskLabel(active.id) ?? 'Tarefa'} cancelado.`;
    },
    onDragCancel: ({ active }: { active: { id: string | number } }) =>
      `Movimento de ${isColumn(active.id) ? `coluna ${taskLabel(active.id)}` : (taskLabel(active.id) ?? 'tarefa')} cancelado.`,
  };
}

function dateDragAnnouncements(tasks: TaskOverview[]) {
  const taskLabel = (id: string | number) => {
    const task = tasks.find((item) => item.id === String(id));
    return task?.title ?? 'Tarefa';
  };
  const dateLabel = (id: string | number | undefined) => {
    if (typeof id !== 'string') return undefined;
    try {
      return format(dateFromKey(id), "d 'de' MMMM", { locale: ptBR });
    } catch {
      return undefined;
    }
  };
  return {
    onDragStart: ({ active }: { active: { id: string | number } }) =>
      `${taskLabel(active.id)} selecionada.`,
    onDragOver: ({
      active,
      over,
    }: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) => {
      const destination = dateLabel(over?.id);
      return destination
        ? `${taskLabel(active.id)} sobre ${destination}.`
        : `${taskLabel(active.id)} fora de uma data.`;
    },
    onDragEnd: ({
      active,
      over,
    }: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) => {
      const destination = dateLabel(over?.id);
      return destination
        ? `${taskLabel(active.id)} movida para ${destination}.`
        : `Movimento de ${taskLabel(active.id)} cancelado.`;
    },
    onDragCancel: ({ active }: { active: { id: string | number } }) =>
      `Movimento de ${taskLabel(active.id)} cancelado.`,
  };
}

type WeekDropTarget = {
  lane: TaskWeekLane;
  dateKey: string | null;
};

function weekDayDropId(dateKey: string) {
  return `week-day:${dateKey}`;
}

function weekLaneDropId(lane: AuxiliaryWeekLane) {
  return `week-lane:${lane}`;
}

function weekColumnSortId(lane: AuxiliaryWeekLane) {
  return `week-column:${lane}`;
}

function weekLaneGroup(lanes: WeekLaneDefinition[], laneId: AuxiliaryWeekLane) {
  const planningIds: AuxiliaryWeekLane[] = [
    'emergency',
    'important',
    'backlog',
  ];
  const inPlanningGroup = planningIds.includes(laneId);
  return lanes.filter((lane) =>
    inPlanningGroup
      ? planningIds.includes(lane.id)
      : !planningIds.includes(lane.id),
  );
}

function reorderWeekLaneGroup(
  lanes: WeekLaneDefinition[],
  activeId: AuxiliaryWeekLane,
  overId: AuxiliaryWeekLane,
) {
  const group = weekLaneGroup(lanes, activeId);
  const from = group.findIndex((lane) => lane.id === activeId);
  const to = group.findIndex((lane) => lane.id === overId);
  if (from < 0 || to < 0 || from === to) return lanes;
  const reorderedGroup = arrayMove(group, from, to);
  let cursor = 0;
  const groupIds = new Set(group.map((lane) => lane.id));
  return lanes.map((lane) =>
    groupIds.has(lane.id) ? reorderedGroup[cursor++] : lane,
  );
}

function isLinkedBoardLane(lane: TaskWeekLane) {
  return lane === 'emergency' || lane === 'revision';
}

function linkedLaneForBoardStatus(
  status: TaskStatus,
): 'emergency' | 'revision' | null {
  if (isEmergencyBoardStatus(status)) return 'emergency';
  if (status.category === 'review') return 'revision';
  return null;
}

function isEmergencyBoardStatus(status: TaskStatus) {
  return (
    status.id === EMERGENCY_BOARD_STATUS_ID ||
    status.name.trim().toLocaleLowerCase('pt-BR') === 'emergência'
  );
}

function taskStatusFromBoardColumn(column: TaskBoardStatusColumn): TaskStatus {
  return {
    id: column.id,
    name: column.name,
    category: column.category,
    color: column.color,
    position: column.position,
  };
}

function statusDisplayName(status: TaskStatus) {
  if (status.name === 'Bloqueada') return 'Revisão';
  if (status.name === 'Em revisão') return 'Alterações';
  return status.name;
}

function boardColumnColor(value?: string): BoardColumnColor {
  return [
    'stone',
    'blue',
    'violet',
    'amber',
    'red',
    'green',
    'teal',
    'pink',
  ].includes(value ?? '')
    ? (value as BoardColumnColor)
    : 'stone';
}

function boardColumnIcon(value?: string): BoardColumnIcon {
  const aliases: Record<string, BoardColumnIcon> = {
    'circle-play': 'clock',
    'scan-eye': 'eye',
    'circle-alert': 'alert',
    'circle-check': 'check',
    'circle-x': 'cancel',
    'rotate-ccw': 'rotate',
    'link-2': 'link',
    lightbulb: 'idea',
  };
  const normalized = value ? (aliases[value] ?? value) : 'circle';
  return [
    'circle',
    'inbox',
    'clock',
    'eye',
    'alert',
    'check',
    'cancel',
    'zap',
    'rotate',
    'link',
    'idea',
    'archive',
  ].includes(normalized)
    ? (normalized as BoardColumnIcon)
    : 'circle';
}

function boardColumnWeekLink(
  lane: TaskWeekLane | undefined,
): BoardColumnWeekLink {
  return lane === 'scheduled' ? 'none' : (lane ?? 'none');
}

function boardColumnColorTone(
  color: string | undefined,
  category: TaskStatus['category'] = 'todo',
) {
  const tones: Record<BoardColumnColor, string> = {
    stone: 'bg-stone-500/12 text-stone-600 dark:text-stone-300',
    blue: 'bg-blue-500/12 text-blue-600 dark:text-blue-300',
    violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-300',
    amber: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
    red: 'bg-red-500/12 text-red-600 dark:text-red-300',
    green: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    teal: 'bg-teal-500/12 text-teal-700 dark:text-teal-300',
    pink: 'bg-pink-500/12 text-pink-700 dark:text-pink-300',
  };
  return color ? tones[boardColumnColor(color)] : statusTone(category);
}

function normalizeTaskForLinkedBoard(
  task: TaskOverview,
  reviewStatus: TaskStatus | undefined,
  emergencyStatus: TaskStatus,
): TaskOverview {
  if (task.week_lane === 'emergency') {
    return {
      ...task,
      status_id: emergencyStatus.id,
      status_name: emergencyStatus.name,
      status_category: emergencyStatus.category,
      status_color: emergencyStatus.color,
      board_position: task.week_position,
    };
  }
  if (task.week_lane === 'revision' && reviewStatus) {
    return {
      ...task,
      status_id: reviewStatus.id,
      status_name: 'Alterações',
      status_category: reviewStatus.category,
      status_color: reviewStatus.color,
      board_position: task.week_position,
    };
  }
  return task;
}

function nextWeekLanePosition(
  tasks: TaskOverview[],
  taskId: string,
  lane: TaskWeekLane,
) {
  return (
    tasks
      .filter((task) => task.id !== taskId && task.week_lane === lane)
      .reduce((highest, task) => Math.max(highest, task.week_position), 0) +
    1000
  );
}

function rpcResultVersion(result: unknown, fallback: number) {
  if (
    result &&
    typeof result === 'object' &&
    'version' in result &&
    typeof result.version === 'number'
  ) {
    return result.version;
  }
  return fallback;
}

function parseWeekDropTarget(
  id: string | number | undefined,
): WeekDropTarget | null {
  if (typeof id !== 'string') return null;
  if (id.startsWith('week-day:')) {
    const dateKey = id.slice('week-day:'.length);
    return dateKey ? { lane: 'scheduled', dateKey } : null;
  }
  if (id.startsWith('week-lane:')) {
    const lane = id.slice('week-lane:'.length) as AuxiliaryWeekLane;
    return WEEK_LANE_DEFINITIONS.some((item) => item.id === lane)
      ? { lane, dateKey: null }
      : null;
  }
  return null;
}

function taskBelongsToAuxiliaryLane(
  task: TaskOverview,
  lane: AuxiliaryWeekLane,
  weekStart: string,
) {
  if (task.week_lane === lane) return true;
  return (
    lane === 'backlog' &&
    task.week_lane === 'scheduled' &&
    (!task.due_date || task.due_date < weekStart)
  );
}

function weekDropTargetLabel(target: WeekDropTarget | null) {
  if (!target) return undefined;
  if (target.lane === 'scheduled' && target.dateKey) {
    return format(dateFromKey(target.dateKey), "EEEE, d 'de' MMMM", {
      locale: ptBR,
    });
  }
  return WEEK_LANE_DEFINITIONS.find((item) => item.id === target.lane)?.label;
}

function weekDragAnnouncements(
  tasks: TaskOverview[],
  lanes: WeekLaneDefinition[],
) {
  const laneBySortId = (id: string | number | undefined) =>
    lanes.find((lane) => weekColumnSortId(lane.id) === String(id));
  const taskLabel = (id: string | number) => {
    const task = tasks.find((item) => item.id === String(id));
    return task?.title ?? 'Tarefa';
  };
  return {
    onDragStart: ({ active }: { active: { id: string | number } }) => {
      const lane = laneBySortId(active.id);
      return lane
        ? `Coluna ${lane.label} selecionada.`
        : `${taskLabel(active.id)} selecionada.`;
    },
    onDragOver: ({
      active,
      over,
    }: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) => {
      const activeLane = laneBySortId(active.id);
      if (activeLane) {
        const destination = laneBySortId(over?.id);
        return destination
          ? `Coluna ${activeLane.label} sobre ${destination.label}.`
          : `Coluna ${activeLane.label} fora do grupo.`;
      }
      const destination = weekDropTargetLabel(parseWeekDropTarget(over?.id));
      return destination
        ? `${taskLabel(active.id)} sobre ${destination}.`
        : `${taskLabel(active.id)} fora de uma lista.`;
    },
    onDragEnd: ({
      active,
      over,
    }: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) => {
      const activeLane = laneBySortId(active.id);
      if (activeLane) {
        const destination = laneBySortId(over?.id);
        return destination
          ? `Coluna ${activeLane.label} movida para perto de ${destination.label}.`
          : `Movimento da coluna ${activeLane.label} cancelado.`;
      }
      const destination = weekDropTargetLabel(parseWeekDropTarget(over?.id));
      return destination
        ? `${taskLabel(active.id)} movida para ${destination}.`
        : `Movimento de ${taskLabel(active.id)} cancelado.`;
    },
    onDragCancel: ({ active }: { active: { id: string | number } }) => {
      const lane = laneBySortId(active.id);
      return lane
        ? `Movimento da coluna ${lane.label} cancelado.`
        : `Movimento de ${taskLabel(active.id)} cancelado.`;
    },
  };
}

function useMoveTaskInWeek(
  workspaceId: string,
  tasks: TaskOverview[],
  pending: Set<string>,
  setPending: React.Dispatch<React.SetStateAction<Set<string>>>,
) {
  const queryClient = useQueryClient();
  return async (
    task: TaskOverview,
    target: WeekDropTarget,
    requestedPosition?: number,
  ) => {
    if (pending.has(task.id)) return;
    const cachedTasks =
      queryClient.getQueryData<TaskOverview[]>(taskKeys.all(workspaceId)) ??
      tasks;
    const previousTask = cachedTasks.find((item) => item.id === task.id);
    const isTargetTask = (item: TaskOverview) =>
      target.lane === 'scheduled'
        ? item.week_lane === 'scheduled' && item.due_date === target.dateKey
        : item.week_lane === target.lane;
    const position =
      requestedPosition ??
      cachedTasks
        .filter((item) => item.id !== task.id && isTargetTask(item))
        .reduce((highest, item) => Math.max(highest, item.week_position), 0) +
        1000;
    const optimisticDueDate =
      target.lane === 'scheduled'
        ? target.dateKey
        : target.lane === 'backlog'
          ? null
          : task.due_date;

    setPending((current) => new Set(current).add(task.id));
    queryClient.setQueryData<TaskOverview[]>(
      taskKeys.all(workspaceId),
      (items) =>
        items?.map((item) =>
          item.id === task.id
            ? {
                ...item,
                week_lane: target.lane,
                due_date: optimisticDueDate,
                due_time: target.lane === 'backlog' ? null : item.due_time,
                week_position: position,
              }
            : item,
        ),
    );

    const { error } = await createClient().rpc('move_task_in_week', {
      p_task_id: task.id,
      p_week_lane: target.lane,
      p_due_date: target.dateKey,
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
      toast.error(
        error.message.includes('PTA_VERSION_CONFLICT')
          ? 'Esta tarefa foi atualizada por outra pessoa.'
          : 'Não foi possível mover a tarefa nesta semana.',
      );
    }
    await queryClient.invalidateQueries({
      queryKey: taskKeys.all(workspaceId),
    });
    setPending((current) => {
      const next = new Set(current);
      next.delete(task.id);
      return next;
    });
  };
}

function useMoveTaskToDate(
  workspaceId: string,
  tasks: TaskOverview[],
  pending: Set<string>,
  setPending: React.Dispatch<React.SetStateAction<Set<string>>>,
) {
  const queryClient = useQueryClient();
  return async (task: TaskOverview, dateKey: string) => {
    if (task.due_date === dateKey || pending.has(task.id)) return;
    const cachedTasks =
      queryClient.getQueryData<TaskOverview[]>(taskKeys.all(workspaceId)) ??
      tasks;
    const previousTask = cachedTasks.find((item) => item.id === task.id);
    const position =
      cachedTasks
        .filter((item) => item.due_date === dateKey && item.id !== task.id)
        .reduce((highest, item) => Math.max(highest, item.week_position), 0) +
      1000;
    setPending((current) => new Set(current).add(task.id));
    queryClient.setQueryData<TaskOverview[]>(
      taskKeys.all(workspaceId),
      (items) =>
        items?.map((item) =>
          item.id === task.id
            ? {
                ...item,
                due_date: dateKey,
                week_lane: 'scheduled',
                week_position: position,
              }
            : item,
        ),
    );
    const { error } = await createClient().rpc('move_task_in_week', {
      p_task_id: task.id,
      p_week_lane: 'scheduled',
      p_due_date: dateKey,
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
      toast.error(
        error.message.includes('PTA_VERSION_CONFLICT')
          ? 'Esta tarefa foi atualizada por outra pessoa.'
          : 'Não foi possível alterar a data.',
      );
    }
    await queryClient.invalidateQueries({
      queryKey: taskKeys.all(workspaceId),
    });
    setPending((current) => {
      const next = new Set(current);
      next.delete(task.id);
      return next;
    });
  };
}

function periodLabel(view: PipelineView, referenceDate: string) {
  const date = dateFromKey(referenceDate);
  if (view === 'day') return format(date, "d 'de' MMMM", { locale: ptBR });
  if (view === 'month') return format(date, "MMMM 'de' yyyy", { locale: ptBR });
  const keys = calendarWeekKeysFromDate(referenceDate);
  const start = dateFromKey(keys[0]);
  const end = dateFromKey(keys[4]);
  return `${format(start, 'd MMM', { locale: ptBR })} a ${format(end, 'd MMM', { locale: ptBR })}`;
}

function compareTaskSchedule(left: TaskOverview, right: TaskOverview) {
  const time = (left.due_time ?? '99:99').localeCompare(
    right.due_time ?? '99:99',
  );
  if (time) return time;
  const position = left.week_position - right.week_position;
  return position || left.id.localeCompare(right.id);
}

function taskContextLabel(task: TaskOverview) {
  return (
    [task.type_name, task.product_name, task.event_name]
      .filter(Boolean)
      .join(' / ') || null
  );
}

function priorityTone(priority: TaskOverview['priority']) {
  return {
    low: 'bg-muted text-muted-foreground',
    medium: 'bg-[#fff4d8] text-[#9a6700] dark:bg-[#3a2e16] dark:text-[#ffd982]',
    high: 'bg-[#fff0f0] text-[#b52e2e] dark:bg-[#421f1f] dark:text-[#ffb9b5]',
    urgent:
      'bg-destructive text-destructive-foreground dark:bg-destructive dark:text-white',
  }[priority];
}

function personInitials(name: string | null) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('pt-BR');
}

function capitalizeFirst(value: string) {
  return value ? `${value[0].toLocaleUpperCase('pt-BR')}${value.slice(1)}` : '';
}

function downloadTasksCsv(tasks: TaskOverview[]) {
  const rows = [
    [
      'Tarefa',
      'Status',
      'Responsável',
      'Tipo',
      'Produto',
      'Projeto',
      'Prazo',
      'Horário',
      'Prioridade',
    ],
    ...tasks.map((task) => [
      task.title,
      task.status_name,
      task.primary_assignee_name ?? '',
      task.type_name ?? '',
      task.product_name ?? '',
      task.event_name ?? '',
      task.due_date ?? '',
      task.due_time?.slice(0, 5) ?? '',
      priorityLabels[task.priority],
    ]),
  ];
  const csv = rows.map((row) => row.map(escapeCsvCell).join(';')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `tarefas-${toDateKey(new Date())}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string) {
  return `"${sanitizeSpreadsheetCell(value).replaceAll('"', '""')}"`;
}
