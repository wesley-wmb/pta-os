'use client';

import {
  AlertTriangle,
  ArrowRight,
  Box,
  CalendarRange,
  CheckCircle2,
  LayoutGrid,
  Link2,
  List,
  ListTodo,
  Plus,
  Search,
  Table2,
  Users,
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

import { ProductDetailSheet } from './portfolio-detail-sheet';
import { ProductEditorDialog } from './portfolio-editor-dialog';
import type { ProductsPageData, ProductSummary } from './types';

type ProductMode = 'gallery' | 'list' | 'table';
type StatusFilter = 'all' | ProductSummary['status'];
type HealthFilter = 'all' | ProductSummary['health'];

const ALL_FILTER = 'all';

const MODE_OPTIONS: Array<{
  value: ProductMode;
  label: string;
  icon: typeof LayoutGrid;
}> = [
  { value: 'gallery', label: 'Galeria', icon: LayoutGrid },
  { value: 'list', label: 'Lista', icon: List },
  { value: 'table', label: 'Tabela', icon: Table2 },
];

const STATUS_OPTIONS: Array<{
  value: StatusFilter;
  label: string;
}> = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Ativos' },
  { value: 'planning', label: 'Planejamento' },
  { value: 'paused', label: 'Pausados' },
  { value: 'completed', label: 'Concluídos' },
];

const HEALTH_OPTIONS: Array<{
  value: HealthFilter;
  label: string;
}> = [
  { value: 'all', label: 'Toda saúde' },
  { value: 'healthy', label: 'Saudáveis' },
  { value: 'attention', label: 'Com atenção' },
  { value: 'risk', label: 'Em risco' },
];

