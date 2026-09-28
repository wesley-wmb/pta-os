'use client';

import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isWeekend,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowDownUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Diamond,
  Filter,
  Minus,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TaskStatus } from '@/features/tasks/types';
import { taskHrefWithReturn } from '@/features/tasks/task-return-path';
import { cn } from '@/lib/utils';

import { TimelinePhaseBar } from './timeline-phase-bar';
import type { EventMilestone, PortfolioTask, ProjectPhase } from './types';
import {
  buildTimelineScaleCells,
  buildTimelineScaleRange,
  shiftTimelineValue,
  timelineCanvasWidth,
  timelineCellWidth,
  timelineDayWidth,
  timelineKeyboardDelta,
  timelinePosition,
  timelineSnapDelta,
  TIMELINE_SCALE_LABELS,
  TIMELINE_SCALES,
  type TimelineScale,
} from './timeline-scale';

type TimelineGrouping = 'status' | 'assignee' | 'phase';
type TimelineFilter = 'all' | 'open' | 'done';
type TimelineOrder = 'none' | 'start' | 'date' | 'title' | 'assignee';
type TimelineColor = 'priority' | 'status' | 'none';
type TimelineInteractionMode = 'move' | 'resize-start' | 'resize-end';

type TimelinePortfolioTask = PortfolioTask & {
  startDate?: string | null;
  statusId?: string;
  version?: number;
};

export type TimelineTaskChange = {
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
};

export type TimelineMilestoneChange = {
  milestoneId: string;
  expectedVersion: number;
  dueDate: string | null;
  eventPhaseId: string | null;
};

type TimelineTaskOverride = {
  eventPhaseId?: string | null;
  startDate?: string | null;
  startTime?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  statusId?: string;
  statusName?: string;
  statusCategory?: string;
  version?: number;
};

type TimelineInteraction = {
  taskId: string;
  mode: TimelineInteractionMode;
  pointerId: number;
  originX: number;
  originY: number;
  deltaX: number;
  deltaY: number;
  deltaDays: number;
  deltaMinutes: number;
  statusId?: string;
};

const LEFT_RAIL_WIDTH = 240;
const AXIS_HEIGHT = 52;
const EMPTY_SECTION_HEIGHT = 48;
const TASK_HEIGHT = 38;
const PHASE_ROW_HEIGHT = 44;
const TASK_GAP = 6;
const MIN_ZOOM = 25;
const MAX_ZOOM = 200;
const DEFAULT_ZOOM = 100;
const ZOOM_STEP = 5;
const ZOOM_BUTTON_STEP = 25;
const DRAG_ACTIVATION_DISTANCE = 8;
const COMPACT_TASK_WIDTH = 104;

export type TimelineRange = { start: Date; end: Date; totalDays: number };

type TimelineGroup = {
  key: string;
  label: string;
  color: string | null;
  items: PortfolioTask[];
};

const statusColors: Record<string, string> = {
  stone: '#747a84',
  blue: '#4f7fd8',
  violet: '#8a63d2',
  red: '#d35f63',
  green: '#3f9b73',
  amber: '#d68a3d',
};

const taskColors: Record<
  PortfolioTask['priority'],
  { background: string; border: string; foreground: string }
> = {
  low: {
    background: '#72c7ad',
    border: '#93d8c3',
    foreground: '#102820',
  },
  medium: {
    background: '#a99af2',
    border: '#c0b5fa',
    foreground: '#211a3b',
  },
  high: {
    background: '#f4b653',
    border: '#facb7d',
    foreground: '#2d1d05',
  },
  urgent: {
    background: '#f1827d',
    border: '#f6a19d',
    foreground: '#321615',
  },
};

function timelineColor(value: string) {
  return statusColors[value] ?? (value.startsWith('#') ? value : '#5d7fc0');
}

function dateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, month! - 1, day!, 12);
}

function dateKey(value: Date) {
  return format(value, 'yyyy-MM-dd');
}

function timelineTask(task: PortfolioTask) {
  return task as TimelinePortfolioTask;
}

export function calculateTimelineTaskChange({
  task,
  mode,
  deltaDays,
  deltaMinutes = deltaDays * 24 * 60,
  statusId,
}: {
  task: TimelinePortfolioTask;
  mode: TimelineInteractionMode;
  deltaDays: number;
  deltaMinutes?: number;
  statusId?: string;
}): TimelineTaskChange['patch'] {
  if (!task.dueDate) return statusId ? { status_id: statusId } : {};

  const startKey = task.startDate ?? task.dueDate;
  const start = dateOnly(startKey);
  const due = dateOnly(task.dueDate);
  const patch: TimelineTaskChange['patch'] = {};

  if (mode === 'move') {
    if (deltaDays || deltaMinutes) {
      if (task.startDate) {
        const shiftedStart = shiftTimelineValue({
          date: task.startDate,
          time: task.startTime,
          deltaDays,
          deltaMinutes,
        });
        patch.start_date = shiftedStart.date;
        if (task.startTime) patch.start_time = shiftedStart.time;
      }
      const shiftedDue = shiftTimelineValue({
        date: task.dueDate,
        time: task.dueTime,
        deltaDays,
        deltaMinutes,
      });
      patch.due_date = shiftedDue.date;
      if (task.dueTime) patch.due_time = shiftedDue.time;
    }
  } else if (mode === 'resize-start') {
    const clampedDelta = Math.min(
      deltaDays,
      differenceInCalendarDays(due, start),
    );
    const shifted = shiftTimelineValue({
      date: startKey,
      time: task.startTime,
      deltaDays: clampedDelta,
      deltaMinutes,
    });
    patch.start_date = shifted.date;
    if (task.startTime) patch.start_time = shifted.time;
  } else {
    const clampedDelta = Math.max(
      deltaDays,
      -differenceInCalendarDays(due, start),
    );
    const shifted = shiftTimelineValue({
      date: task.dueDate,
      time: task.dueTime,
      deltaDays: clampedDelta,
      deltaMinutes,
    });
    patch.due_date = shifted.date;
    if (task.dueTime) patch.due_time = shifted.time;
  }

  if (statusId && statusId !== task.statusId) patch.status_id = statusId;
  return patch;
}

export function buildTimelineRange({
  today,
  visibleDays = 70,
}: {
  today: string;
  tasks: PortfolioTask[];
  milestones: EventMilestone[];
  projectStart: string | null;
  projectEnd: string | null;
  visibleDays?: number;
}): TimelineRange {
  const start = addDays(dateOnly(today), -5);
  const end = addDays(start, visibleDays - 1);
  return { start, end, totalDays: visibleDays };
}

export function groupTimelineTasks(
  tasks: PortfolioTask[],
  grouping: TimelineGrouping,
  statuses: TaskStatus[] = [],
  phases: ProjectPhase[] = [],
): TimelineGroup[] {
  if (grouping === 'phase')
    return [
      ...phases.map((phase) => ({
        key: phase.id,
        label: phase.name,
        color: phaseColors[phase.color] ?? phaseColors.blue,
        items: tasks.filter((task) => task.eventPhaseId === phase.id),
      })),
      {
        key: 'unassigned-phase',
        label: 'Sem seção',
        color: null,
        items: tasks.filter(
          (task) =>
            !task.eventPhaseId ||
            !phases.some((phase) => phase.id === task.eventPhaseId),
        ),
      },
    ];
  if (grouping === 'status') {
    const known = [...statuses]
      .sort((left, right) => left.position - right.position)
      .map((status) => ({
        key: status.id,
        label: status.name,
        color: timelineColor(status.color),
        items: tasks.filter((task) => task.statusName === status.name),
      }));
    const knownNames = new Set(known.map((group) => group.label));
    const extra = new Map<string, PortfolioTask[]>();
    for (const task of tasks) {
      if (knownNames.has(task.statusName)) continue;
      extra.set(task.statusName, [...(extra.get(task.statusName) ?? []), task]);
    }
    return [
      ...known,
      ...[...extra.entries()]
        .map(([label, items]) => ({
          key: label,
          label,
          color: null,
          items,
        }))
        .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR')),
    ];
  }

  const grouped = new Map<string, PortfolioTask[]>();
  for (const task of tasks) {
    const label = task.assigneeName || 'Sem responsável';
    grouped.set(label, [...(grouped.get(label) ?? []), task]);
  }
  return [...grouped.entries()]
    .map(([label, items]) => ({ key: label, label, color: null, items }))
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));
}

function filterTasks(tasks: PortfolioTask[], filter: TimelineFilter) {
  if (filter === 'done') {
    return tasks.filter((task) => task.statusCategory === 'done');
  }
  if (filter === 'open') {
    return tasks.filter(
      (task) =>
        task.statusCategory !== 'done' && task.statusCategory !== 'cancelled',
    );
  }
  return tasks;
}

function sortTasks(tasks: PortfolioTask[], order: TimelineOrder) {
  if (order === 'none') return tasks;
  return [...tasks].sort((left, right) => {
    if (order === 'start')
      return (left.startDate ?? left.dueDate ?? '9999').localeCompare(
        right.startDate ?? right.dueDate ?? '9999',
      );
    if (order === 'title')
      return left.title.localeCompare(right.title, 'pt-BR');
    if (order === 'assignee') {
      return (left.assigneeName ?? 'zzzz').localeCompare(
        right.assigneeName ?? 'zzzz',
        'pt-BR',
      );
    }
    return (left.dueDate ?? '9999').localeCompare(right.dueDate ?? '9999');
  });
}

