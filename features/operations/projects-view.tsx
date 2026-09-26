'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CalendarRange,
  ChevronRight,
  Columns3,
  LayoutList,
  Plus,
  Search,
  SlidersHorizontal,
  UsersRound,
  GripVertical,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useMemo, useState } from 'react';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
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
import type { WorkspaceMember } from '@/features/workspace/types';
import { dateFromKey, isDateKey, toDateKey } from '@/features/tasks/date-utils';
import {
  TaskBoardColumn,
  TaskBoardEmpty,
  TaskBoardViewport,
} from '@/features/tasks/task-board';
import { cn } from '@/lib/utils';
import {
  BoardColumnControls,
  BoardColumnIconGlyph,
  type BoardColumnColor,
  type BoardColumnEditableValues,
  type BoardColumnIcon,
} from '@/features/tasks/board-column-controls';

import { EventEditorDialog } from './portfolio-editor-dialog';
import {
  type ProjectBoardColumn,
  useProjectBoardConfiguration,
  useReorderProjectBoardColumns,
  useUpdateProjectBoardColumn,
} from './project-board-configuration';
import type { EventsPageData, EventSummary, ProductSummary } from './types';

type ProjectMode = 'list' | 'board' | 'timeline';
type StatusFilter = 'all' | EventSummary['status'];

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Ativos' },
  { value: 'planning', label: 'Planejamento' },
  { value: 'completed', label: 'Concluídos' },
  { value: 'cancelled', label: 'Cancelados' },
];

const modes = [
  { value: 'list', label: 'Lista', icon: LayoutList },
  { value: 'board', label: 'Quadro', icon: Columns3 },
  { value: 'timeline', label: 'Cronograma', icon: CalendarRange },
] as const;