export function ProductsView({
  data,
  workspaceId,
  members,
  taskPrefix,
  canManage,
  selectedProductId = null,
  initialMode = 'detail',
}: {
  data: ProductsPageData;
  workspaceId: string;
  members: WorkspaceMember[];
  taskPrefix: string;
  canManage: boolean;
  selectedProductId?: string | null;
  initialMode?: 'detail' | 'edit';
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ProductMode>('gallery');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(ALL_FILTER);
  const [healthFilter, setHealthFilter] = useState<HealthFilter>(ALL_FILTER);
  const [detailId, setDetailId] = useState<string | null>(selectedProductId);
  const [detailMode, setDetailMode] = useState(initialMode);
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase('pt-BR');
    return data.products.filter((product) =>
      productMatchesFilters(product, {
        query,
        status: statusFilter,
        health: healthFilter,
      }),
    );
  }, [data.products, deferredSearch, healthFilter, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: 0,
      active: 0,
      planning: 0,
      paused: 0,
      completed: 0,
    };
    const query = deferredSearch.trim().toLocaleLowerCase('pt-BR');
    for (const product of data.products) {
      if (
        !productMatchesFilters(product, {
          query,
          status: ALL_FILTER,
          health: healthFilter,
        })
      )
        continue;
      counts.all += 1;
      counts[product.status] += 1;
    }
    return counts;
  }, [data.products, deferredSearch, healthFilter]);

  const healthCounts = useMemo(() => {
    const counts: Record<HealthFilter, number> = {
      all: 0,
      healthy: 0,
      attention: 0,
      risk: 0,
    };
    const query = deferredSearch.trim().toLocaleLowerCase('pt-BR');
    for (const product of data.products) {
      if (
        !productMatchesFilters(product, {
          query,
          status: statusFilter,
          health: ALL_FILTER,
        })
      )
        continue;
      counts.all += 1;
      counts[product.health] += 1;
    }
    return counts;
  }, [data.products, deferredSearch, statusFilter]);

  const hasFilters =
    search.trim().length > 0 ||
    statusFilter !== ALL_FILTER ||
    healthFilter !== ALL_FILTER;
  const portfolioSummary = useMemo(
    () => ({
      active: data.products.filter((product) => product.status === 'active')
        .length,
      events: data.products.reduce(
        (total, product) => total + product.eventCount,
        0,
      ),
      openTasks: data.products.reduce(
        (total, product) => total + product.openTaskCount,
        0,
      ),
      resources: data.products.reduce(
        (total, product) => total + product.resourceCount,
        0,
      ),
    }),
    [data.products],
  );

  function clearFilters() {
    setSearch('');
    setStatusFilter(ALL_FILTER);
    setHealthFilter(ALL_FILTER);
  }

  function openProduct(id: string, edit = false) {
    setDetailId(id);
    setDetailMode(edit ? 'edit' : 'detail');
    const params = new URLSearchParams(window.location.search);
    params.set('produto', id);
    if (edit) params.set('modo', 'editar');
    else params.delete('modo');
    router.replace(`/produtos?${params.toString()}`, { scroll: false });
  }

  function closeDetail(open: boolean) {
    if (open) return;
    setDetailId(null);
    setDetailMode('detail');
    const params = new URLSearchParams(window.location.search);
    params.delete('produto');
    params.delete('modo');
    router.replace(params.size ? `/produtos?${params}` : '/produtos', {
      scroll: false,
    });
  }

  return (
    <div>
      <ProductSummaryStrip summary={portfolioSummary} />
      <div className="border-b bg-card pb-4">
        <div className="flex flex-col gap-3 px-1 py-1 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="pta-tabs-scroll flex max-w-full items-center gap-1 overflow-x-auto"
            role="group"
            aria-label="Filtrar produtos por status"
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
          {canManage ? (
            <Button
              className="shrink-0 self-start rounded-xl"
              onClick={() => setCreateOpen(true)}
            >
              <Plus aria-hidden="true" />
              Novo produto
            </Button>
          ) : null}
        </div>

        <div className="mt-2 flex flex-col gap-3 rounded-xl bg-muted/35 p-2 xl:flex-row xl:items-center xl:justify-between dark:bg-background/35">
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(220px,1fr)_auto_auto] xl:flex xl:flex-1 xl:items-center">
            <div className="relative min-w-0 xl:max-w-72 xl:flex-1">
              <Search
                aria-hidden="true"
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar produtos"
                aria-label="Buscar produtos"
                className="rounded-xl bg-background pl-9 hover:border-pta-blue/30"
              />
            </div>
            <Select
              value={healthFilter}
              onValueChange={(value) => setHealthFilter(value as HealthFilter)}
            >
              <SelectTrigger
                className="w-full rounded-xl bg-background hover:border-pta-blue/30 sm:w-52"
                aria-label="Filtrar produtos por saúde"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {HEALTH_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} ({healthCounts[option.value]})
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

          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:justify-end">
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
        {filtered.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
      </p>

      <section className="pb-8 pt-5">
        {!filtered.length ? (
          <EmptyProducts
            hasFilters={hasFilters}
            canManage={canManage}
            onClear={clearFilters}
            onCreate={() => setCreateOpen(true)}
          />
        ) : mode === 'gallery' ? (
          <ProductGallery products={filtered} openProduct={openProduct} />
        ) : mode === 'list' ? (
          <ProductList products={filtered} openProduct={openProduct} />
        ) : (
          <ProductTable products={filtered} openProduct={openProduct} />
        )}
      </section>

      <ProductDetailSheet
        open={Boolean(detailId)}
        onOpenChange={closeDetail}
        productId={detailId}
        workspaceId={workspaceId}
        members={members}
        taskPrefix={taskPrefix}
        initialEdit={detailMode === 'edit'}
        onSaved={(id) => openProduct(id)}
      />
      <ProductEditorDialog
        key={createOpen ? 'product-create-open' : 'product-create-closed'}
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspaceId}
        members={members}
        onSaved={(id) => openProduct(id)}
      />
    </div>
  );
}

