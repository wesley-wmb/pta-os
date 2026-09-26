'use client';

import {
  AlertTriangle,
  CalendarDays,
  Columns3,
  LayoutGrid,
  List,
  Plus,
  Search,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WorkspaceMember } from '@/features/workspace/types';
import { cn } from '@/lib/utils';

import { EventDetailSheet } from './portfolio-detail-sheet';
import { EventEditorDialog } from './portfolio-editor-dialog';
import type { EventsPageData, EventSummary, ProductSummary } from './types';

type EventMode = 'gallery' | 'list' | 'calendar' | 'timeline';
type StatusFilter = 'all' | EventSummary['status'];

const ALL_FILTER = 'all';

const MODE_OPTIONS: Array<{
  value: EventMode;
  label: string;
  icon: typeof LayoutGrid;
}> = [
  { value: 'gallery', label: 'Galeria', icon: LayoutGrid },
  { value: 'list', label: 'Lista', icon: List },
  { value: 'calendar', label: 'Por mês', icon: CalendarDays },
  { value: 'timeline', label: 'Linha do tempo', icon: Columns3 },
];

const STATUS_OPTIONS: Array<{
  value: StatusFilter;
  label: string;
}> = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Em curso' },
  { value: 'planning', label: 'Planejamento' },
  { value: 'completed', label: 'Concluídos' },
  { value: 'cancelled', label: 'Cancelados' },
];