export function ProjectTimeline({
  projectId,
  tasks,
  statuses,
  milestones,
  phases = [],
  today,
  canEdit,
  canManageStructure = false,
  pendingMilestoneId,
  onAddTask,
  onAddPhase,
  onEditPhase,
  onPhaseChange,
  onAddMilestone,
  onToggleMilestone,
  onEditMilestone,
  onMilestoneChange,
  onTaskChange,
}: {
  projectId?: string;
  tasks: PortfolioTask[];
  statuses?: TaskStatus[];
  milestones: EventMilestone[];
  phases?: ProjectPhase[];
  today: string;
  projectStart: string | null;
  projectEnd: string | null;
  canEdit: boolean;
  canManageStructure?: boolean;
  pendingMilestoneId: string | null;
  onAddTask?: () => void;
  onAddPhase?: () => void;
  onEditPhase?: (phase: ProjectPhase) => void;
  onPhaseChange?: (
    phase: ProjectPhase,
    startDate: string,
    endDate: string,
  ) => Promise<void>;
  onAddMilestone: () => void;
  onToggleMilestone: (milestone: EventMilestone) => void;
  onEditMilestone?: (milestone: EventMilestone) => void;
  onMilestoneChange?: (change: TimelineMilestoneChange) => void | Promise<void>;
  onTaskChange?: (change: TimelineTaskChange) => void | Promise<void>;
}) {
  const contextPath = usePathname();
  const [grouping, setGrouping] = useState<TimelineGrouping>('status');
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const [order, setOrder] = useState<TimelineOrder>('none');
  const [scale, setScale] = useState<TimelineScale>('days');
  const [zoomPercentage, setZoomPercentage] = useState(DEFAULT_ZOOM);
  const zoomPercentageRef = useRef(DEFAULT_ZOOM);
  const gridRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [windowOffset, setWindowOffset] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [editingTask, setEditingTask] = useState<PortfolioTask | null>(null);
  const [colorBy, setColorBy] = useState<TimelineColor>('priority');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const optionsTrigger = useRef<HTMLButtonElement>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [taskOverrides, setTaskOverrides] = useState<
    Record<string, TimelineTaskOverride>
  >({});
  const [interaction, setInteraction] = useState<TimelineInteraction | null>(
    null,
  );
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(new Set());
  const [pendingTimelineMilestoneIds, setPendingTimelineMilestoneIds] =
    useState<Set<string>>(new Set());
  const [milestoneOverrides, setMilestoneOverrides] = useState<
    Record<
      string,
      { dueDate: string | null; eventPhaseId: string | null; version: number }
    >
  >({});
  const [liveMessage, setLiveMessage] = useState('');
  const zoomFactor = zoomPercentage / 100;
  const dayWidth = timelineDayWidth(scale) * zoomFactor;
  const range = useMemo(
    () => buildTimelineScaleRange({ today, scale, windowOffset }),
    [scale, today, windowOffset],
  );
  const cells = useMemo(
    () => buildTimelineScaleCells(range, scale),
    [range, scale],
  );
  const days =
    scale === 'hours' || scale === 'days' || scale === 'weeks'
      ? eachDayOfInterval({ start: range.start, end: range.end })
      : [];
  const canvasWidth = timelineCanvasWidth(range, scale) * zoomFactor;
  const todayX = timelinePosition({ date: today, range, scale }) * zoomFactor;
  const effectiveTasks = tasks.map((task) => ({
    ...task,
    ...(taskOverrides[task.id] ?? {}),
  }));
  const filteredTasks = filterTasks(effectiveTasks, filter).filter(
    (task) =>
      (assigneeFilter === 'all' ||
        (task.assigneeId ?? task.assigneeName ?? 'unassigned') ===
          assigneeFilter) &&
      (priorityFilter === 'all' || task.priority === priorityFilter),
  );
  const scheduledTasks = filteredTasks.filter((task) => {
    if (!task.dueDate) return false;
    const start = dateOnly(timelineTask(task).startDate ?? task.dueDate);
    const due = dateOnly(task.dueDate);
    return due >= range.start && start <= range.end;
  });
  const queueTasks = filteredTasks.filter((task) => !task.dueDate);
  const outsideTasks = filteredTasks.filter((task) => {
    if (!task.dueDate) return false;
    const start = dateOnly(timelineTask(task).startDate ?? task.dueDate);
    const due = dateOnly(task.dueDate);
    return due < range.start || start > range.end;
  });
  const effectiveMilestones = milestones.map((milestone) => ({
    ...milestone,
    ...(milestoneOverrides[milestone.id] ?? {}),
  }));
  const visibleMilestones = effectiveMilestones.filter((milestone) => {
    if (!milestone.dueDate) return false;
    const date = dateOnly(milestone.dueDate);
    return date >= range.start && date <= range.end;
  });
  const queuedMilestones = effectiveMilestones.filter((milestone) => {
    if (!milestone.dueDate) return true;
    const date = dateOnly(milestone.dueDate);
    return date < range.start || date > range.end;
  });
  const groups = groupTimelineTasks(
    scheduledTasks,
    grouping,
    statuses,
    phases,
  ).map((group) => ({ ...group, items: sortTasks(group.items, order) }));

  async function commitTaskChange(
    task: PortfolioTask,
    mode: TimelineInteractionMode,
    deltaDays: number,
    deltaMinutes = deltaDays * 24 * 60,
    statusId?: string,
    directPatch?: TimelineTaskChange['patch'],
  ) {
    const source = timelineTask(task);
    const expectedVersion = source.version;
    if (!onTaskChange || expectedVersion === undefined) return;
    const patch =
      directPatch ??
      calculateTimelineTaskChange({
        task: source,
        mode,
        deltaDays,
        deltaMinutes,
        statusId,
      });
    if (!Object.keys(patch).length) return;

    const status = patch.status_id
      ? statuses?.find((item) => item.id === patch.status_id)
      : undefined;
    const previous = taskOverrides[task.id];
    setTaskOverrides((current) => ({
      ...current,
      [task.id]: {
        ...current[task.id],
        ...(patch.event_phase_id !== undefined
          ? { eventPhaseId: patch.event_phase_id }
          : {}),
        ...(patch.start_date !== undefined
          ? { startDate: patch.start_date }
          : {}),
        ...(patch.start_time !== undefined
          ? { startTime: patch.start_time }
          : {}),
        ...(patch.due_date !== undefined ? { dueDate: patch.due_date } : {}),
        ...(patch.due_time !== undefined ? { dueTime: patch.due_time } : {}),
        ...(status
          ? {
              statusId: status.id,
              statusName: status.name,
              statusCategory: status.category,
            }
          : {}),
        version: expectedVersion + 1,
      },
    }));
    setPendingTaskIds((current) => new Set(current).add(task.id));
    setLiveMessage(`Atualizando ${task.title}.`);

    try {
      await onTaskChange({
        taskId: task.id,
        expectedVersion,
        patch,
      });
      setLiveMessage(`${task.title} atualizada.`);
      return true;
    } catch {
      setTaskOverrides((current) => {
        const next = { ...current };
        if (previous) next[task.id] = previous;
        else delete next[task.id];
        return next;
      });
      setLiveMessage(`Não foi possível atualizar ${task.title}.`);
      return false;
    } finally {
      setPendingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }

  async function commitMilestoneChange(
    milestone: EventMilestone,
    dueDate: string | null,
    eventPhaseId: string | null,
  ) {
    if (!onMilestoneChange || pendingTimelineMilestoneIds.has(milestone.id))
      return;
    if (
      milestone.dueDate === dueDate &&
      (milestone.eventPhaseId ?? null) === eventPhaseId
    )
      return;

    const previous = milestoneOverrides[milestone.id];
    setMilestoneOverrides((current) => ({
      ...current,
      [milestone.id]: {
        dueDate,
        eventPhaseId,
        version: milestone.version + 1,
      },
    }));
    setPendingTimelineMilestoneIds((current) =>
      new Set(current).add(milestone.id),
    );
    setLiveMessage(`Atualizando o marco ${milestone.title}.`);
    try {
      await onMilestoneChange({
        milestoneId: milestone.id,
        expectedVersion: milestone.version,
        dueDate,
        eventPhaseId,
      });
      setLiveMessage(`Marco ${milestone.title} atualizado.`);
    } catch {
      setMilestoneOverrides((current) => {
        const next = { ...current };
        if (previous) next[milestone.id] = previous;
        else delete next[milestone.id];
        return next;
      });
      setLiveMessage(`Não foi possível atualizar o marco ${milestone.title}.`);
    } finally {
      setPendingTimelineMilestoneIds((current) => {
        const next = new Set(current);
        next.delete(milestone.id);
        return next;
      });
    }
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function updateZoom(nextValue: number, anchorClientX?: number) {
    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.round(nextValue / ZOOM_STEP) * ZOOM_STEP),
    );
    const currentZoom = zoomPercentageRef.current;
    if (nextZoom === currentZoom) return;

    const grid = gridRef.current;
    if (grid) {
      const rect = grid.getBoundingClientRect();
      const railWidth =
        railRef.current?.getBoundingClientRect().width || LEFT_RAIL_WIDTH;
      const viewportAnchor = Math.max(
        railWidth,
        Math.min(
          rect.width,
          anchorClientX === undefined
            ? rect.width / 2
            : anchorClientX - rect.left,
        ),
      );
      const timelineAnchor = grid.scrollLeft + viewportAnchor - railWidth;
      const nextScrollLeft =
        (timelineAnchor * nextZoom) / currentZoom - viewportAnchor + railWidth;
      requestAnimationFrame(() => {
        grid.scrollLeft = Math.max(0, nextScrollLeft);
      });
    }

    zoomPercentageRef.current = nextZoom;
    setZoomPercentage(nextZoom);
  }

  function handleGridZoomShortcut(event: KeyboardEvent<HTMLDivElement>) {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key === '+' || event.key === '=' || event.key === 'Add') {
      event.preventDefault();
      updateZoom(zoomPercentageRef.current + ZOOM_STEP);
    } else if (event.key === '-' || event.key === 'Subtract') {
      event.preventDefault();
      updateZoom(zoomPercentageRef.current - ZOOM_STEP);
    } else if (event.key === '0') {
      event.preventDefault();
      updateZoom(DEFAULT_ZOOM);
    }
  }

  function handleGridWheel(event: WheelEvent<HTMLDivElement>) {
    if (!(event.ctrlKey || event.metaKey) || event.deltaY === 0) return;
    event.preventDefault();
    updateZoom(
      zoomPercentageRef.current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP),
      event.clientX,
    );
  }

  return (
    <section
      aria-labelledby="project-timeline-heading"
      className="-mx-4 relative flex h-[calc(100dvh-210px)] min-h-[360px] flex-col [--timeline-rail-width:152px] sm:-mx-6 sm:[--timeline-rail-width:240px]"
    >
      <h2 id="project-timeline-heading" className="sr-only">
        Cronograma da equipe
      </h2>
      <p className="sr-only" aria-live="polite">
        {liveMessage}
      </p>

      <div className="flex min-h-[52px] shrink-0 items-center gap-2 overflow-x-auto overscroll-x-contain border-b px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-5">
        {onAddTask ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={onAddTask}
          >
            <Plus aria-hidden="true" />
            Adicionar uma tarefa
          </Button>
        ) : null}
        {canManageStructure ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Mais ações do cronograma"
              >
                <ChevronDown aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {onAddPhase ? (
                <DropdownMenuItem onSelect={onAddPhase}>
                  <Plus aria-hidden="true" /> Nova fase
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={onAddMilestone}>
                <Diamond aria-hidden="true" /> Novo marco
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Período anterior"
          onClick={() => setWindowOffset((value) => value - 1)}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => {
            setWindowOffset(0);
            const currentRange = buildTimelineScaleRange({
              today,
              scale,
              windowOffset: 0,
            });
            requestAnimationFrame(() => {
              const grid = gridRef.current;
              if (!grid) return;
              const railWidth =
                railRef.current?.getBoundingClientRect().width ||
                LEFT_RAIL_WIDTH;
              const position =
                timelinePosition({ date: today, range: currentRange, scale }) *
                zoomFactor;
              grid.scrollLeft = Math.max(
                0,
                position - (grid.clientWidth - railWidth) / 2 + dayWidth / 2,
              );
            });
          }}
        >
          Hoje
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Próximo período"
          onClick={() => setWindowOffset((value) => value + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>

        <div className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap">
          <button
            type="button"
            aria-expanded={showQueue}
            onClick={() => {
              setShowQueue((value) => !value);
              setShowOptions(false);
            }}
            className={cn(
              'inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              showQueue && 'bg-muted text-foreground',
            )}
          >
            Sem data ({queueTasks.length})
          </button>
          <span className="hidden h-5 w-px bg-border lg:block" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 min-w-20 items-center justify-between gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Escala do cronograma: ${TIMELINE_SCALE_LABELS[scale]}`}
              >
                {TIMELINE_SCALE_LABELS[scale]}
                <ChevronDown aria-hidden="true" className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuRadioGroup
                value={scale}
                onValueChange={(value) => {
                  setScale(value as TimelineScale);
                  setWindowOffset(0);
                }}
              >
                {TIMELINE_SCALES.map((option) => (
                  <DropdownMenuRadioItem key={option} value={option}>
                    {TIMELINE_SCALE_LABELS[option]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Diminuir zoom, atual ${zoomPercentage}%`}
            disabled={zoomPercentage === MIN_ZOOM}
            onClick={() => updateZoom(zoomPercentage - ZOOM_BUTTON_STEP)}
          >
            <Minus aria-hidden="true" />
          </Button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={ZOOM_STEP}
            value={zoomPercentage}
            onChange={(event) => updateZoom(Number(event.target.value))}
            aria-label={`Zoom do cronograma: ${zoomPercentage}%`}
            aria-valuetext={`${zoomPercentage}%`}
            title={`Zoom: ${zoomPercentage}% (Ctrl + roda do mouse)`}
            className="h-8 w-20 cursor-pointer appearance-none bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-24 [&::-moz-range-progress]:h-1 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-primary [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-sm [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-muted [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm"
          />
          <button
            type="button"
            className="h-8 min-w-12 rounded-md px-1.5 text-center text-[11px] font-semibold tabular-nums text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => updateZoom(DEFAULT_ZOOM)}
            aria-label={`Zoom do cronograma em ${zoomPercentage}%. Restaurar para 100%`}
            title="Restaurar zoom para 100% (Ctrl+0)"
          >
            {zoomPercentage}%
          </button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Aumentar zoom, atual ${zoomPercentage}%`}
            disabled={zoomPercentage === MAX_ZOOM}
            onClick={() => updateZoom(zoomPercentage + ZOOM_BUTTON_STEP)}
          >
            <Plus aria-hidden="true" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  (filter !== 'all' ||
                    assigneeFilter !== 'all' ||
                    priorityFilter !== 'all') &&
                    'text-primary bg-primary/10',
                )}
              >
                <Filter aria-hidden="true" />
                Filtrar
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Filtros</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilter('all');
                    setAssigneeFilter('all');
                    setPriorityFilter('all');
                  }}
                >
                  Limpar
                </Button>
              </div>
              <TimelineField
                label="Conclusão"
                value={filter}
                onChange={(v) => setFilter(v as TimelineFilter)}
                options={[
                  ['all', 'Todas as tarefas'],
                  ['open', 'Tarefas não concluídas'],
                  ['done', 'Tarefas concluídas'],
                ]}
              />
              <TimelineField
                label="Responsável"
                value={assigneeFilter}
                onChange={setAssigneeFilter}
                options={[
                  ['all', 'Todos'],
                  ['unassigned', 'Sem responsável'],
                  ...Array.from(
                    new Map(
                      tasks
                        .filter((t) => t.assigneeName)
                        .map((t) => [
                          t.assigneeId ?? t.assigneeName!,
                          t.assigneeName!,
                        ]),
                    ).entries(),
                  ),
                ]}
              />
              <TimelineField
                label="Prioridade"
                value={priorityFilter}
                onChange={setPriorityFilter}
                options={[
                  ['all', 'Todas'],
                  ['low', 'Baixa'],
                  ['medium', 'Média'],
                  ['high', 'Alta'],
                  ['urgent', 'Urgente'],
                ]}
              />
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(order !== 'none' && 'text-primary bg-primary/10')}
              >
                <ArrowDownUp aria-hidden="true" />
                Ordenar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={order}
                onValueChange={(v) => setOrder(v as TimelineOrder)}
              >
                {(
                  [
                    ['none', 'Nenhum'],
                    ['start', 'Data de início'],
                    ['date', 'Data de conclusão'],
                    ['assignee', 'Responsável'],
                    ['title', 'Título'],
                  ] as const
                ).map(([value, label]) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            ref={optionsTrigger}
            variant="ghost"
            size="sm"
            aria-expanded={showOptions}
            aria-controls="timeline-options"
            onClick={() => {
              setShowOptions((v) => !v);
              setShowQueue(false);
            }}
          >
            <SlidersHorizontal aria-hidden="true" />
            Opções
          </Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          ref={gridRef}
          className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain bg-[color-mix(in_oklab,var(--background)_92%,var(--muted)_8%)]"
          role="region"
          aria-label="Grade do cronograma"
          tabIndex={0}
          onKeyDown={handleGridZoomShortcut}
          onWheel={handleGridWheel}
        >
          <div
            className="relative grid min-h-full min-w-max content-start"
            style={{
              gridTemplateColumns: `var(--timeline-rail-width) ${canvasWidth}px`,
            }}
          >
            <div
              ref={railRef}
              className="sticky left-0 top-0 z-40 border-b border-r border-border/60 bg-[color-mix(in_oklab,var(--background)_94%,var(--muted)_6%)]"
              style={{ height: AXIS_HEIGHT }}
            />
            <TimelineAxis
              range={range}
              cells={cells}
              scale={scale}
              today={today}
              zoomFactor={zoomFactor}
              dayWidth={dayWidth}
              canvasWidth={canvasWidth}
              todayX={todayX}
              milestones={visibleMilestones}
            />

            {phases.length || visibleMilestones.length ? (
              <TimelinePhases
                phases={phases}
                milestones={visibleMilestones}
                range={range}
                dayWidth={dayWidth}
                canvasWidth={canvasWidth}
                days={days}
                todayX={todayX}
                canManage={canManageStructure}
                onAddPhase={onAddPhase}
                onEditPhase={onEditPhase}
                onPhaseChange={onPhaseChange}
                onEditMilestone={onEditMilestone}
                onMilestoneChange={
                  onMilestoneChange
                    ? (milestone, dueDate, phaseId) =>
                        void commitMilestoneChange(milestone, dueDate, phaseId)
                    : undefined
                }
                pendingMilestoneIds={pendingTimelineMilestoneIds}
              />
            ) : null}

            {groups.map((group) => {
              const collapsed = collapsedGroups.has(group.key);
              const height = collapsed
                ? EMPTY_SECTION_HEIGHT
                : Math.max(
                    EMPTY_SECTION_HEIGHT,
                    group.items.length * (TASK_HEIGHT + TASK_GAP) + 14,
                  );
              return (
                <TimelineSection
                  key={group.key}
                  group={group}
                  colorBy={colorBy}
                  onEditTask={setEditingTask}
                  collapsed={collapsed}
                  height={height}
                  range={range}
                  days={days}
                  dayWidth={dayWidth}
                  scale={scale}
                  canvasWidth={canvasWidth}
                  todayX={todayX}
                  today={today}
                  milestones={visibleMilestones}
                  projectId={projectId}
                  onToggle={() => toggleGroup(group.key)}
                  canEdit={canEdit && Boolean(onTaskChange)}
                  grouping={grouping}
                  statuses={statuses ?? []}
                  interaction={interaction}
                  pendingTaskIds={pendingTaskIds}
                  onInteractionChange={setInteraction}
                  onCommitTaskChange={(
                    task,
                    mode,
                    deltaDays,
                    deltaMinutes,
                    statusId,
                  ) =>
                    void commitTaskChange(
                      task,
                      mode,
                      deltaDays,
                      deltaMinutes,
                      statusId,
                    )
                  }
                />
              );
            })}

            <div className="sticky left-0 z-20 min-h-[340px] border-r border-border/60 bg-[color-mix(in_oklab,var(--background)_94%,var(--muted)_6%)]">
              {canManageStructure && onAddPhase ? (
                <Button
                  variant="ghost"
                  className="m-2 text-muted-foreground"
                  onClick={() => {
                    setGrouping('phase');
                    onAddPhase();
                  }}
                >
                  <Plus aria-hidden="true" />
                  Adicionar uma seção
                </Button>
              ) : null}
            </div>
            <TimelineGridSurface
              days={days}
              dayWidth={dayWidth}
              canvasWidth={canvasWidth}
              todayX={todayX}
              className="min-h-[340px]"
            />
          </div>
        </div>
        {showQueue ? (
          <aside
            aria-label="Tarefas sem data"
            className="absolute inset-y-0 right-0 z-40 w-80 max-w-full overflow-y-auto border-l bg-background shadow-lg sm:static sm:shrink-0 sm:shadow-none"
          >
            <div className="flex h-[52px] items-center justify-between border-b px-4">
              <h3 className="text-sm font-semibold">
                Sem data ({queueTasks.length})
              </h3>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Fechar tarefas sem data"
                onClick={() => setShowQueue(false)}
              >
                <X />
              </Button>
            </div>
            <p className="px-4 py-3 text-xs text-muted-foreground">
              Defina um prazo para posicionar a tarefa no cronograma.
            </p>
            {queueTasks.map((task) => (
              <div key={task.id} className="border-b px-4 py-3">
                <Link
                  className="block truncate text-sm font-medium hover:underline"
                  href={
                    projectId
                      ? taskHrefWithReturn(
                          task.id,
                          `${contextPath ?? `/projetos/${projectId}`}?visao=timeline`,
                        )
                      : `/tarefa/${task.id}`
                  }
                >
                  {task.title}
                </Link>
                <p className="my-1 text-xs text-muted-foreground">
                  {task.assigneeName ?? 'Sem responsável'}
                </p>
                {canEdit &&
                task.canEdit !== false &&
                task.version !== undefined &&
                onTaskChange ? (
                  <label className="mt-2 flex items-center justify-between gap-2 text-xs">
                    Agendar
                    <input
                      type="date"
                      aria-label={`Agendar ${task.title}`}
                      disabled={pendingTaskIds.has(task.id)}
                      className="min-w-0 rounded border bg-background p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onChange={(event) => {
                        if (event.target.value)
                          void commitTaskChange(task, 'move', 0, 0, undefined, {
                            due_date: event.target.value,
                          });
                      }}
                    />
                  </label>
                ) : null}
              </div>
            ))}
            {!queueTasks.length ? (
              <p className="p-4 text-sm text-muted-foreground">
                Todas as tarefas têm uma data definida.
              </p>
            ) : null}
            <TimelineQueue
              projectId={projectId}
              tasks={[]}
              outsideTasks={outsideTasks}
              milestones={queuedMilestones}
              canEdit={canEdit}
              pendingMilestoneId={pendingMilestoneId}
              onAddMilestone={onAddMilestone}
              onToggleMilestone={onToggleMilestone}
              onEditMilestone={onEditMilestone}
            />
          </aside>
        ) : null}
        {showOptions ? (
          <aside
            id="timeline-options"
            aria-label="Opções do cronograma"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setShowOptions(false);
                optionsTrigger.current?.focus();
              }
            }}
            className="absolute inset-y-0 right-0 z-40 w-80 max-w-full overflow-y-auto border-l bg-background shadow-lg sm:static sm:shrink-0 sm:shadow-none"
          >
            <div className="flex h-[52px] items-center justify-between border-b px-4">
              <h3 className="text-sm font-semibold">Cronograma</h3>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Fechar opções"
                onClick={() => {
                  setShowOptions(false);
                  optionsTrigger.current?.focus();
                }}
              >
                <X />
              </Button>
            </div>
            <div className="space-y-5 p-4">
              <h4 className="text-sm font-semibold">Opções de layout</h4>
              <TimelineField
                label="Definir cor para tarefas"
                value={colorBy}
                onChange={(v) => setColorBy(v as TimelineColor)}
                options={[
                  ['priority', 'Prioridade'],
                  ['status', 'Status'],
                  ['none', 'Sem cor'],
                ]}
              />
              <TimelineField
                label="Agrupar por"
                value={grouping}
                onChange={(v) => setGrouping(v as TimelineGrouping)}
                options={[
                  ['phase', 'Seções da equipe'],
                  ['status', 'Seções por status'],
                  ['assignee', 'Responsável'],
                ]}
              />
              <TimelineField
                label="Zoom"
                value={scale}
                onChange={(v) => {
                  setScale(v as TimelineScale);
                  setWindowOffset(0);
                }}
                options={TIMELINE_SCALES.map((v) => [
                  v,
                  TIMELINE_SCALE_LABELS[v],
                ])}
              />
              <div className="flex flex-col items-start gap-1 border-t pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setCollapsedGroups(new Set(groups.map((g) => g.key)))
                  }
                >
                  Recolher todas as seções
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCollapsedGroups(new Set())}
                >
                  Expandir todas as seções
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setGrouping('status');
                    setColorBy('priority');
                    setFilter('all');
                    setAssigneeFilter('all');
                    setPriorityFilter('all');
                    setOrder('none');
                    setScale('days');
                    setWindowOffset(0);
                    updateZoom(100);
                    setCollapsedGroups(new Set());
                  }}
                >
                  Restaurar visualização
                </Button>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
      <Dialog
        open={Boolean(editingTask)}
        onOpenChange={(open) => {
          if (!open) setEditingTask(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Planejar tarefa</DialogTitle>
            <DialogDescription>{editingTask?.title}</DialogDescription>
          </DialogHeader>
          {editingTask ? (
            <form
              key={`${editingTask.id}-${editingTask.version}`}
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const start = String(data.get('start') || '');
                const due = String(data.get('due') || '');
                if (start && (!due || start > due)) {
                  setLiveMessage(
                    'O início deve ser anterior ou igual ao prazo.',
                  );
                  return;
                }
                const success = await commitTaskChange(
                  editingTask,
                  'move',
                  0,
                  0,
                  undefined,
                  {
                    event_phase_id: String(data.get('phase') || '') || null,
                    start_date: start || null,
                    due_date: due || null,
                    status_id:
                      String(
                        data.get('status') || editingTask.statusId || '',
                      ) || undefined,
                  },
                );
                if (success) setEditingTask(null);
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm">
                  Data de início
                  <input
                    name="start"
                    type="date"
                    defaultValue={editingTask.startDate ?? ''}
                    className="block w-full rounded border bg-background p-2 focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  Data de conclusão
                  <input
                    name="due"
                    type="date"
                    defaultValue={editingTask.dueDate ?? ''}
                    className="block w-full rounded border bg-background p-2 focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
              </div>
              <label className="block space-y-1 text-sm">
                Status
                <select
                  name="status"
                  defaultValue={editingTask.statusId}
                  className="block h-10 w-full rounded border bg-background px-2 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {statuses?.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm">
                Seção
                <select
                  name="phase"
                  defaultValue={editingTask.eventPhaseId ?? ''}
                  className="block h-10 w-full rounded border bg-background px-2 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Sem seção</option>
                  {phases.map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.name}
                    </option>
                  ))}
                </select>
              </label>
              <p role="status" className="text-xs text-muted-foreground">
                {liveMessage}
              </p>
              <div className="flex justify-between gap-2">
                <Button variant="ghost" asChild>
                  <Link
                    href={
                      projectId
                        ? taskHrefWithReturn(
                            editingTask.id,
                            `${contextPath ?? `/projetos/${projectId}`}?visao=timeline`,
                          )
                        : `/tarefa/${editingTask.id}`
                    }
                  >
                    Abrir tarefa
                  </Link>
                </Button>
                <Button
                  type="submit"
                  disabled={pendingTaskIds.has(editingTask.id)}
                >
                  Salvar planejamento
                </Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function TimelineField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="flex flex-col gap-2 text-xs text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TimelineAxis({
  range,
  cells,
  scale,
  today,
  zoomFactor,
  dayWidth,
  canvasWidth,
  todayX,
  milestones,
}: {
  range: TimelineRange;
  cells: ReturnType<typeof buildTimelineScaleCells>;
  scale: TimelineScale;
  today: string;
  zoomFactor: number;
  dayWidth: number;
  canvasWidth: number;
  todayX: number;
  milestones: EventMilestone[];
}) {
  const currentDate = dateOnly(today);
  const isCurrentCell = (cell: (typeof cells)[number]) =>
    scale === 'hours'
      ? format(cell.start, 'yyyy-MM-dd') === today
      : currentDate >= cell.start && currentDate < cell.end;
  const majorBands = cells.reduce<
    Array<{ label: string; start: Date; end: Date; current: boolean }>
  >((bands, cell) => {
    const last = bands.at(-1);
    if (last?.label === cell.majorLabel) {
      last.end = cell.end;
      last.current ||= isCurrentCell(cell);
    } else
      bands.push({
        label: cell.majorLabel,
        start: cell.start,
        end: cell.end,
        current: isCurrentCell(cell),
      });
    return bands;
  }, []);
  return (
    <div
      className="sticky top-0 z-30 border-b border-border/60 bg-[color-mix(in_oklab,var(--background)_94%,var(--muted)_6%)]"
      style={{ height: AXIS_HEIGHT, width: canvasWidth }}
    >
      <div className="absolute inset-x-0 top-0 h-6 border-b border-border/55 bg-muted/[0.12]">
        {majorBands.map((band) => {
          const left = Math.max(
            0,
            timelinePosition({ date: band.start, range, scale }) * zoomFactor,
          );
          const right = Math.min(
            canvasWidth,
            timelinePosition({ date: band.end, range, scale }) * zoomFactor,
          );
          return (
            <div
              key={`${band.label}-${band.start.toISOString()}`}
              className={cn(
                'absolute inset-y-0 overflow-hidden border-r border-border/55 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] leading-6 text-muted-foreground',
                band.current && 'bg-primary/[0.05] text-primary',
              )}
              style={{ left, width: Math.max(0, right - left) }}
              title={band.label}
            >
              <span className="block truncate">{band.label}</span>
            </div>
          );
        })}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex h-7">
        {cells.map((cell) => {
          const current = isCurrentCell(cell);
          return (
            <div
              key={cell.key}
              className={cn(
                'flex shrink-0 flex-col items-center justify-center overflow-hidden border-r border-border/40 px-0.5 text-center tabular-nums text-muted-foreground',
                (scale === 'days' || scale === 'hours') &&
                  isWeekend(cell.start) &&
                  'bg-muted/[0.10]',
                current &&
                  'bg-primary/[0.05] text-primary shadow-[inset_0_-2px_0_var(--primary)]',
              )}
              style={{
                width:
                  timelineCellWidth(cell.start, cell.end, scale) * zoomFactor,
              }}
              title={cell.ariaLabel}
              aria-label={cell.ariaLabel}
            >
              <span
                className={cn(
                  'block max-w-full whitespace-nowrap text-xs font-semibold leading-4 capitalize',
                  scale === 'hours' && 'text-[10px]',
                )}
              >
                {cell.label}
              </span>
              {cell.secondaryLabel && scale !== 'days' ? (
                <span className="block max-w-full whitespace-nowrap text-[9px] font-medium leading-3 capitalize text-current opacity-75">
                  {cell.secondaryLabel}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {todayX >= 0 && todayX <= canvasWidth ? (
        <>
          <span
            className="absolute bottom-0 z-10 h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-sm"
            style={{ left: todayX + dayWidth / 2 }}
            aria-label="Hoje"
          />
          <span
            className="absolute bottom-0 z-[9] h-10 w-px bg-primary/75"
            style={{ left: todayX + dayWidth / 2 }}
            aria-hidden="true"
          />
        </>
      ) : null}
      {milestones.map((milestone) => {
        const left =
          timelinePosition({ date: milestone.dueDate!, range, scale }) *
            zoomFactor +
          dayWidth / 2;
        return (
          <span
            key={milestone.id}
            className="absolute bottom-1 z-20 -translate-x-1/2 text-fuchsia-500"
            style={{ left }}
            title={milestone.title}
          >
            <Diamond aria-hidden="true" className="size-3 fill-current" />
          </span>
        );
      })}
    </div>
  );
}

const phaseColors: Record<string, string> = {
  slate: '#64748b',
  blue: '#4f7fd8',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  pink: '#db6b9a',
  red: '#dc6268',
  orange: '#e58a43',
  amber: '#d49a36',
  emerald: '#35a071',
  teal: '#27988f',
};

function TimelinePhases({
  phases,
  milestones,
  range,
  dayWidth,
  canvasWidth,
  days,
  todayX,
  canManage,
  onAddPhase,
  onEditPhase,
  onPhaseChange,
  onEditMilestone,
  onMilestoneChange,
  pendingMilestoneIds,
}: {
  phases: ProjectPhase[];
  milestones: EventMilestone[];
  range: TimelineRange;
  dayWidth: number;
  canvasWidth: number;
  days: Date[];
  todayX: number;
  canManage: boolean;
  onAddPhase?: () => void;
  onEditPhase?: (phase: ProjectPhase) => void;
  onPhaseChange?: (
    phase: ProjectPhase,
    startDate: string,
    endDate: string,
  ) => Promise<void>;
  onEditMilestone?: (milestone: EventMilestone) => void;
  onMilestoneChange?: (
    milestone: EventMilestone,
    dueDate: string | null,
    eventPhaseId: string | null,
  ) => void;
  pendingMilestoneIds: Set<string>;
}) {
  const hasUnassigned = milestones.some((milestone) => !milestone.eventPhaseId);
  const rows = Math.max(phases.length + (hasUnassigned ? 1 : 0), 1);
  const height = Math.max(56, rows * PHASE_ROW_HEIGHT + 10);
  return (
    <>
      <div
        className="sticky left-0 z-20 border-b border-r border-border/60 bg-[color-mix(in_oklab,var(--background)_94%,var(--muted)_6%)] px-4 py-3"
        style={{ height }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Fases da equipe
        </p>
        {phases.length ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {phases.length} {phases.length === 1 ? 'fase' : 'fases'}
          </p>
        ) : canManage && onAddPhase ? (
          <button
            type="button"
            onClick={onAddPhase}
            className="mt-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            + Criar a primeira fase
          </button>
        ) : null}
      </div>
      <div
        className="relative border-b border-border/60"
        style={{ height, width: canvasWidth }}
      >
        <TimelineGridSurface
          days={days}
          dayWidth={dayWidth}
          canvasWidth={canvasWidth}
          todayX={todayX}
          className="absolute inset-0"
        />
        {phases.map((phase, index) => (
          <div
            key={`drop-${phase.id}`}
            data-timeline-phase-id={phase.id}
            className="absolute inset-x-0 z-[3]"
            style={{ top: index * PHASE_ROW_HEIGHT, height: PHASE_ROW_HEIGHT }}
            aria-hidden="true"
          />
        ))}
        {hasUnassigned ? (
          <div
            data-timeline-phase-id="none"
            className="absolute inset-x-0 z-[3]"
            style={{
              top: phases.length * PHASE_ROW_HEIGHT,
              height: PHASE_ROW_HEIGHT,
            }}
            aria-hidden="true"
          />
        ) : null}
        {phases.map((phase, index) => {
          const phaseMilestones = milestones.filter(
            (milestone) => milestone.eventPhaseId === phase.id,
          );
          const milestoneDates = phaseMilestones
            .map((milestone) => milestone.dueDate)
            .filter((date): date is string => Boolean(date));
          const startKey = phase.startDate ?? milestoneDates.sort()[0] ?? null;
          const endKey =
            phase.endDate ?? milestoneDates.sort().at(-1) ?? startKey;
          const color = phaseColors[phase.color] ?? phaseColors.blue;
          if (!startKey || !endKey) {
            return (
              <button
                key={phase.id}
                type="button"
                onClick={() => onEditPhase?.(phase)}
                disabled={!canManage || !onEditPhase}
                className="absolute z-[6] flex h-8 max-w-56 items-center gap-2 rounded-lg border border-dashed bg-background/90 px-3 text-left text-xs font-semibold shadow-sm transition-[background-color,border-color,box-shadow,transform] hover:-translate-y-px hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none motion-reduce:transform-none motion-reduce:transition-none"
                style={{
                  top: 6 + index * PHASE_ROW_HEIGHT,
                  left: 12,
                  width: Math.min(224, Math.max(120, canvasWidth - 24)),
                  borderColor: `${color}99`,
                  color,
                }}
                aria-label={`Editar fase ${phase.name}. Período ainda não definido.`}
                title="Definir período da fase"
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span className="truncate">{phase.name}</span>
                <span className="ml-auto shrink-0 text-[10px] font-medium text-muted-foreground">
                  Sem datas
                </span>
              </button>
            );
          }
          return (
            <TimelinePhaseBar
              key={phase.id}
              phase={phase}
              startDate={startKey}
              endDate={endKey}
              rangeStart={range.start}
              dayWidth={dayWidth}
              canvasWidth={canvasWidth}
              top={6 + index * PHASE_ROW_HEIGHT}
              color={color}
              canManage={canManage}
              onEdit={onEditPhase}
              onChange={onPhaseChange}
            />
          );
        })}
        {milestones.map((milestone) => {
          if (!milestone.dueDate) return null;
          const phaseIndex = milestone.eventPhaseId
            ? phases.findIndex((phase) => phase.id === milestone.eventPhaseId)
            : phases.length;
          if (phaseIndex < 0) return null;
          const left =
            differenceInCalendarDays(dateOnly(milestone.dueDate), range.start) *
              dayWidth +
            dayWidth / 2;
          return (
            <TimelineMilestoneMarker
              key={milestone.id}
              milestone={milestone}
              phases={phases}
              left={left}
              top={8 + phaseIndex * PHASE_ROW_HEIGHT}
              dayWidth={dayWidth}
              canEdit={canManage && Boolean(onMilestoneChange)}
              pending={pendingMilestoneIds.has(milestone.id)}
              onEdit={onEditMilestone}
              onChange={onMilestoneChange}
            />
          );
        })}
      </div>
    </>
  );
}

function TimelineMilestoneMarker({
  milestone,
  phases,
  left,
  top,
  dayWidth,
  canEdit,
  pending,
  onEdit,
  onChange,
}: {
  milestone: EventMilestone;
  phases: ProjectPhase[];
  left: number;
  top: number;
  dayWidth: number;
  canEdit: boolean;
  pending: boolean;
  onEdit?: (milestone: EventMilestone) => void;
  onChange?: (
    milestone: EventMilestone,
    dueDate: string | null,
    eventPhaseId: string | null,
  ) => void;
}) {
  const [drag, setDrag] = useState<{
    pointerId: number;
    originX: number;
    originY: number;
    deltaX: number;
    deltaY: number;
    phaseId: string | null;
  } | null>(null);
  const draggedRef = useRef(false);

  function phaseAtPointer(clientX: number, clientY: number) {
    const elements = document.elementsFromPoint?.(clientX, clientY) ?? [];
    const target = elements.find((element) =>
      element.hasAttribute('data-timeline-phase-id'),
    );
    const value = target?.getAttribute('data-timeline-phase-id');
    return value === undefined
      ? (milestone.eventPhaseId ?? null)
      : value === 'none'
        ? null
        : value;
  }

  function finish(clientX: number, clientY: number) {
    if (!drag || !milestone.dueDate || !onChange) return;
    const moved =
      Math.hypot(clientX - drag.originX, clientY - drag.originY) >=
      DRAG_ACTIVATION_DISTANCE;
    const deltaDays = Math.round((clientX - drag.originX) / dayWidth);
    const phaseId = phaseAtPointer(clientX, clientY);
    setDrag(null);
    if (moved && (deltaDays || phaseId !== (milestone.eventPhaseId ?? null))) {
      onChange(
        milestone,
        dateKey(addDays(dateOnly(milestone.dueDate), deltaDays)),
        phaseId,
      );
    }
  }

  function moveByKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (!canEdit || !milestone.dueDate || !onChange) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      onChange(
        milestone,
        dateKey(
          addDays(
            dateOnly(milestone.dueDate),
            event.key === 'ArrowLeft' ? -1 : 1,
          ),
        ),
        milestone.eventPhaseId ?? null,
      );
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const currentIndex = milestone.eventPhaseId
        ? phases.findIndex((phase) => phase.id === milestone.eventPhaseId)
        : phases.length;
      const nextIndex = currentIndex + (event.key === 'ArrowUp' ? -1 : 1);
      const nextPhaseId =
        phases[nextIndex]?.id ??
        (nextIndex === phases.length ? null : undefined);
      if (nextPhaseId !== undefined) {
        event.preventDefault();
        onChange(milestone, milestone.dueDate, nextPhaseId);
      }
    }
  }

  return (
    <button
      type="button"
      aria-label={`${milestone.title}. Use as setas esquerda e direita para mudar a data; para cima e para baixo para mudar de fase.`}
      disabled={pending}
      className={cn(
        'absolute z-10 flex h-7 max-w-44 items-center gap-1.5 rounded-md bg-background/95 px-1.5 text-left text-xs font-semibold text-foreground transition-[box-shadow,background-color] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none',
        canEdit && 'cursor-grab touch-none active:cursor-grabbing',
        drag && 'z-30 shadow-lg ring-2 ring-primary',
        pending && 'cursor-wait opacity-60',
      )}
      style={{
        left: left + (drag?.deltaX ?? 0),
        top,
        transform: `translate(-13px, ${drag?.deltaY ?? 0}px)`,
      }}
      onClick={() => {
        if (draggedRef.current) {
          draggedRef.current = false;
          return;
        }
        onEdit?.(milestone);
      }}
      onKeyDown={moveByKeyboard}
      onPointerDown={(event) => {
        if (!canEdit || event.button !== 0) return;
        draggedRef.current = false;
        setDrag({
          pointerId: event.pointerId,
          originX: event.clientX,
          originY: event.clientY,
          deltaX: 0,
          deltaY: 0,
          phaseId: milestone.eventPhaseId ?? null,
        });
      }}
      onPointerMove={(event) => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - drag.originX;
        const deltaY = event.clientY - drag.originY;
        if (Math.hypot(deltaX, deltaY) >= DRAG_ACTIVATION_DISTANCE) {
          draggedRef.current = true;
          event.preventDefault();
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }
        setDrag({
          ...drag,
          deltaX,
          deltaY,
          phaseId: phaseAtPointer(event.clientX, event.clientY),
        });
      }}
      onPointerUp={(event) => {
        if (drag?.pointerId === event.pointerId) {
          finish(event.clientX, event.clientY);
        }
      }}
      onPointerCancel={() => setDrag(null)}
    >
      <Diamond
        aria-hidden="true"
        className="size-3.5 shrink-0 fill-fuchsia-500/15 text-fuchsia-500"
      />
      <span className="truncate">{milestone.title}</span>
    </button>
  );
}

function TimelineSection({
  group,
  colorBy,
  onEditTask,
  collapsed,
  height,
  range,
  days,
  dayWidth,
  scale,
  canvasWidth,
  todayX,
  today,
  milestones,
  projectId,
  onToggle,
  canEdit,
  grouping,
  statuses,
  interaction,
  pendingTaskIds,
  onInteractionChange,
  onCommitTaskChange,
}: {
  group: TimelineGroup;
  collapsed: boolean;
  height: number;
  colorBy: TimelineColor;
  onEditTask: (task: PortfolioTask) => void;
  range: TimelineRange;
  days: Date[];
  dayWidth: number;
  scale: TimelineScale;
  canvasWidth: number;
  todayX: number;
  today: string;
  milestones: EventMilestone[];
  projectId?: string;
  onToggle: () => void;
  canEdit: boolean;
  grouping: TimelineGrouping;
  statuses: TaskStatus[];
  interaction: TimelineInteraction | null;
  pendingTaskIds: Set<string>;
  onInteractionChange: (interaction: TimelineInteraction | null) => void;
  onCommitTaskChange: (
    task: PortfolioTask,
    mode: TimelineInteractionMode,
    deltaDays: number,
    deltaMinutes: number,
    statusId?: string,
  ) => void;
}) {
  const isDropTarget =
    grouping === 'status' && interaction?.statusId === group.key;
  return (
    <>
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={onToggle}
        className="sticky left-0 z-20 flex w-full items-start gap-2 border-b border-r border-border/60 bg-[color-mix(in_oklab,var(--background)_94%,var(--muted)_6%)] px-4 pt-3 text-left hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        style={{ height }}
      >
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
            collapsed && '-rotate-90',
          )}
        />
        <span className="min-w-0 truncate text-xs font-semibold">
          {group.label}
        </span>
      </button>
      <div
        className={cn(
          'relative border-b border-border/60 transition-colors motion-reduce:transition-none',
          isDropTarget && 'bg-primary/5 ring-2 ring-inset ring-primary/35',
        )}
        style={{ height, width: canvasWidth }}
        data-timeline-status-id={grouping === 'status' ? group.key : undefined}
      >
        <TimelineGridSurface
          days={days}
          dayWidth={dayWidth}
          canvasWidth={canvasWidth}
          todayX={todayX}
          className="absolute inset-0"
        />
        {!collapsed
          ? group.items.map((task, index) => (
              <TimelineTaskBar
                key={task.id}
                task={task}
                colorBy={colorBy}
                onEditTask={onEditTask}
                color={group.color}
                range={range}
                dayWidth={dayWidth}
                scale={scale}
                canvasWidth={canvasWidth}
                top={7 + index * (TASK_HEIGHT + TASK_GAP)}
                today={today}
                projectId={projectId}
                canEdit={canEdit}
                grouping={grouping}
                statuses={statuses}
                interaction={interaction}
                pending={pendingTaskIds.has(task.id)}
                onInteractionChange={onInteractionChange}
                onCommitTaskChange={onCommitTaskChange}
              />
            ))
          : null}
        {milestones.map((milestone) => {
          const left =
            timelinePosition({ date: milestone.dueDate!, range, scale }) *
              (dayWidth / timelineDayWidth(scale)) +
            dayWidth / 2;
          return (
            <span
              key={milestone.id}
              className="absolute inset-y-0 z-[1] border-l border-dashed border-fuchsia-500/25"
              style={{ left }}
              aria-hidden="true"
            />
          );
        })}
      </div>
    </>
  );
}

function TimelineGridSurface({
  days,
  dayWidth,
  canvasWidth,
  todayX,
  className,
}: {
  days: Date[];
  dayWidth: number;
  canvasWidth: number;
  todayX: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-[color-mix(in_oklab,var(--background)_92%,var(--muted)_8%)]',
        className,
      )}
      style={{
        width: canvasWidth,
        backgroundImage:
          dayWidth >= 8
            ? `repeating-linear-gradient(to right, transparent 0, transparent ${dayWidth - 1}px, color-mix(in oklab, var(--border) 48%, transparent) ${dayWidth - 1}px, color-mix(in oklab, var(--border) 48%, transparent) ${dayWidth}px)`
            : undefined,
      }}
    >
      {days.map((day, index) =>
        isWeekend(day) ? (
          <span
            key={day.toISOString()}
            className="absolute inset-y-0 bg-muted/[0.09]"
            style={{ left: index * dayWidth, width: dayWidth }}
            aria-hidden="true"
          />
        ) : null,
      )}
      {todayX >= 0 && todayX <= canvasWidth ? (
        <span
          className="absolute inset-y-0 z-[2] w-px bg-primary/45"
          style={{ left: todayX + dayWidth / 2 }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

function TimelineTaskBar({
  task,
  colorBy,
  onEditTask,
  color,
  range,
  dayWidth,
  scale,
  canvasWidth,
  top,
  today,
  projectId,
  canEdit,
  grouping,
  statuses,
  interaction,
  pending,
  onInteractionChange,
  onCommitTaskChange,
}: {
  task: PortfolioTask;
  color: string | null;
  colorBy: TimelineColor;
  onEditTask: (task: PortfolioTask) => void;
  range: TimelineRange;
  dayWidth: number;
  scale: TimelineScale;
  canvasWidth: number;
  top: number;
  today: string;
  projectId?: string;
  canEdit: boolean;
  grouping: TimelineGrouping;
  statuses: TaskStatus[];
  interaction: TimelineInteraction | null;
  pending: boolean;
  onInteractionChange: (interaction: TimelineInteraction | null) => void;
  onCommitTaskChange: (
    task: PortfolioTask,
    mode: TimelineInteractionMode,
    deltaDays: number,
    deltaMinutes: number,
    statusId?: string,
  ) => void;
}) {
  const contextPath = usePathname();
  const source = timelineTask(task);
  const dueDate = dateOnly(task.dueDate!);
  const pixelFactor = dayWidth / timelineDayWidth(scale);
  const startX =
    timelinePosition({
      date: source.startDate ?? task.dueDate!,
      time: source.startTime,
      range,
      scale,
    }) *
      pixelFactor +
    3;
  const endX =
    (source.dueTime
      ? timelinePosition({
          date: task.dueDate!,
          time: source.dueTime,
          range,
          scale,
        }) * pixelFactor
      : (differenceInCalendarDays(dueDate, range.start) + 1) * dayWidth) - 3;
  const left = Math.max(3, startX);
  const right = Math.min(canvasWidth - 3, endX);
  const width = Math.max(20, right - left);
  const done = task.statusCategory === 'done';
  const overdue =
    task.dueDate! < today && !done && task.statusCategory !== 'cancelled';
  const active = interaction?.taskId === task.id ? interaction : null;
  const draggedRef = useRef(false);
  const pendingPointerRef = useRef<{
    pointerId: number;
    mode: TimelineInteractionMode;
    originX: number;
    originY: number;
    statusId?: string;
  } | null>(null);
  const editable =
    canEdit &&
    source.canEdit !== false &&
    source.version !== undefined &&
    !pending;
  const resizeStartDelta = active
    ? Math.min(active.deltaX, Math.max(0, width - 20))
    : 0;
  const resizeEndDelta = active
    ? Math.max(active.deltaX, -Math.max(0, width - 20))
    : 0;
  const visualLeft = active
    ? active.mode === 'move' || active.mode === 'resize-start'
      ? left +
        (active.mode === 'resize-start' ? resizeStartDelta : active.deltaX)
      : left
    : left;
  const visualWidth = active
    ? active.mode === 'resize-start'
      ? Math.max(20, width - resizeStartDelta)
      : active.mode === 'resize-end'
        ? Math.max(20, width + resizeEndDelta)
        : width
    : width;

  function statusAtPointer(clientY: number) {
    if (grouping !== 'status') return undefined;
    const sections = document.querySelectorAll<HTMLElement>(
      '[data-timeline-status-id]',
    );
    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      const id = section.dataset.timelineStatusId;
      if (
        id &&
        clientY >= rect.top &&
        clientY <= rect.bottom &&
        statuses.some((status) => status.id === id)
      ) {
        return id;
      }
    }
    return source.statusId;
  }

  function startPointerInteraction(
    event: PointerEvent<HTMLElement>,
    mode: TimelineInteractionMode,
  ) {
    if (!editable || event.button !== 0) return;
    if (
      mode === 'move' &&
      (event.target as HTMLElement).closest('[data-timeline-resize]')
    ) {
      return;
    }
    draggedRef.current = false;
    pendingPointerRef.current = {
      mode,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      statusId: source.statusId,
    };
  }

  function movePointerInteraction(event: PointerEvent<HTMLElement>) {
    const sourceInteraction =
      active?.pointerId === event.pointerId
        ? active
        : pendingPointerRef.current?.pointerId === event.pointerId
          ? {
              taskId: task.id,
              ...pendingPointerRef.current,
              deltaX: 0,
              deltaY: 0,
              deltaDays: 0,
              deltaMinutes: 0,
            }
          : null;
    if (!sourceInteraction) return;
    const deltaX = event.clientX - sourceInteraction.originX;
    const deltaY = event.clientY - sourceInteraction.originY;
    if (Math.hypot(deltaX, deltaY) < DRAG_ACTIVATION_DISTANCE) return;
    if (!active) {
      pendingPointerRef.current = null;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    draggedRef.current = true;
    event.preventDefault();
    const snap = timelineSnapDelta({
      date:
        sourceInteraction.mode === 'resize-start'
          ? (source.startDate ?? task.dueDate!)
          : task.dueDate!,
      time:
        sourceInteraction.mode === 'move'
          ? source.startTime && source.dueTime
            ? source.startTime
            : null
          : sourceInteraction.mode === 'resize-start'
            ? source.startTime
            : source.dueTime,
      deltaPixels: deltaX,
      scale,
    });
    onInteractionChange({
      ...sourceInteraction,
      deltaX,
      deltaY,
      ...snap,
      statusId:
        sourceInteraction.mode === 'move'
          ? statusAtPointer(event.clientY)
          : sourceInteraction.statusId,
    });
  }

  function finishPointerInteraction(event: PointerEvent<HTMLElement>) {
    if (!active || active.pointerId !== event.pointerId) {
      if (pendingPointerRef.current?.pointerId === event.pointerId) {
        pendingPointerRef.current = null;
      }
      return;
    }
    const moved =
      Math.hypot(
        event.clientX - active.originX,
        event.clientY - active.originY,
      ) >= DRAG_ACTIVATION_DISTANCE;
    const snap = moved
      ? timelineSnapDelta({
          date:
            active.mode === 'resize-start'
              ? (source.startDate ?? task.dueDate!)
              : task.dueDate!,
          time:
            active.mode === 'move'
              ? source.startTime && source.dueTime
                ? source.startTime
                : null
              : active.mode === 'resize-start'
                ? source.startTime
                : source.dueTime,
          deltaPixels: event.clientX - active.originX,
          scale,
        })
      : { deltaDays: 0, deltaMinutes: 0 };
    const statusId =
      active.mode === 'move' ? statusAtPointer(event.clientY) : active.statusId;
    onInteractionChange(null);
    if (
      moved &&
      (snap.deltaDays ||
        snap.deltaMinutes ||
        (statusId && statusId !== source.statusId))
    ) {
      onCommitTaskChange(
        task,
        active.mode,
        snap.deltaDays,
        snap.deltaMinutes,
        statusId,
      );
    }
  }

  function handleMoveKey(event: KeyboardEvent<HTMLElement>) {
    if (!editable) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const snap = timelineKeyboardDelta({
        date: task.dueDate!,
        time: source.startTime && source.dueTime ? source.startTime : null,
        scale,
        direction: event.key === 'ArrowLeft' ? -1 : 1,
      });
      onCommitTaskChange(task, 'move', snap.deltaDays, snap.deltaMinutes);
      return;
    }
    if (
      grouping === 'status' &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown')
    ) {
      const currentStatusId =
        source.statusId ??
        statuses.find((status) => status.name === task.statusName)?.id;
      const currentIndex = statuses.findIndex(
        (status) => status.id === currentStatusId,
      );
      const direction = event.key === 'ArrowUp' ? -1 : 1;
      const target = statuses[currentIndex + direction];
      if (target) {
        event.preventDefault();
        onCommitTaskChange(task, 'move', 0, 0, target.id);
      }
    }
  }

  function handleResizeKey(
    event: KeyboardEvent<HTMLButtonElement>,
    mode: 'resize-start' | 'resize-end',
  ) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const snap = timelineKeyboardDelta({
      date:
        mode === 'resize-start'
          ? (source.startDate ?? task.dueDate!)
          : task.dueDate!,
      time: mode === 'resize-start' ? source.startTime : source.dueTime,
      scale,
      direction: event.key === 'ArrowLeft' ? -1 : 1,
    });
    onCommitTaskChange(task, mode, snap.deltaDays, snap.deltaMinutes);
  }

  const compact = width < COMPACT_TASK_WIDTH;
  const priorityColor = taskColors[task.priority];
  const taskBackground =
    colorBy === 'none'
      ? 'color-mix(in oklab, var(--muted) 72%, var(--background))'
      : colorBy === 'status'
        ? `color-mix(in oklab, ${color || 'var(--primary)'} 78%, white)`
        : priorityColor.background;
  const taskBorder =
    colorBy === 'none'
      ? 'color-mix(in oklab, var(--border) 82%, transparent)'
      : colorBy === 'status'
        ? color || 'var(--primary)'
        : priorityColor.border;
  const taskForeground =
    colorBy === 'priority' ? priorityColor.foreground : '#17191d';

  return (
    <div
      className={cn(
        'group/timeline-task absolute z-10 flex items-center rounded-[5px] border text-xs font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.22)] transition-[filter,box-shadow,transform] hover:z-20 hover:-translate-y-px hover:brightness-[1.04] hover:shadow-[0_4px_12px_rgba(0,0,0,0.22)] motion-reduce:transform-none motion-reduce:transition-none',
        editable && 'cursor-grab touch-none active:cursor-grabbing',
        active && 'z-30 opacity-90 shadow-lg ring-2 ring-white/70',
        pending && 'cursor-wait opacity-70',
        done && 'opacity-60',
        overdue && 'ring-1 ring-inset ring-destructive/70',
      )}
      style={{
        left: visualLeft,
        top,
        width: visualWidth,
        height: TASK_HEIGHT,
        backgroundColor: taskBackground,
        borderColor: taskBorder,
        color: taskForeground,
        transform:
          active?.mode === 'move'
            ? `translateY(${active.deltaY}px)`
            : undefined,
        willChange: active ? 'left, width, transform' : undefined,
      }}
      title={`${task.title} — ${format(dueDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`}
      onContextMenu={(event) => {
        if (editable) {
          event.preventDefault();
          onEditTask(task);
        }
      }}
      onPointerDown={(event) => startPointerInteraction(event, 'move')}
      onPointerMove={movePointerInteraction}
      onPointerUp={finishPointerInteraction}
      onPointerCancel={() => {
        pendingPointerRef.current = null;
        onInteractionChange(null);
      }}
    >
      {editable ? (
        <button
          type="button"
          data-timeline-resize
          aria-label={`Ajustar início de ${task.title}`}
          className="absolute inset-y-0 left-0 z-20 w-2.5 cursor-ew-resize rounded-l-md border-l-2 border-transparent opacity-0 transition-opacity hover:border-white/80 hover:bg-black/15 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring group-hover/timeline-task:opacity-100 group-focus-within/timeline-task:opacity-100 motion-reduce:transition-none sm:w-2"
          onPointerDown={(event) =>
            startPointerInteraction(event, 'resize-start')
          }
          onKeyDown={(event) => handleResizeKey(event, 'resize-start')}
        />
      ) : null}
      <Link
        href={
          projectId
            ? taskHrefWithReturn(
                task.id,
                `${contextPath ?? `/projetos/${projectId}`}?visao=timeline`,
              )
            : `/tarefa/${task.id}`
        }
        draggable={false}
        aria-label={`${task.title}. ${editable ? 'Use as setas esquerda e direita para mover um dia; para cima e para baixo para alterar o status.' : ''}`}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1.5 self-stretch overflow-hidden rounded-[4px] px-2 hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          compact &&
            'absolute inset-y-0 w-48 overflow-visible px-0 hover:bg-transparent',
        )}
        style={
          compact
            ? {
                left: 'calc(100% + 6px)',
                color: 'var(--foreground)',
              }
            : undefined
        }
        onKeyDown={handleMoveKey}
        onClick={(event) => {
          if (draggedRef.current) {
            event.preventDefault();
            draggedRef.current = false;
          }
        }}
      >
        <>
          <span
            className={cn(
              'grid size-5 shrink-0 place-items-center rounded-full border border-black/10 bg-white/45 text-[11px] font-semibold uppercase text-black/75',
              compact && 'border-border/60 bg-muted text-muted-foreground',
            )}
          >
            {task.assigneeName?.charAt(0) ?? '—'}
          </span>
          <span className="min-w-0">
            <span className="block truncate">{task.title}</span>
            <span
              className={cn(
                'block truncate text-[10px] font-medium opacity-70',
                compact && 'text-muted-foreground opacity-100',
              )}
            >
              Prazo: {format(dueDate, 'd MMM', { locale: ptBR })}
            </span>
          </span>
        </>
      </Link>
      {editable ? (
        <button
          type="button"
          data-timeline-resize
          aria-label={`Planejar ${task.title}`}
          onClick={() => onEditTask(task)}
          className="absolute -top-2 right-0 z-30 grid size-6 place-items-center rounded border bg-background opacity-0 hover:bg-muted focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover/timeline-task:opacity-100 group-focus-within/timeline-task:opacity-100"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      ) : null}
      {done && !compact ? (
        <Check
          aria-hidden="true"
          className="pointer-events-none absolute right-2 size-3 opacity-0 transition-opacity group-hover/timeline-task:opacity-100 group-focus-within/timeline-task:opacity-100 motion-reduce:transition-none"
        />
      ) : null}
      {editable ? (
        <button
          type="button"
          data-timeline-resize
          aria-label={`Ajustar término de ${task.title}`}
          className="absolute inset-y-0 right-0 z-20 w-2.5 cursor-ew-resize rounded-r-md border-r-2 border-transparent opacity-0 transition-opacity hover:border-white/80 hover:bg-black/15 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring group-hover/timeline-task:opacity-100 group-focus-within/timeline-task:opacity-100 motion-reduce:transition-none sm:w-2"
          onPointerDown={(event) =>
            startPointerInteraction(event, 'resize-end')
          }
          onKeyDown={(event) => handleResizeKey(event, 'resize-end')}
        />
      ) : null}
    </div>
  );
}

function TimelineQueue({
  projectId,
  tasks,
  outsideTasks,
  milestones,
  canEdit,
  pendingMilestoneId,
  onAddMilestone,
  onToggleMilestone,
  onEditMilestone,
}: {
  projectId?: string;
  tasks: PortfolioTask[];
  outsideTasks: PortfolioTask[];
  milestones: EventMilestone[];
  canEdit: boolean;
  pendingMilestoneId: string | null;
  onAddMilestone: () => void;
  onToggleMilestone: (milestone: EventMilestone) => void;
  onEditMilestone?: (milestone: EventMilestone) => void;
}) {
  const contextPath = usePathname();
  return (
    <div className="grid shrink-0 gap-px border-b bg-border">
      {[...tasks, ...outsideTasks].map((task) => (
        <Link
          key={task.id}
          href={
            projectId
              ? taskHrefWithReturn(
                  task.id,
                  `${contextPath ?? `/projetos/${projectId}`}?visao=timeline`,
                )
              : `/tarefa/${task.id}`
          }
          className="min-h-16 bg-background px-4 py-2.5 hover:bg-muted/30 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p className="truncate text-xs font-semibold">{task.title}</p>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {task.dueDate
              ? `${format(dateOnly(task.dueDate), 'd MMM yyyy', { locale: ptBR })} · fora do período`
              : 'Sem data'}
          </p>
        </Link>
      ))}
      {milestones.map((milestone) => (
        <button
          key={milestone.id}
          type="button"
          disabled={!canEdit || pendingMilestoneId === milestone.id}
          onClick={() =>
            onEditMilestone
              ? onEditMilestone(milestone)
              : onToggleMilestone(milestone)
          }
          className="min-h-16 bg-background px-4 py-2.5 text-left hover:bg-muted/30 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p className="flex items-center gap-2 truncate text-xs font-semibold">
            <Diamond aria-hidden="true" className="size-3 text-fuchsia-500" />
            {milestone.title}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {milestone.dueDate
              ? format(dateOnly(milestone.dueDate), 'd MMM yyyy', {
                  locale: ptBR,
                })
              : 'Marco sem data'}
          </p>
        </button>
      ))}
      {!tasks.length && !outsideTasks.length && !milestones.length ? (
        <div className="col-span-full flex min-h-16 items-center justify-between bg-background px-4 py-2.5">
          <p className="text-xs text-muted-foreground">
            Todas as entregas estão posicionadas no período atual.
          </p>
          {canEdit ? (
            <Button variant="ghost" size="sm" onClick={onAddMilestone}>
              <Plus aria-hidden="true" />
              Marco
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