function ProductSummaryStrip({
  summary,
}: {
  summary: {
    active: number;
    events: number;
    openTasks: number;
    resources: number;
  };
}) {
  const metrics = [
    {
      label: 'Produtos ativos',
      value: summary.active,
      detail: 'em operação',
      icon: CheckCircle2,
    },
    {
      label: 'Projetos',
      value: summary.events,
      detail: 'ligados ao portfólio',
      icon: CalendarRange,
    },
    {
      label: 'Demandas abertas',
      value: summary.openTasks,
      detail: 'em todos os produtos',
      icon: ListTodo,
    },
    {
      label: 'Recursos',
      value: summary.resources,
      detail: 'links conectados',
      icon: Link2,
    },
  ];

  return (
    <section
      className="mb-6 grid overflow-hidden border-y bg-card  sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Resumo do portfólio"
    >
      {metrics.map((metric) => (
        <article
          key={metric.label}
          className="flex min-h-28 items-center gap-4 border-b p-5 last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-pta-blue/[0.09] text-pta-blue">
            <metric.icon aria-hidden="true" className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-muted-foreground">
              {metric.label}
            </span>
            <strong className="mt-1 block text-3xl font-semibold tracking-[-0.04em] tabular-nums">
              {metric.value}
            </strong>
            <span className="block text-xs text-muted-foreground">
              {metric.detail}
            </span>
          </span>
        </article>
      ))}
    </section>
  );
}