export function ProjectsView({
  data,
  products,
  workspaceId,
  members,
  canManage,
}: {
  data: EventsPageData;
  products: ProductSummary[];
  workspaceId: string;
  members: WorkspaceMember[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ProjectMode>('list');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('all');
  const [period, setPeriod] = useState<'all' | 'dated' | 'undated'>('all');
  const deferredSearch = useDeferredValue(search);
  const [createOpen, setCreateOpen] = useState(false);

  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = {
      all: data.events.length,
      active: 0,
      planning: 0,
      completed: 0,
      cancelled: 0,
    };
    data.events.forEach((project) => {
      result[project.status] += 1;
    });
    return result;
  }, [data.events]);

  const projects = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase('pt-BR');
    return data.events.filter((project) => {
      if (status !== 'all' && project.status !== status) return false;
      if (
        owner === 'unassigned'
          ? Boolean(project.ownerId)
          : owner !== 'all' && project.ownerId !== owner
      )
        return false;
      const hasPeriod = Boolean(project.startDate || project.endDate);
      if (period === 'dated' && !hasPeriod) return false;
      if (period === 'undated' && hasPeriod) return false;
      if (!query) return true;
      return [
        project.name,
        project.summary,
        project.ownerName,
        project.productName,
      ]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase('pt-BR').includes(query));
    });
  }, [data.events, deferredSearch, status, owner, period]);
  const filterCount = Number(owner !== 'all') + Number(period !== 'all');

  function openProject(id: string) {
    router.push(`/projetos/${id}`);
  }

  return (
    <div className="min-h-[calc(100dvh-48px)]">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/85">
        <div className="flex min-h-20 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-[-0.025em]">
              Projetos
            </h1>
          </div>
          {canManage ? (
            <Button
              className="h-10 shrink-0 px-4"
              onClick={() => setCreateOpen(true)}
            >
              <Plus aria-hidden="true" />
              Novo projeto
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t px-4 py-3 sm:px-6">
          <div
            className="pta-tabs-scroll flex max-w-full items-center gap-1 overflow-x-auto"
            role="group"
            aria-label="Filtrar projetos por status"
          >
            {statusFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={status === item.value}
                onClick={() => setStatus(item.value)}
                className={cn(
                  'relative h-10 shrink-0 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  status === item.value && 'bg-muted text-foreground',
                )}
              >
                {item.label}
                <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                  {counts[item.value]}
                </span>
              </button>
            ))}
          </div>

          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 2xl:w-auto 2xl:flex-1 2xl:justify-end">
            <div className="relative min-w-32 flex-1 2xl:max-w-64">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar projetos"
                aria-label="Buscar projetos"
                className="h-10 bg-card pl-9 shadow-none"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 shrink-0 px-3"
                  aria-label={`Filtros do projeto${filterCount ? `, ${filterCount} ativos` : ''}`}
                >
                  <SlidersHorizontal aria-hidden="true" />
                  <span className="hidden sm:inline">Filtros</span>
                  {filterCount ? (
                    <span className="grid size-5 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
                      {filterCount}
                    </span>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-[min(92vw,320px)] space-y-4 p-4"
              >
                <PopoverHeader>
                  <PopoverTitle>Filtrar projetos</PopoverTitle>
                </PopoverHeader>
                <div className="space-y-2">
                  <Label htmlFor="project-owner-filter">Responsável</Label>
                  <Select value={owner} onValueChange={setOwner}>
                    <SelectTrigger id="project-owner-filter" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os responsáveis</SelectItem>
                      <SelectItem value="unassigned">
                        Sem responsável
                      </SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-period-filter">Planejamento</Label>
                  <Select
                    value={period}
                    onValueChange={(value) => setPeriod(value as typeof period)}
                  >
                    <SelectTrigger
                      id="project-period-filter"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os projetos</SelectItem>
                      <SelectItem value="dated">
                        Com período definido
                      </SelectItem>
                      <SelectItem value="undated">
                        Sem período definido
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {filterCount ? (
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setOwner('all');
                      setPeriod('all');
                    }}
                  >
                    Limpar filtros
                  </Button>
                ) : null}
              </PopoverContent>
            </Popover>
            <div
              className="flex shrink-0 rounded-xl bg-muted/55 p-1"
              role="group"
              aria-label="Visualização de projetos"
            >
              {modes.map((item) => (
                <Button
                  key={item.value}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-9 min-w-10 rounded-lg px-2.5 text-muted-foreground',
                    mode === item.value &&
                      'bg-background text-foreground shadow-sm',
                  )}
                  aria-pressed={mode === item.value}
                  aria-label={item.label}
                  title={item.label}
                  onClick={() => setMode(item.value)}
                >
                  <item.icon aria-hidden="true" className="size-4" />
                  <span className="hidden min-[1600px]:inline">
                    {item.label}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-3 sm:px-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="sr-only">Portfólio da equipe</h2>
          <p
            className="text-xs tabular-nums text-muted-foreground"
            aria-live="polite"
          >
            {projects.length} {projects.length === 1 ? 'projeto' : 'projetos'}
          </p>
        </div>

        {!projects.length ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center">
            <h3 className="font-semibold">Nenhum projeto encontrado</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Ajuste a busca ou crie um projeto para organizar o trabalho da
              equipe.
            </p>
          </div>
        ) : mode === 'list' ? (
          <ProjectList projects={projects} onOpen={openProject} />
        ) : mode === 'board' ? (
          <ProjectBoard
            projects={projects}
            onOpen={openProject}
            workspaceId={workspaceId}
            canManage={canManage}
          />
        ) : (
          <ProjectTimeline
            projects={projects}
            today={data.today}
            onOpen={openProject}
          />
        )}
      </main>

      <EventEditorDialog
        key={createOpen ? 'project-create-open' : 'project-create-closed'}
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspaceId}
        members={members}
        products={products}
        onSaved={(id) => openProject(id)}
      />
    </div>
  );
}