export function EventsView({
  data,
  products,
  workspaceId,
  members,
  taskPrefix,
  canManage,
  selectedEventId = null,
  initialMode = 'detail',
}: {
  data: EventsPageData;
  products: ProductSummary[];
  workspaceId: string;
  members: WorkspaceMember[];
  taskPrefix: string;
  canManage: boolean;
  selectedEventId?: string | null;
  initialMode?: 'detail' | 'edit';
}) {
  const router = useRouter();
  const [mode, setMode] = useState<EventMode>('gallery');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(ALL_FILTER);
  const [productFilter, setProductFilter] = useState(ALL_FILTER);
  const [yearFilter, setYearFilter] = useState(ALL_FILTER);
  const [detailId, setDetailId] = useState<string | null>(selectedEventId);
  const [detailMode, setDetailMode] = useState(initialMode);
  const [createOpen, setCreateOpen] = useState(false);

  const productOptions = useMemo(
    () =>
      [
        ...new Set(data.events.flatMap((event) => event.productName ?? [])),
      ].sort((left, right) => left.localeCompare(right, 'pt-BR')),
    [data.events],
  );
  const yearOptions = useMemo(
    () =>
      [...new Set(data.events.flatMap(eventYears))].sort(
        (left, right) => Number(right) - Number(left),
      ),
    [data.events],
  );

  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase('pt-BR');
    return data.events.filter((event) =>
      eventMatchesFilters(event, {
        query,
        status: statusFilter,
        product: productFilter,
        year: yearFilter,
      }),
    );
  }, [data.events, deferredSearch, productFilter, statusFilter, yearFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: 0,
      active: 0,
      planning: 0,
      completed: 0,
      cancelled: 0,
    };
    const query = deferredSearch.trim().toLocaleLowerCase('pt-BR');
    for (const event of data.events) {
      if (
        !eventMatchesFilters(event, {
          query,
          status: ALL_FILTER,
          product: productFilter,
          year: yearFilter,
        })
      )
        continue;
      counts.all += 1;
      counts[event.status] += 1;
    }
    return counts;
  }, [data.events, deferredSearch, productFilter, yearFilter]);

  const productFacet = useMemo(() => {
    const counts = new Map<string, number>();
    let total = 0;
    const query = deferredSearch.trim().toLocaleLowerCase('pt-BR');
    for (const event of data.events) {
      if (
        !eventMatchesFilters(event, {
          query,
          status: statusFilter,
          product: ALL_FILTER,
          year: yearFilter,
        })
      )
        continue;
      total += 1;
      if (event.productName)
        counts.set(event.productName, (counts.get(event.productName) ?? 0) + 1);
    }
    return { counts, total };
  }, [data.events, deferredSearch, statusFilter, yearFilter]);

  const yearFacet = useMemo(() => {
    const counts = new Map<string, number>();
    let total = 0;
    const query = deferredSearch.trim().toLocaleLowerCase('pt-BR');
    for (const event of data.events) {
      if (
        !eventMatchesFilters(event, {
          query,
          status: statusFilter,
          product: productFilter,
          year: ALL_FILTER,
        })
      )
        continue;
      total += 1;
      for (const year of eventYears(event))
        counts.set(year, (counts.get(year) ?? 0) + 1);
    }
    return { counts, total };
  }, [data.events, deferredSearch, productFilter, statusFilter]);

  const hasFilters =
    search.trim().length > 0 ||
    statusFilter !== ALL_FILTER ||
    productFilter !== ALL_FILTER ||
    yearFilter !== ALL_FILTER;

  function clearFilters() {
    setSearch('');
    setStatusFilter(ALL_FILTER);
    setProductFilter(ALL_FILTER);
    setYearFilter(ALL_FILTER);
  }

  function openEvent(id: string, edit = false) {
    setDetailId(id);
    setDetailMode(edit ? 'edit' : 'detail');
    const params = new URLSearchParams(window.location.search);
    params.set('evento', id);
    if (edit) params.set('modo', 'editar');
    else params.delete('modo');
    router.replace(`/eventos?${params.toString()}`, { scroll: false });
  }
  function closeDetail(open: boolean) {
    if (open) return;
    setDetailId(null);
    setDetailMode('detail');
    const params = new URLSearchParams(window.location.search);
    params.delete('evento');
    params.delete('modo');
    router.replace(params.size ? `/eventos?${params}` : '/eventos', {
      scroll: false,
    });
  }

  return (
    <div>
      <div className="border-b bg-card pb-4">
        <div className="flex flex-col gap-3 px-1 py-1 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="pta-tabs-scroll flex max-w-full items-center gap-1 overflow-x-auto"
            role="group"
            aria-label="Filtrar eventos por status"
          >
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={statusFilter === option.value}
                onClick={() => setStatusFilter(option.value)}
                className={cn(
                  'flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-[background-color,color,box-shadow] hover:bg-pta-blue/[0.08] hover:text-pta-blue',
                  statusFilter === option.value &&
                    'bg-pta-blue/[0.12] text-pta-blue shadow-[inset_0_0_0_1px_rgba(0,121,253,0.14)] hover:bg-pta-blue/[0.16]',
                )}
              >
                {option.label}
                <span
                  className={cn(
                    'text-xs tabular-nums text-muted-foreground',
                    statusFilter === option.value && 'text-pta-blue',
                  )}
                >
                  {statusCounts[option.value]}
                </span>
              </button>
            ))}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMode('calendar')}
              className="rounded-xl"
              aria-pressed={mode === 'calendar'}
            >
              <CalendarDays aria-hidden="true" />
              Calendário anual
            </Button>
            {canManage ? (
              <Button
                className="rounded-xl"
                onClick={() => setCreateOpen(true)}
              >
                <Plus aria-hidden="true" />
                Novo evento
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-3 rounded-xl bg-muted/35 p-2 2xl:flex-row 2xl:items-center 2xl:justify-between dark:bg-background/35">
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(220px,1fr)_auto_auto] 2xl:flex 2xl:flex-1 2xl:items-center">
            <div className="relative min-w-0 2xl:max-w-72 2xl:flex-1">
              <Search
                aria-hidden="true"
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar eventos"
                aria-label="Buscar eventos"
                className="rounded-xl bg-background pl-9 hover:border-pta-blue/30"
              />
            </div>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger
                className="w-full rounded-xl bg-background hover:border-pta-blue/30 sm:w-52"
                aria-label="Filtrar eventos por produto"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value={ALL_FILTER}>
                  Todos os produtos ({productFacet.total})
                </SelectItem>
                {productOptions.map((product) => (
                  <SelectItem key={product} value={product}>
                    {product} ({productFacet.counts.get(product) ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger
                className="w-full rounded-xl bg-background hover:border-pta-blue/30 sm:w-36"
                aria-label="Filtrar eventos por ano"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value={ALL_FILTER}>
                  Todos os anos ({yearFacet.total})
                </SelectItem>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year} ({yearFacet.counts.get(year) ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-self-start text-muted-foreground hover:bg-pta-blue/[0.07] hover:text-pta-blue"
                onClick={clearFilters}
              >
                Limpar filtros
              </Button>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between 2xl:justify-end">
            <div
              className="pta-tabs-scroll flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-background/80 p-1 shadow-sm"
              role="group"
              aria-label="Modo de visualização"
            >
              {MODE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={cn(
                    'shrink-0 rounded-lg hover:bg-pta-blue/[0.08] hover:text-pta-blue',
                    mode === option.value &&
                      'bg-pta-blue/[0.10] text-pta-blue ring-1 ring-inset ring-pta-blue/15 hover:bg-pta-blue/[0.14]',
                  )}
                  aria-pressed={mode === option.value}
                  onClick={() => setMode(option.value)}
                >
                  <option.icon aria-hidden="true" />
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p
        className="mt-4 text-[13px] text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {filtered.length}{' '}
        {filtered.length === 1 ? 'evento encontrado' : 'eventos encontrados'}
      </p>

      <section className="pb-8 pt-5">
        {!filtered.length ? (
          <EmptyEvents
            hasFilters={hasFilters}
            canManage={canManage}
            onClear={clearFilters}
            onCreate={() => setCreateOpen(true)}
          />
        ) : mode === 'gallery' ? (
          <div className="space-y-6">
            <EventGallery
              events={filtered}
              today={data.today}
              openEvent={openEvent}
            />
            <EventRoadmap events={filtered} openEvent={openEvent} />
          </div>
        ) : mode === 'list' ? (
          <EventList events={filtered} openEvent={openEvent} />
        ) : mode === 'calendar' ? (
          <EventCalendar events={filtered} openEvent={openEvent} />
        ) : (
          <EventTimeline events={filtered} openEvent={openEvent} />
        )}
      </section>
      <EventDetailSheet
        open={Boolean(detailId)}
        onOpenChange={closeDetail}
        eventId={detailId}
        workspaceId={workspaceId}
        members={members}
        products={products}
        taskPrefix={taskPrefix}
        initialEdit={detailMode === 'edit'}
        onSaved={(id) => openEvent(id)}
      />
      <EventEditorDialog
        key={createOpen ? 'event-create-open' : 'event-create-closed'}
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspaceId}
        members={members}
        products={products}
        onSaved={(id) => openEvent(id)}
      />
    </div>
  );
}

function EventGallery({
  events,
  today,
  openEvent,
}: {
  events: EventSummary[];
  today: string;
  openEvent: (id: string) => void;
}) {
  return (
    <ul className="grid gap-6 lg:grid-cols-2 [&>li:only-child]:lg:col-span-2">
      {events.map((event, index) => (
        <li key={event.id} className="min-w-0">
          <button
            type="button"
            onClick={() => openEvent(event.id)}
            aria-label={`Abrir evento ${event.name}`}
            className="group flex h-full min-h-[340px] w-full flex-col overflow-hidden rounded-2xl border bg-card text-left  transition-[border-color,background-color,box-shadow,transform] duration-200  hover:border-pta-blue/45 hover:bg-pta-blue/[0.02]  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div
              className={cn(
                'relative flex min-h-32 w-full flex-col justify-between overflow-hidden border-b px-6 py-5 text-foreground',
                eventBannerTone(index),
              )}
            >
              <div className="relative flex items-start justify-between gap-4">
                <span className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {event.productName ?? 'Sem produto'}
                </span>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  {formatRange(event.startDate, event.endDate)}
                </span>
              </div>
              <div className="relative mt-8 flex items-end justify-between gap-5">
                <h3 className="max-w-[72%] text-[1.5rem] font-semibold leading-[1.15] tracking-[-0.045em] [overflow-wrap:anywhere] sm:text-[1.75rem]">
                  {event.name}
                </h3>
                <StatusBadge
                  status={event.status}
                  className="shrink-0 border-border bg-card text-foreground"
                />
              </div>
            </div>

            <div className="flex w-full flex-1 flex-col p-6">
              <p className="line-clamp-2 min-h-12 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                {event.summary || 'Sem resumo cadastrado.'}
              </p>

              <div className="mt-5 grid w-full grid-cols-3 gap-2">
                <SmallStat
                  label="Progresso"
                  value={
                    event.progress === null
                      ? 'Sem demandas'
                      : `${event.progress}%`
                  }
                />
                <SmallStat
                  label="Concluídas"
                  value={`${event.doneTasks} / ${event.totalTasks}`}
                />
                <SmallStat
                  label="Faltam"
                  value={remainingDaysLabel(event.endDate, today)}
                />
              </div>

              {event.progress === null ? null : (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Andamento das demandas</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {event.progress}%
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label={`Progresso de ${event.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={event.progress}
                  >
                    <span
                      className="block h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${event.progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-auto flex w-full min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/35 p-3.5 dark:bg-background/40">
                <div className="flex min-w-0 items-center gap-2.5">
                  <OwnerMark name={event.ownerName} />
                  <span className="min-w-0">
                    <span className="block text-[11px] text-muted-foreground">
                      Responsável
                    </span>
                    <span className="block truncate text-sm font-medium">
                      {event.ownerName ?? 'Sem responsável'}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs text-muted-foreground">
                    {teamSizeLabel(event.teamCount)}
                  </span>
                  <HealthBadge health={event.health} />
                </div>
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
function EventList({
  events,
  openEvent,
}: {
  events: EventSummary[];
  openEvent: (id: string) => void;
}) {
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card ">
      {events.map((event) => (
        <li key={event.id}>
          <button
            type="button"
            onClick={() => openEvent(event.id)}
            aria-label={`Abrir evento ${event.name}`}
            className="group grid min-h-20 w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-pta-blue/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-8 sm:px-6"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold transition-colors group-hover:text-pta-blue">
                {event.name}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {event.productName ?? 'Sem produto'} ·{' '}
                {event.ownerName ?? 'Sem responsável'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={event.status} />
              <HealthBadge health={event.health} />
            </div>
            <div className="text-xs text-muted-foreground sm:text-right">
              <p>{formatRange(event.startDate, event.endDate)}</p>
              <p className="mt-1 font-semibold text-foreground tabular-nums">
                {event.progress === null
                  ? 'Sem demandas'
                  : `${event.progress}%`}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
function EventCalendar({
  events,
  openEvent,
}: {
  events: EventSummary[];
  openEvent: (id: string) => void;
}) {
  const groups = new Map<string, EventSummary[]>();
  for (const event of events) {
    const key = event.startDate?.slice(0, 7) ?? 'sem-data';
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return (
    <div className="space-y-8">
      {[...groups].map(([key, items]) => (
        <section
          key={key}
          className="grid gap-4 rounded-2xl border bg-card p-5  md:grid-cols-[180px_1fr] sm:p-6"
        >
          <h3 className="text-sm font-semibold">
            {key === 'sem-data'
              ? 'Sem data definida'
              : new Intl.DateTimeFormat('pt-BR', {
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                }).format(new Date(`${key}-15T12:00:00Z`))}
          </h3>
          <ul className="divide-y overflow-hidden rounded-xl bg-muted/30 dark:bg-background/35">
            {items.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => openEvent(event.id)}
                  aria-label={`Abrir evento ${event.name}`}
                  className="group flex min-h-16 w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-pta-blue/[0.065] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div>
                    <p className="font-medium transition-colors group-hover:text-pta-blue">
                      {event.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatRange(event.startDate, event.endDate)}
                    </p>
                  </div>
                  <HealthBadge health={event.health} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
function EventTimeline({
  events,
  openEvent,
}: {
  events: EventSummary[];
  openEvent: (id: string) => void;
}) {
  return (
    <ol className="relative rounded-2xl border bg-card py-6 pl-10 pr-5  before:absolute before:bottom-6 before:left-4 before:top-6 before:w-px before:bg-border before:content-[''] sm:pr-6">
      {events.map((event) => (
        <li
          key={event.id}
          className="relative pb-8 last:pb-0 before:absolute before:-left-[29px] before:top-1.5 before:size-2.5 before:rounded-full before:bg-primary"
        >
          <button
            type="button"
            onClick={() => openEvent(event.id)}
            aria-label={`Abrir evento ${event.name}`}
            className="group w-full rounded-md px-2 py-1 text-left transition-colors hover:bg-pta-blue/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="text-xs font-medium text-muted-foreground">
              {formatRange(event.startDate, event.endDate)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h3 className="font-semibold transition-colors group-hover:text-pta-blue">
                {event.name}
              </h3>
              <HealthBadge health={event.health} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {event.doneTasks} de {event.totalTasks} demandas concluídas
            </p>
          </button>
        </li>
      ))}
    </ol>
  );
}

function EventRoadmap({
  events,
  openEvent,
}: {
  events: EventSummary[];
  openEvent: (id: string) => void;
}) {
  const scheduled = events
    .filter((event) => event.startDate)
    .sort((left, right) =>
      (left.startDate ?? '').localeCompare(right.startDate ?? ''),
    );
  if (!scheduled.length) return null;

  const months = new Map<string, EventSummary[]>();
  for (const event of scheduled) {
    const key = event.startDate?.slice(0, 7);
    if (!key) continue;
    months.set(key, [...(months.get(key) ?? []), event]);
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-card p-5  sm:p-6">
      <div>
        <p className="pta-eyebrow">Roadmap</p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em]">
          Visão dos próximos meses
        </h2>
      </div>
      <div className="pta-tabs-scroll mt-5 overflow-x-auto pb-1">
        <div className="grid min-w-[720px] grid-flow-col auto-cols-fr gap-2">
          {[...months].slice(0, 6).map(([month, items], monthIndex) => (
            <div
              key={month}
              className="min-w-0 rounded-xl bg-muted/35 p-3 dark:bg-background/35"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {new Intl.DateTimeFormat('pt-BR', {
                  month: 'short',
                  year: 'numeric',
                  timeZone: 'UTC',
                }).format(new Date(`${month}-15T12:00:00Z`))}
              </p>
              <div className="mt-3 space-y-2">
                {items.slice(0, 3).map((event, eventIndex) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => openEvent(event.id)}
                    aria-label={`Abrir evento ${event.name}`}
                    className={cn(
                      'block w-full truncate rounded-lg border-l-2 bg-background px-3 py-2 text-left text-xs font-medium shadow-sm transition-[background-color,color,transform] hover:-translate-y-px hover:bg-pta-blue/[0.07] hover:text-pta-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      roadmapAccent(monthIndex + eventIndex),
                    )}
                  >
                    {event.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
function SmallStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/40 px-3 py-3 dark:bg-background/35">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <strong className="mt-1 block text-base tabular-nums">{value}</strong>
    </div>
  );
}

function eventBannerTone(index: number) {
  return ['bg-muted', 'bg-accent/50', 'bg-secondary/65'][index % 3];
}

function roadmapAccent(index: number) {
  return [
    'border-l-pta-blue',
    'border-l-sky-400',
    'border-l-indigo-400',
    'border-l-cyan-400',
  ][index % 4];
}
function StatusBadge({
  status,
  className,
}: {
  status: EventSummary['status'];
  className?: string;
}) {
  const config = {
    planning: [
      'Planejamento',
      'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/55 dark:text-blue-200',
    ],
    active: [
      'Em curso',
      'border-pta-blue/25 bg-pta-blue/10 text-pta-blue dark:bg-pta-blue/20',
    ],
    completed: ['Concluído', 'border-border bg-muted text-muted-foreground'],
    cancelled: [
      'Cancelado',
      'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/55 dark:text-red-200',
    ],
  } as const;
  return (
    <Badge variant="outline" className={cn(config[status][1], className)}>
      {config[status][0]}
    </Badge>
  );
}
function HealthBadge({ health }: { health: EventSummary['health'] }) {
  const config = {
    healthy: [
      'Saudável',
      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
    ],
    attention: [
      'Atenção',
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
    ],
    risk: [
      'Risco',
      'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200',
    ],
  } as const;
  return (
    <Badge variant="outline" className={config[health][1]}>
      {health === 'risk' ? <AlertTriangle aria-hidden="true" /> : null}
      {config[health][0]}
    </Badge>
  );
}
function EmptyEvents({
  hasFilters,
  canManage,
  onClear,
  onCreate,
}: {
  hasFilters: boolean;
  canManage: boolean;
  onClear: () => void;
  onCreate: () => void;
}) {
  const title = hasFilters
    ? 'Nenhum evento corresponde aos filtros'
    : canManage
      ? 'Crie o primeiro evento'
      : 'Nenhum evento cadastrado';
  const description = hasFilters
    ? 'Ajuste a busca, o status, o produto ou o ano para ampliar os resultados.'
    : canManage
      ? 'Defina datas, responsável e produto. Depois, vincule as demandas.'
      : 'Os eventos criados pela equipe aparecerão aqui.';

  return (
    <div className="rounded-2xl border bg-card px-6 py-14  sm:px-8 sm:py-16">
      <div className="max-w-lg">
        <div className="grid size-11 place-items-center rounded-xl bg-pta-blue/10 text-pta-blue ring-1 ring-pta-blue/15">
          <CalendarDays aria-hidden="true" className="size-5" />
        </div>
        <h3 className="mt-5 text-lg font-semibold leading-6">{title}</h3>
        <p className="mt-2 text-[15px] leading-[23px] text-muted-foreground">
          {description}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {hasFilters ? (
            <Button variant="outline" onClick={onClear}>
              Limpar filtros
            </Button>
          ) : canManage ? (
            <Button onClick={onCreate}>
              <Plus aria-hidden="true" />
              Novo evento
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        timeZone: 'UTC',
      }).format(new Date(`${value}T12:00:00Z`))
    : 'Não definida';
}
function formatRange(start: string | null, end: string | null) {
  if (!start && !end) return 'Período não definido';
  if (start && end)
    return start === end
      ? formatDate(start)
      : `${formatDate(start)} a ${formatDate(end)}`;
  return start ? `A partir de ${formatDate(start)}` : `Até ${formatDate(end)}`;
}

function OwnerMark({ name }: { name: string | null }) {
  const initials = name
    ? name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
    : '?';
  return (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center rounded-full bg-pta-blue/[0.10] text-[11px] font-semibold uppercase text-pta-blue ring-1 ring-pta-blue/15"
    >
      {initials}
    </span>
  );
}

function teamSizeLabel(value: number) {
  if (value === 0) return 'Sem equipe';
  return value === 1 ? '1 pessoa' : `${value} pessoas`;
}

function remainingDaysLabel(endDate: string | null, today: string) {
  if (!endDate) return 'Sem data';
  const endDay = dateKeyToDayIndex(endDate);
  const currentDay = dateKeyToDayIndex(today);
  if (endDay === null || currentDay === null) return 'Sem data';
  const difference = endDay - currentDay;
  if (difference < 0) return 'Encerrado';
  if (difference === 0) return 'Hoje';
  return difference === 1 ? '1 dia' : `${difference} dias`;
}

function dateKeyToDayIndex(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const adjustedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * adjustedMonth + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear;
  return era * 146097 + dayOfEra;
}

function eventYears(event: EventSummary) {
  const startYear = yearFromDateKey(event.startDate);
  const endYear = yearFromDateKey(event.endDate);
  if (startYear === null && endYear === null) return [];
  const first = startYear ?? endYear!;
  const last = endYear ?? startYear!;
  if (last < first || last - first > 50)
    return [...new Set([String(first), String(last)])];
  return Array.from({ length: last - first + 1 }, (_, index) =>
    String(first + index),
  );
}

function yearFromDateKey(value: string | null) {
  const year = value?.match(/^(\d{4})-/)?.[1];
  return year ? Number(year) : null;
}

function eventMatchesFilters(
  event: EventSummary,
  filters: {
    query: string;
    status: StatusFilter;
    product: string;
    year: string;
  },
) {
  if (
    filters.query &&
    ![event.name, event.productName, event.ownerName, event.summary]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase('pt-BR').includes(filters.query))
  )
    return false;
  if (filters.status !== ALL_FILTER && event.status !== filters.status)
    return false;
  if (filters.product !== ALL_FILTER && event.productName !== filters.product)
    return false;
  if (filters.year !== ALL_FILTER && !eventYears(event).includes(filters.year))
    return false;
  return true;
}