function ProductGallery({
  products,
  openProduct,
}: {
  products: ProductSummary[];
  openProduct: (id: string) => void;
}) {
  return (
    <ul className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
      {products.map((product, index) => {
        const progress = taskProgress(product);
        return (
          <li key={product.id} className="min-w-0">
            <button
              type="button"
              onClick={() => openProduct(product.id)}
              aria-label={`Abrir produto ${product.name}`}
              className="group flex h-full min-h-[340px] w-full flex-col overflow-hidden rounded-2xl border bg-card text-left  transition-[border-color,background-color,box-shadow,transform] duration-200  hover:border-pta-blue/45 hover:bg-pta-blue/[0.02]  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div
                className={cn(
                  'relative flex min-h-24 w-full items-end justify-between overflow-hidden border-b px-6 py-5 text-foreground',
                  productBannerTone(index),
                )}
              >
                <span
                  aria-hidden="true"
                  className="relative text-3xl font-semibold uppercase leading-none tracking-[-0.06em] text-foreground"
                >
                  {productMonogram(product.name)}
                </span>
                <StatusBadge
                  status={product.status}
                  className="relative shrink-0 border-border bg-card text-foreground"
                />
              </div>

              <div className="flex w-full flex-1 flex-col p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      Produto
                    </p>
                    <h3 className="mt-1 text-xl font-semibold leading-tight tracking-[-0.035em] [overflow-wrap:anywhere] group-hover:text-primary">
                      {product.name}
                    </h3>
                  </div>
                  <HealthBadge health={product.health} />
                </div>

                <p className="mt-3 line-clamp-2 min-h-12 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                  {product.description || 'Sem descrição cadastrada.'}
                </p>

                <div className="mt-5 grid w-full grid-cols-3 gap-2">
                  <SmallStat label="Projetos" value={product.eventCount} />
                  <SmallStat label="Abertas" value={product.openTaskCount} />
                  <SmallStat label="Recursos" value={product.resourceCount} />
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between gap-4 text-xs text-muted-foreground">
                    <span>Progresso das demandas</span>
                    <span className="shrink-0 font-medium tabular-nums text-foreground">
                      {progress === null
                        ? 'Sem demandas'
                        : `${progress.done} de ${product.totalTaskCount}`}
                    </span>
                  </div>
                  <TaskProgress product={product} />
                </div>

                <div className="mt-auto flex w-full min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/35 p-3.5 dark:bg-background/40">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <OwnerMark name={product.ownerName} />
                    <span className="min-w-0">
                      <span className="block text-xs text-muted-foreground">
                        Responsável
                      </span>
                      <span className="block truncate text-sm font-medium">
                        {product.ownerName ?? 'Sem responsável'}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Users aria-hidden="true" className="size-3.5" />
                      {teamSizeLabel(product.teamCount)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                      Abrir
                      <ArrowRight
                        aria-hidden="true"
                        className="size-3.5 transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                  </div>
                </div>

                {product.overdueTaskCount > 0 ? (
                  <div className="mt-3 flex items-center gap-2 text-xs font-medium text-destructive">
                    <AlertTriangle aria-hidden="true" className="size-3.5" />
                    {overdueLabel(product.overdueTaskCount)}
                  </div>
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ProductList({
  products,
  openProduct,
}: {
  products: ProductSummary[];
  openProduct: (id: string) => void;
}) {
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card ">
      {products.map((product) => {
        const progress = taskProgress(product);
        return (
          <li key={product.id}>
            <button
              type="button"
              onClick={() => openProduct(product.id)}
              aria-label={`Abrir produto ${product.name}`}
              className="group grid min-h-24 w-full gap-4 px-5 py-4 text-left transition-colors hover:bg-pta-blue/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:grid-cols-[minmax(0,1.4fr)_minmax(150px,.7fr)_minmax(180px,.9fr)_auto] lg:items-center lg:gap-8 lg:px-6"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-lg bg-pta-brand-deep text-sm font-semibold uppercase text-white"
                >
                  {productMonogram(product.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold transition-colors group-hover:text-pta-blue">
                    {product.name}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {product.description || 'Sem descrição cadastrada.'}
                  </span>
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-2.5">
                <OwnerMark name={product.ownerName} />
                <span className="truncate text-sm">
                  {product.ownerName ?? 'Sem responsável'}
                </span>
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Demandas</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {progress === null ? 'Sem dados' : `${progress.percent}%`}
                  </span>
                </div>
                <TaskProgress product={product} />
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <StatusBadge status={product.status} />
                <HealthBadge health={product.health} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground lg:col-start-3 lg:col-end-5 lg:justify-end">
                <span>{eventLabel(product.eventCount)}</span>
                <span>{openTaskLabel(product.openTaskCount)}</span>
                {product.overdueTaskCount > 0 ? (
                  <span className="font-medium text-destructive">
                    {overdueLabel(product.overdueTaskCount)}
                  </span>
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ProductTable({
  products,
  openProduct,
}: {
  products: ProductSummary[];
  openProduct: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card ">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[940px] border-collapse text-sm">
          <thead className="bg-muted/35">
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-5 py-3 font-medium">Produto</th>
              <th className="px-4 py-3 font-medium">Responsável</th>
              <th className="px-4 py-3 font-medium">Progresso</th>
              <th className="px-4 py-3 text-right font-medium">Projetos</th>
              <th className="px-4 py-3 text-right font-medium">Abertas</th>
              <th className="px-5 py-3 text-right font-medium">Saúde</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const progress = taskProgress(product);
              return (
                <tr
                  key={product.id}
                  className="group border-b transition-colors last:border-b-0 hover:bg-pta-blue/[0.045]"
                >
                  <td className="p-0">
                    <button
                      type="button"
                      onClick={() => openProduct(product.id)}
                      aria-label={`Abrir produto ${product.name}`}
                      className="flex w-full items-center gap-3 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span
                        aria-hidden="true"
                        className="grid size-9 shrink-0 place-items-center rounded-md bg-pta-brand-deep text-xs font-semibold uppercase text-white"
                      >
                        {productMonogram(product.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold transition-colors group-hover:text-pta-blue">
                          {product.name}
                        </span>
                        <span className="mt-1 block">
                          <StatusBadge status={product.status} />
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <OwnerMark name={product.ownerName} />
                      <span className="truncate">
                        {product.ownerName ?? 'Sem responsável'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="w-40">
                      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {progress === null
                            ? 'Sem demandas'
                            : `${progress.done} de ${product.totalTaskCount}`}
                        </span>
                        {progress === null ? null : (
                          <span className="font-medium tabular-nums text-foreground">
                            {progress.percent}%
                          </span>
                        )}
                      </div>
                      <TaskProgress product={product} />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums">
                    <span className="font-medium">{product.eventCount}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {product.upcomingEventCount} próximos
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums">
                    <span className="font-medium">{product.openTaskCount}</span>
                    {product.overdueTaskCount > 0 ? (
                      <span className="mt-1 block text-xs font-medium text-destructive">
                        {product.overdueTaskCount} atrasadas
                      </span>
                    ) : (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        nenhuma atrasada
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <HealthBadge health={product.health} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/40 px-3 py-3 dark:bg-background/35">
      <span className="block truncate text-xs text-muted-foreground">
        {label}
      </span>
      <strong className="mt-1 block text-base tabular-nums">{value}</strong>
    </div>
  );
}

function productBannerTone(index: number) {
  return ['bg-muted', 'bg-accent/50', 'bg-secondary/65'][index % 3];
}

function StatusBadge({
  status,
  className,
}: {
  status: ProductSummary['status'];
  className?: string;
}) {
  const config = {
    planning: [
      'Planejamento',
      'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/55 dark:text-blue-200',
    ],
    active: [
      'Ativo',
      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/55 dark:text-emerald-200',
    ],
    paused: [
      'Pausado',
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/55 dark:text-amber-200',
    ],
    completed: ['Concluído', 'border-border bg-muted text-muted-foreground'],
  } as const;
  return (
    <Badge variant="outline" className={cn(config[status][1], className)}>
      {config[status][0]}
    </Badge>
  );
}

function HealthBadge({ health }: { health: ProductSummary['health'] }) {
  const config = {
    healthy: [
      'Saudável',
      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/55 dark:text-emerald-200',
    ],
    attention: [
      'Atenção',
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/55 dark:text-amber-200',
    ],
    risk: [
      'Risco',
      'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/55 dark:text-red-200',
    ],
  } as const;
  return (
    <Badge variant="outline" className={config[health][1]}>
      {health === 'risk' ? <AlertTriangle aria-hidden="true" /> : null}
      {health === 'healthy' ? <CheckCircle2 aria-hidden="true" /> : null}
      {config[health][0]}
    </Badge>
  );
}

function TaskProgress({ product }: { product: ProductSummary }) {
  const progress = taskProgress(product);
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-muted"
      role={progress === null ? undefined : 'progressbar'}
      aria-label={
        progress === null
          ? undefined
          : `Progresso das demandas de ${product.name}`
      }
      aria-valuemin={progress === null ? undefined : 0}
      aria-valuemax={progress === null ? undefined : 100}
      aria-valuenow={progress?.percent}
    >
      {progress === null ? null : (
        <span
          className="block h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${progress.percent}%` }}
        />
      )}
    </div>
  );
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
      className="grid size-8 shrink-0 place-items-center rounded-full bg-pta-blue/[0.10] text-xs font-semibold uppercase text-pta-blue ring-1 ring-pta-blue/15"
    >
      {initials}
    </span>
  );
}

function EmptyProducts({
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
    ? 'Nenhum produto corresponde aos filtros'
    : canManage
      ? 'Crie o primeiro produto'
      : 'Nenhum produto cadastrado';
  const description = hasFilters
    ? 'Ajuste a busca, o status ou a saúde da operação.'
    : canManage
      ? 'Organize responsáveis, projetos e tarefas em um só lugar.'
      : 'Os produtos criados pela equipe aparecerão aqui.';

  return (
    <div className="rounded-2xl border bg-card px-6 py-14  sm:px-8 sm:py-16">
      <div className="max-w-lg">
        <div className="grid size-11 place-items-center rounded-xl bg-pta-blue/10 text-pta-blue ring-1 ring-pta-blue/15">
          <Box aria-hidden="true" className="size-5" />
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
              Novo produto
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function productMatchesFilters(
  product: ProductSummary,
  filters: {
    query: string;
    status: StatusFilter;
    health: HealthFilter;
  },
) {
  if (
    filters.query &&
    ![product.name, product.ownerName, product.description]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase('pt-BR').includes(filters.query))
  )
    return false;
  if (filters.status !== ALL_FILTER && product.status !== filters.status)
    return false;
  if (filters.health !== ALL_FILTER && product.health !== filters.health)
    return false;
  return true;
}

function taskProgress(product: ProductSummary) {
  if (product.totalTaskCount === 0) return null;
  const done = Math.max(
    0,
    Math.min(
      product.totalTaskCount,
      product.totalTaskCount - product.openTaskCount,
    ),
  );
  return {
    done,
    percent: Math.round((done / product.totalTaskCount) * 100),
  };
}

function productMonogram(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
  return initials || 'P';
}

function teamSizeLabel(value: number) {
  if (value === 0) return 'sem equipe';
  return value === 1 ? '1 pessoa' : `${value} pessoas`;
}

function eventLabel(value: number) {
  return value === 1 ? '1 projeto' : `${value} projetos`;
}

function openTaskLabel(value: number) {
  return value === 1 ? '1 demanda aberta' : `${value} demandas abertas`;
}

function overdueLabel(value: number) {
  return value === 1 ? '1 demanda atrasada' : `${value} demandas atrasadas`;
}