function ProjectList({
  projects,
  onOpen,
}: {
  projects: EventSummary[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="@container overflow-hidden border-b">
      <div className="hidden min-h-10 grid-cols-[minmax(200px,1.6fr)_170px_minmax(130px,1fr)_160px_120px_20px] items-center gap-4 border-b px-3 text-xs font-medium text-muted-foreground @[960px]:grid">
        <span>Projeto</span>
        <span>Status e saúde</span>
        <span>Responsável</span>
        <span>Período</span>
        <span>Progresso</span>
        <span />
      </div>
      <div className="divide-y">
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => onOpen(project.id)}
            className="grid min-h-16 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-3 py-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring @[960px]:grid-cols-[minmax(200px,1.6fr)_170px_minmax(130px,1fr)_160px_120px_20px]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{project.name}</p>
              {project.summary || project.productName ? (
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {project.summary || project.productName}
                </p>
              ) : null}
            </div>
            <span className="flex flex-wrap items-center gap-2">
              <ProjectStatus project={project} />
              <ProjectHealth project={project} />
            </span>
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <PersonDot name={project.ownerName} />
              <span className="truncate">
                {project.ownerName ?? 'Não definido'}
              </span>
            </span>
            <span className="text-right text-xs text-muted-foreground @[960px]:text-left @[960px]:text-sm">
              {formatRange(project.startDate, project.endDate)}
            </span>
            <div className="col-span-2 @[960px]:col-span-1">
              <Progress project={project} />
            </div>
            <ChevronRight
              aria-hidden="true"
              className="hidden size-4 text-muted-foreground @[960px]:block"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function ProjectBoard({
  projects,
  onOpen,
  workspaceId,
  canManage,
}: {
  projects: EventSummary[];
  onOpen: (id: string) => void;
  workspaceId: string;
  canManage: boolean;
}) {
  const configuration = useProjectBoardConfiguration(workspaceId);
  const updateColumn = useUpdateProjectBoardColumn(workspaceId);
  const reorderColumns = useReorderProjectBoardColumns(workspaceId);
  const [previewColumns, setPreviewColumns] = useState<
    ProjectBoardColumn[] | null
  >(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const columns = previewColumns ?? configuration.data?.columns ?? [];
  const canManageColumns = Boolean(
    canManage &&
    configuration.data?.source === 'remote' &&
    configuration.data.can_manage_columns,
  );

  async function saveColumn(
    columnKey: string,
    value: BoardColumnEditableValues,
  ) {
    const board = configuration.data;
    const column = board?.columns.find((item) => item.key === columnKey);
    if (!board || board.source !== 'remote' || !column)
      throw new Error('Configuração indisponível');
    await updateColumn.mutateAsync({
      column,
      name: value.name,
      color: value.color,
      iconKey: value.icon,
      coverUrl: value.coverUrl,
      boardVersion: board.version,
    });
  }

  async function persistOrder(next: ProjectBoardColumn[]) {
    const board = configuration.data;
    if (!board || board.source !== 'remote') return;
    if (
      next.every((column, index) => column.key === board.columns[index]?.key)
    ) {
      setPreviewColumns(null);
      return;
    }
    try {
      await reorderColumns.mutateAsync({
        orderedKeys: next.map((column) => column.key),
        boardVersion: board.version,
      });
      toast.success('Ordem das colunas de Projetos atualizada.');
    } catch {
      toast.error('Não foi possível reordenar as colunas de Projetos.');
      await configuration.refetch();
    } finally {
      setPreviewColumns(null);
    }
  }

  function moveColumn(columnKey: string, direction: 'left' | 'right') {
    const current = columns.findIndex((column) => column.key === columnKey);
    const target = current + (direction === 'left' ? -1 : 1);
    if (current < 0 || target < 0 || target >= columns.length) return;
    const next = arrayMove(columns, current, target);
    setPreviewColumns(next);
    void persistOrder(next);
  }

  return (
    <div className="-mx-4 flex min-h-[520px] flex-col sm:-mx-6">
      <DndContext
        sensors={sensors}
        onDragStart={({ active }) => setDraggingKey(String(active.id))}
        onDragCancel={() => {
          setDraggingKey(null);
          setPreviewColumns(null);
        }}
        onDragOver={({ active, over }) => {
          if (!over) return;
          const current = columns.findIndex(
            (column) => column.key === active.id,
          );
          const target = columns.findIndex((column) => column.key === over.id);
          if (current >= 0 && target >= 0 && current !== target)
            setPreviewColumns(arrayMove(columns, current, target));
        }}
        onDragEnd={() => {
          const next = columns;
          setDraggingKey(null);
          setPreviewColumns(null);
          void persistOrder(next);
        }}
      >
        <TaskBoardViewport label="Projetos por status">
          <SortableContext
            items={columns.map((column) => column.key)}
            strategy={horizontalListSortingStrategy}
          >
            {columns.map((column, index) => {
              const items = projects.filter(
                (project) => project.status === column.key,
              );
              return (
                <SortableProjectColumn
                  key={column.key}
                  column={column}
                  items={items}
                  index={index}
                  total={columns.length}
                  canManage={canManageColumns}
                  onOpen={onOpen}
                  onMove={moveColumn}
                  onUpdate={saveColumn}
                />
              );
            })}
          </SortableContext>
        </TaskBoardViewport>
        <DragOverlay>
          {draggingKey ? (
            <div className="w-[320px] rounded-2xl border border-primary/40 bg-popover/95 px-4 py-5 shadow-2xl backdrop-blur-xl">
              <p className="font-semibold">
                {columns.find((column) => column.key === draggingKey)?.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Solte para reposicionar
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function SortableProjectColumn({
  column,
  items,
  index,
  total,
  canManage,
  onOpen,
  onMove,
  onUpdate,
}: {
  column: ProjectBoardColumn;
  items: EventSummary[];
  index: number;
  total: number;
  canManage: boolean;
  onOpen: (id: string) => void;
  onMove: (columnKey: string, direction: 'left' | 'right') => void;
  onUpdate: (
    columnKey: string,
    value: BoardColumnEditableValues,
  ) => Promise<void>;
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
  } = useSortable({ id: column.key, disabled: !canManage });
  return (
    <div
      ref={setNodeRef}
      className={cn('h-full', isDragging && 'opacity-35')}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <TaskBoardColumn
        ref={null}
        id={`project-board-${column.key}`}
        title={column.name}
        coverUrl={column.cover_url}
        count={items.length}
        isOver={isOver}
        dragHandle={
          canManage ? (
            <Button
              ref={setActivatorNodeRef}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Mover coluna ${column.name}`}
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
              'grid size-7 place-items-center rounded-lg',
              projectColumnTone(column.color),
            )}
          >
            <BoardColumnIconGlyph
              icon={projectColumnIcon(column.icon_key)}
              className="size-4"
            />
          </span>
        }
        headerAction={
          canManage ? (
            <BoardColumnControls
              columnId={column.key}
              value={{
                name: column.name,
                color: projectColumnColor(column.color),
                icon: projectColumnIcon(column.icon_key),
                coverUrl: column.cover_url,
                weekLink: 'none',
              }}
              canMoveLeft={index > 0}
              canMoveRight={index < total - 1}
              showWeekLink={false}
              onMove={onMove}
              onUpdate={onUpdate}
              onOpenAutomations={() =>
                toast.info(
                  'As automações Quadro ↔ Semana pertencem ao fluxo de tarefas.',
                )
              }
            />
          ) : null
        }
      >
        {items.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => onOpen(project.id)}
            className="pta-task-card w-full rounded-xl border bg-card p-4 text-left transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <h4 className="break-words text-base font-semibold leading-6">
              {project.name}
            </h4>
            {project.summary ? (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {project.summary}
              </p>
            ) : null}
            <div className="mt-3">
              <ProjectHealth project={project} />
            </div>
            <div className="mt-4">
              <Progress project={project} />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="flex min-w-0 items-center gap-2">
                <PersonDot name={project.ownerName} />
                <span className="truncate">
                  {project.ownerName ?? 'Não definido'}
                </span>
              </span>
              <span className="shrink-0">{project.totalTasks} tarefas</span>
            </div>
          </button>
        ))}
        {!items.length ? <TaskBoardEmpty>Nenhum projeto</TaskBoardEmpty> : null}
      </TaskBoardColumn>
    </div>
  );
}

function projectColumnColor(value: string): BoardColumnColor {
  return [
    'stone',
    'blue',
    'violet',
    'amber',
    'red',
    'green',
    'teal',
    'pink',
  ].includes(value)
    ? (value as BoardColumnColor)
    : 'stone';
}

function projectColumnIcon(value: string): BoardColumnIcon {
  const aliases: Record<string, BoardColumnIcon> = {
    'clipboard-list': 'inbox',
    'circle-play': 'clock',
    'circle-check': 'check',
    'circle-x': 'cancel',
  };
  const normalized = aliases[value] ?? value;
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

function projectColumnTone(value: string) {
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
  return tones[projectColumnColor(value)];
}

function ProjectTimeline({
  projects,
  today,
  onOpen,
}: {
  projects: EventSummary[];
  today: string;
  onOpen: (id: string) => void;
}) {
  const dated = projects.filter(
    (project) => isDateKey(project.startDate) || isDateKey(project.endDate),
  );
  const undated = projects.filter(
    (project) => !isDateKey(project.startDate) && !isDateKey(project.endDate),
  );
  const dates = dated
    .flatMap((project) =>
      [project.startDate, project.endDate].filter(isDateKey),
    )
    .sort();
  const firstDate = dateFromKey(dates[0] ?? today);
  const lastDate = dateFromKey(dates.at(-1) ?? today);
  const scaleStart = addDays(firstDate, -2);
  const span = Math.max(13, differenceInCalendarDays(lastDate, firstDate) + 4);
  const scaleEnd = addDays(scaleStart, span);
  const showYear = scaleStart.getFullYear() !== scaleEnd.getFullYear();
  const ticks = Array.from({ length: 5 }, (_, index) => {
    const offset = Math.round((span * index) / 4);
    return {
      date: toDateKey(addDays(scaleStart, offset)),
      position: (offset / span) * 100,
    };
  });
  const todayPosition =
    (differenceInCalendarDays(dateFromKey(today), scaleStart) / span) * 100;
  const todayVisible = todayPosition >= 0 && todayPosition <= 100;

  return (
    <div className="space-y-5">
      <section
        className="overflow-hidden rounded-2xl border bg-card"
        aria-labelledby="project-timeline-title"
      >
        <div className="border-b px-4 py-4 sm:px-5">
          <h3 id="project-timeline-title" className="text-base font-semibold">
            Cronograma dos projetos
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Início e fim na mesma escala de datas. Um ponto indica uma única
            data cadastrada.
          </p>
        </div>
        {dated.length ? (
          <div
            className="pta-kanban-scroll overflow-x-auto"
            role="region"
            aria-label="Linha do tempo dos projetos"
            tabIndex={0}
          >
            <div className="min-w-[780px]">
              <div className="grid h-16 grid-cols-[220px_minmax(0,1fr)] items-center gap-5 px-5">
                <span className="text-sm font-medium text-muted-foreground">
                  Projeto e período
                </span>
                <div className="relative h-full">
                  {ticks.map((tick, index) => (
                    <span
                      key={tick.date}
                      className="absolute top-5 whitespace-nowrap text-xs font-medium tabular-nums text-muted-foreground"
                      style={{
                        left: `${tick.position}%`,
                        transform:
                          index === 0
                            ? undefined
                            : index === ticks.length - 1
                              ? 'translateX(-100%)'
                              : 'translateX(-50%)',
                      }}
                    >
                      {formatDate(tick.date, showYear)}
                    </span>
                  ))}
                </div>
              </div>
              {[...dated]
                .sort((left, right) =>
                  (left.startDate ?? left.endDate ?? '').localeCompare(
                    right.startDate ?? right.endDate ?? '',
                  ),
                )
                .map((project) => {
                  const start = isDateKey(project.startDate)
                    ? project.startDate
                    : project.endDate!;
                  const end = isDateKey(project.endDate)
                    ? project.endDate
                    : start;
                  const left =
                    (differenceInCalendarDays(dateFromKey(start), scaleStart) /
                      span) *
                    100;
                  const width =
                    (Math.max(
                      0,
                      differenceInCalendarDays(
                        dateFromKey(end),
                        dateFromKey(start),
                      ),
                    ) /
                      span) *
                    100;
                  const isInterval =
                    isDateKey(project.startDate) &&
                    isDateKey(project.endDate) &&
                    width > 0;
                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => onOpen(project.id)}
                      className="grid min-h-20 w-full grid-cols-[220px_minmax(0,1fr)] items-stretch gap-5 border-t px-5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      aria-label={`${project.name}, ${formatRange(project.startDate, project.endDate)}`}
                    >
                      <span className="flex min-w-0 flex-col justify-center py-3">
                        <span className="truncate text-sm font-semibold">
                          {project.name}
                        </span>
                        <span className="mt-1 text-xs text-muted-foreground">
                          {formatRange(project.startDate, project.endDate)}
                        </span>
                      </span>
                      <span className="relative block" aria-hidden="true">
                        {ticks.map((tick) => (
                          <span
                            key={tick.date}
                            className="absolute inset-y-0 border-l border-border/50"
                            style={{ left: `${tick.position}%` }}
                          />
                        ))}
                        {todayVisible ? (
                          <span
                            className="absolute inset-y-0 z-10 border-l border-dashed border-primary/65"
                            style={{ left: `${todayPosition}%` }}
                            title="Hoje"
                          />
                        ) : null}
                        <span
                          className={cn(
                            'absolute top-1/2 -translate-y-1/2 border border-primary/40 bg-primary/20',
                            isInterval
                              ? 'h-7 min-w-2 rounded-lg'
                              : 'size-3 -translate-x-1/2 rounded-full bg-primary',
                            project.status === 'completed' &&
                              'border-emerald-500/40 bg-emerald-500/20',
                            project.status === 'cancelled' &&
                              'border-muted-foreground/40 bg-muted-foreground/20',
                          )}
                          style={{
                            left: `${left}%`,
                            ...(isInterval ? { width: `${width}%` } : {}),
                          }}
                        />
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        ) : (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            Defina o período de um projeto para visualizar o cronograma.
          </p>
        )}
        {dated.length && todayVisible ? (
          <p className="flex items-center gap-2 border-t px-5 py-3 text-xs text-muted-foreground">
            <span
              className="h-4 border-l border-dashed border-primary"
              aria-hidden="true"
            />
            Linha tracejada: hoje, {formatDate(today)}
          </p>
        ) : null}
      </section>
      {undated.length ? (
        <section
          className="overflow-hidden rounded-2xl border bg-card"
          aria-labelledby="undated-projects-title"
        >
          <h3
            id="undated-projects-title"
            className="border-b px-5 py-4 text-sm font-semibold"
          >
            Sem período definido{' '}
            <span className="ml-2 font-normal tabular-nums text-muted-foreground">
              {undated.length}
            </span>
          </h3>
          <div className="divide-y">
            {undated.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => onOpen(project.id)}
                className="flex min-h-16 w-full items-center justify-between gap-4 px-5 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="min-w-0 truncate text-sm font-medium">
                  {project.name}
                </span>
                <ProjectStatus project={project} />
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ProjectStatus({ project }: { project: EventSummary }) {
  const labels = {
    planning: 'Planejamento',
    active: 'Ativo',
    completed: 'Concluído',
    cancelled: 'Cancelado',
  } as const;
  const tones = {
    planning:
      'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300',
    active:
      'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    completed: 'border-muted-foreground/20 bg-muted text-muted-foreground',
    cancelled: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
  } as const;
  return (
    <Badge
      variant="outline"
      className={cn(
        'w-fit shrink-0 rounded-lg px-2 py-1 text-xs',
        tones[project.status],
      )}
    >
      {labels[project.status]}
    </Badge>
  );
}

function ProjectHealth({ project }: { project: EventSummary }) {
  const presentation = {
    healthy: ['Saudável', 'bg-emerald-500'],
    attention: ['Atenção', 'bg-amber-500'],
    risk: ['Em risco', 'bg-red-500'],
  } as const;
  const [label, color] = presentation[project.health];
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-lg bg-muted/70 px-2 text-xs font-medium text-muted-foreground">
      <span className={cn('size-2 rounded-full', color)} aria-hidden="true" />
      {label}
    </span>
  );
}

function Progress({ project }: { project: EventSummary }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="tabular-nums">{project.progress ?? 0}%</span>
        <span className="text-muted-foreground">
          {project.doneTasks}/{project.totalTasks}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`Progresso de ${project.name}`}
        aria-valuenow={Math.max(0, Math.min(100, project.progress ?? 0))}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${project.doneTasks} de ${project.totalTasks} tarefas concluídas`}
      >
        <span
          className="block h-full rounded-full bg-primary"
          style={{
            width: `${Math.max(0, Math.min(100, project.progress ?? 0))}%`,
          }}
        />
      </div>
    </div>
  );
}

function PersonDot({ name }: { name: string | null }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
    >
      {name?.trim().slice(0, 1).toLocaleUpperCase('pt-BR') || (
        <UsersRound className="size-3.5" />
      )}
    </span>
  );
}

function formatDate(value: string | null, includeYear = false) {
  if (!isDateKey(value)) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    ...(includeYear ? ({ year: 'numeric' } as const) : {}),
  }).format(dateFromKey(value));
}

function formatRange(start: string | null, end: string | null) {
  if (!start && !end) return 'Sem período';
  if (start && end)
    return start === end
      ? formatDate(start)!
      : `${formatDate(start)} – ${formatDate(end)}`;
  return start ? `Desde ${formatDate(start)}` : `Até ${formatDate(end)}`;
}
