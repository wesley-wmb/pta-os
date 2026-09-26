'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowUpRight,
  ChartNoAxesColumn,
  Clock3,
  FileText,
  Folder,
  Grid2X2,
  LayoutTemplate,
  Link2,
  ListTree,
  LoaderCircle,
  LockKeyhole,
  Monitor,
  MoreHorizontal,
  Palette,
  Plus,
  Search,
  Star,
  Video,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useMemo, useState } from 'react';
import { z } from 'zod';

import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

import { resourceKeys, useResources } from './queries';
import { ResourceCategoriesDialog } from './resource-categories-dialog';
import { resourceDetailPayloadSchema } from './schemas';
import { ResourceEditorDialog } from './resource-editor-dialog';
import type {
  ResourceFilters,
  ResourceListItem,
  ResourcePermissionMember,
  ResourceType,
  ResourceViewMode,
} from './types';

const TYPE_PRESENTATION: Record<
  ResourceType,
  { label: string; icon: typeof Link2 }
> = {
  link: { label: 'Link', icon: Link2 },
  document: { label: 'Documento online', icon: FileText },
  folder: { label: 'Pasta', icon: Folder },
  system: { label: 'Sistema', icon: Monitor },
  dashboard: { label: 'Painel', icon: ChartNoAxesColumn },
  page: { label: 'Página', icon: LayoutTemplate },
  creative: { label: 'Criativo', icon: Palette },
  video: { label: 'Vídeo', icon: Video },
};

const VIEW_OPTIONS: Array<{ value: ResourceViewMode; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'favorites', label: 'Favoritos' },
  { value: 'recent', label: 'Recentes' },
];

const ALL_RESOURCE_FILTERS: ResourceFilters = {
  query: '',
  view: 'all',
  categoryId: 'all',
  resourceType: 'all',
};

const FAVORITE_FILTERS: ResourceFilters = {
  query: '',
  view: 'favorites',
  categoryId: 'all',
  resourceType: 'all',
};

const favoriteResultSchema = z.object({
  resource_id: z.uuid(),
  is_favorite: z.boolean(),
});

type ResourcesViewProps = {
  workspaceId: string;
  canCreate: boolean;
  canManageRestriction: boolean;
  initialResourceId: string | null;
  initialMode: 'detail' | 'edit';
  permissionMembers: ResourcePermissionMember[];
};

type ResourceDialogState =
  | { mode: 'create'; resourceId: null }
  | { mode: 'detail' | 'edit'; resourceId: string }
  | null;

export function ResourcesView({
  workspaceId,
  canCreate,
  canManageRestriction,
  initialResourceId,
  initialMode,
  permissionMembers,
}: ResourcesViewProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput);
  const [view, setView] = useState<ResourceViewMode>('all');
  const [categoryId, setCategoryId] = useState('all');
  const [resourceType, setResourceType] = useState<ResourceType | 'all'>('all');
  const [editor, setEditor] = useState<ResourceDialogState>(
    initialResourceId
      ? { mode: initialMode, resourceId: initialResourceId }
      : null,
  );
  const [archiveTarget, setArchiveTarget] = useState<ResourceListItem | null>(
    null,
  );
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const filters = useMemo<ResourceFilters>(
    () => ({
      query: deferredSearch,
      view,
      categoryId,
      resourceType,
    }),
    [categoryId, deferredSearch, resourceType, view],
  );
  const resourcesQuery = useResources(workspaceId, filters);
  const allResourcesQuery = useResources(workspaceId, ALL_RESOURCE_FILTERS);
  const favoritesQuery = useResources(workspaceId, FAVORITE_FILTERS);
  const categories =
    allResourcesQuery.data?.facets.categories ??
    resourcesQuery.data?.facets.categories ??
    [];
  const availableTypes =
    allResourcesQuery.data?.facets.resource_types ??
    resourcesQuery.data?.facets.resource_types ??
    [];
  const oneCharacterQuery = searchInput.trim().length === 1;
  const showFavorites =
    view === 'all' &&
    categoryId === 'all' &&
    resourceType === 'all' &&
    deferredSearch.trim().length === 0;
  const activeCategory = categories.find(
    (category) => category.id === categoryId,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Fonte única da verdade"
        title="Central de recursos"
        description="Links, documentos, ferramentas e acessos organizados para o time."
        width="wide"
        actions={
          canCreate ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setCategoriesOpen(true)}
              >
                <ListTree aria-hidden="true" />
                Categorias
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                onClick={openCreateDialog}
              >
                <Plus aria-hidden="true" />
                Novo recurso
              </Button>
            </div>
          ) : null
        }
      />

      <section
        className="mx-auto w-full max-w-[1500px] px-5 pb-12 sm:px-8"
        aria-label="Conteúdo de recursos"
      >
        <div className="border-b pb-6">
          <div className="relative max-w-3xl">
            <InputGroup className="h-12 rounded-xl border-input bg-muted text-foreground shadow-none transition-colors focus-within:border-primary focus-within:bg-card">
              <InputGroupAddon className="text-muted-foreground">
                {resourcesQuery.isFetching ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Search aria-hidden="true" />
                )}
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Busque por documento, sistema, página ou ferramenta"
                maxLength={100}
                aria-label="Buscar na central de recursos"
                className="text-[15px] text-foreground placeholder:text-muted-foreground"
              />
            </InputGroup>
            <p
              className="mt-3 text-sm text-muted-foreground"
              aria-live="polite"
            >
              {resourcesQuery.data
                ? `${resourcesQuery.data.total} ${resourcesQuery.data.total === 1 ? 'recurso disponível' : 'recursos disponíveis'} nesta visão.`
                : 'Carregando os recursos disponíveis.'}
            </p>
          </div>
        </div>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[248px_minmax(0,1fr)]">
          <aside className="hidden border-r bg-background pr-4  lg:sticky lg:top-5 lg:block">
            <h2 className="px-2 pb-2 pt-1 text-[15px] font-semibold">
              Categorias
            </h2>
            <nav aria-label="Filtrar recursos" className="space-y-1">
              {VIEW_OPTIONS.map((option) => {
                const ViewIcon =
                  option.value === 'all'
                    ? Grid2X2
                    : option.value === 'favorites'
                      ? Star
                      : Clock3;
                const isActive = view === option.value && categoryId === 'all';
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      'flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-medium text-muted-foreground transition-[background-color,color,box-shadow] hover:bg-primary/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
                      isActive &&
                        'bg-primary/[0.11] text-primary shadow-[inset_3px_0_0_var(--primary)] hover:bg-primary/[0.14] hover:text-primary',
                    )}
                    aria-pressed={isActive}
                    onClick={() => {
                      setView(option.value);
                      setCategoryId('all');
                    }}
                  >
                    <span className="flex items-center gap-2.5">
                      <ViewIcon className="size-4" aria-hidden="true" />
                      {option.label}
                    </span>
                    {option.value === 'all' && allResourcesQuery.data ? (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {allResourcesQuery.data.total}
                      </span>
                    ) : null}
                  </button>
                );
              })}

              {categories.length > 0 ? (
                <div className="my-2 h-px bg-border" aria-hidden="true" />
              ) : null}

              {categories.map((category) => {
                const isActive = view === 'all' && categoryId === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={cn(
                      'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-medium text-muted-foreground transition-[background-color,color,box-shadow] hover:bg-primary/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
                      isActive &&
                        'bg-primary/[0.11] text-primary shadow-[inset_3px_0_0_var(--primary)] hover:bg-primary/[0.14] hover:text-primary',
                    )}
                    aria-pressed={isActive}
                    onClick={() => {
                      setView('all');
                      setCategoryId(category.id);
                    }}
                  >
                    <span
                      className={cn(
                        'size-2 shrink-0 rounded-full ring-4 ring-current/10',
                        categoryDotClass(category.color),
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{category.name}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-3 rounded-xl bg-primary/[0.065] p-3 text-xs leading-5 text-muted-foreground">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <LockKeyhole
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                Links protegidos
              </div>
              <p className="mt-1.5">
                A central aceita endereços HTTPS e não armazena senhas.
              </p>
            </div>
          </aside>

          <div className="min-w-0">
            {showFavorites ? (
              <section
                className="mb-7"
                aria-labelledby="favorite-resources-title"
              >
                <div className="mb-3 flex items-end justify-between gap-4 px-1">
                  <div>
                    <p className="pta-eyebrow">Fixados</p>
                    <h2
                      id="favorite-resources-title"
                      className="mt-1 text-xl font-semibold tracking-[-0.015em]"
                    >
                      Seus favoritos
                    </h2>
                  </div>
                  {favoritesQuery.data?.total ? (
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                      onClick={() => setView('favorites')}
                    >
                      Ver todos
                    </button>
                  ) : null}
                </div>
                <FavoriteResources
                  items={favoritesQuery.data?.items.slice(0, 4) ?? []}
                  isPending={favoritesQuery.isPending}
                  isError={favoritesQuery.isError && !favoritesQuery.data}
                  onRetry={() => void favoritesQuery.refetch()}
                  onOpenDetail={(resourceId) =>
                    openResource(resourceId, 'detail')
                  }
                />
              </section>
            ) : null}

            <section aria-labelledby="resource-library-title">
              <div className="mb-3 flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="pta-eyebrow">Biblioteca</p>
                  <h2
                    id="resource-library-title"
                    className="mt-1 text-xl font-semibold tracking-[-0.015em]"
                  >
                    {resourceLibraryTitle(view, activeCategory?.name)}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {resourcesQuery.data ? (
                    <span
                      className="mr-1 text-sm text-muted-foreground"
                      aria-live="polite"
                    >
                      {resourcesQuery.data.total === 1
                        ? '1 resultado'
                        : `${resourcesQuery.data.total} resultados`}
                    </span>
                  ) : null}
                  <Select value={resourceType} onValueChange={setTypeFilter}>
                    <SelectTrigger
                      className="h-10 w-[180px] rounded-xl"
                      aria-label="Filtrar por tipo"
                    >
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      {availableTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {TYPE_PRESENTATION[type].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border bg-card ">
                {oneCharacterQuery ? (
                  <div className="py-14 text-center">
                    <Search
                      className="mx-auto size-5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <p className="mt-3 text-sm font-medium">
                      Digite mais um caractere
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      A busca começa a partir de dois caracteres.
                    </p>
                  </div>
                ) : resourcesQuery.isPending ? (
                  <ResourcesLoading />
                ) : resourcesQuery.isError ? (
                  <ResourcesError
                    onRetry={() => void resourcesQuery.refetch()}
                  />
                ) : resourcesQuery.data.items.length === 0 ? (
                  <ResourcesEmpty
                    canCreate={canCreate}
                    hasFilters={hasActiveFilters(filters)}
                    view={view}
                    onCreate={openCreateDialog}
                  />
                ) : (
                  <ResourceList
                    workspaceId={workspaceId}
                    items={resourcesQuery.data.items}
                    hasMore={resourcesQuery.hasNextPage}
                    loadingMore={resourcesQuery.isFetchingNextPage}
                    onLoadMore={() => void resourcesQuery.fetchNextPage()}
                    onOpenDetail={(resourceId) =>
                      openResource(resourceId, 'detail')
                    }
                    onEdit={(resourceId) => openResource(resourceId, 'edit')}
                    onArchive={setArchiveTarget}
                  />
                )}
              </div>
            </section>
          </div>
        </div>
      </section>

      <ResourceEditorDialog
        workspaceId={workspaceId}
        canManageRestriction={canManageRestriction}
        permissionMembers={permissionMembers}
        resourceId={editor?.resourceId ?? null}
        mode={editor?.mode ?? 'detail'}
        categories={categories}
        open={editor !== null}
        onRequestEdit={(resourceId) => openResource(resourceId, 'edit')}
        onOpenChange={(open) => {
          if (!open) {
            const hadResource = Boolean(editor?.resourceId);
            setEditor(null);
            if (hadResource) router.replace('/recursos', { scroll: false });
          }
        }}
      />

      <ArchiveResourceDialog
        workspaceId={workspaceId}
        resource={archiveTarget}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
      />

      <ResourceCategoriesDialog
        workspaceId={workspaceId}
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        canArchive={canManageRestriction}
        onCategoryArchived={(archivedCategoryId) => {
          if (categoryId === archivedCategoryId) setCategoryId('all');
        }}
      />
    </div>
  );

  function setTypeFilter(value: string) {
    if (value === 'all' || value in TYPE_PRESENTATION) {
      setResourceType(value as ResourceType | 'all');
    }
  }

  function openCreateDialog() {
    setEditor({ mode: 'create', resourceId: null });
  }

  function openResource(resourceId: string, mode: 'detail' | 'edit') {
    setEditor({ mode, resourceId });
    const modeQuery = mode === 'edit' ? '&modo=editar' : '';
    router.replace(
      `/recursos?recurso=${encodeURIComponent(resourceId)}${modeQuery}`,
      { scroll: false },
    );
  }
}

function FavoriteResources({
  items,
  isPending,
  isError,
  onRetry,
  onOpenDetail,
}: {
  items: ResourceListItem[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpenDetail: (resourceId: string) => void;
}) {
  if (isPending) {
    return (
      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Carregando favoritos"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border bg-card px-5 py-5">
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Não foi possível carregar seus favoritos</AlertTitle>
          <AlertDescription>
            Verifique sua conexão e tente novamente.
          </AlertDescription>
        </Alert>
        <Button
          type="button"
          variant="outline"
          className="mt-4 rounded-xl"
          onClick={onRetry}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-card/65 px-5 py-6">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.09] text-primary">
            <Star className="size-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[15px] font-semibold">Nenhum favorito ainda</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Use a estrela para manter os recursos mais importantes por perto.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((resource) => {
        const presentation = TYPE_PRESENTATION[resource.resource_type];
        const ResourceIcon = presentation.icon;
        return (
          <li key={resource.id}>
            <button
              type="button"
              className="group flex min-h-32 w-full items-start gap-3 rounded-2xl border bg-card p-4 text-left  transition-[border-color,box-shadow,transform]  hover:border-primary/35  focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 motion-reduce:transform-none"
              onClick={() => onOpenDetail(resource.id)}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.09] text-primary transition-colors group-hover:bg-primary/[0.14]">
                <ResourceIcon className="size-4.5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 text-[15px] font-semibold leading-5">
                    {resource.title}
                  </span>
                  <ArrowUpRight
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                    aria-hidden="true"
                  />
                </span>
                <span className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {resource.description ||
                    resourceHostname(resource.external_url)}
                </span>
                <span className="mt-3 block truncate text-[11px] font-medium text-muted-foreground/80">
                  {resource.category?.name ?? presentation.label}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ResourceList({
  workspaceId,
  items,
  hasMore,
  loadingMore,
  onLoadMore,
  onOpenDetail,
  onEdit,
  onArchive,
}: {
  workspaceId: string;
  items: ResourceListItem[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onOpenDetail: (resourceId: string) => void;
  onEdit: (resourceId: string) => void;
  onArchive: (resource: ResourceListItem) => void;
}) {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const favoriteMutation = useMutation({
    mutationFn: async ({
      resourceId,
      isFavorite,
    }: {
      resourceId: string;
      isFavorite: boolean;
    }) => {
      const { data, error } = await createClient().rpc(
        'set_resource_favorite',
        {
          p_resource_id: resourceId,
          p_is_favorite: isFavorite,
        },
      );
      if (error) throw error;
      return favoriteResultSchema.parse(data);
    },
    onMutate: () => setActionError(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: resourceKeys.all(workspaceId),
      });
    },
    onError: () =>
      setActionError('Não foi possível atualizar o favorito. Tente novamente.'),
  });
  const visitMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      const { error } = await createClient().rpc('record_resource_visit', {
        p_resource_id: resourceId,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: resourceKeys.all(workspaceId),
      });
    },
    onError: () =>
      setActionError(
        'O recurso foi aberto, mas o acesso recente não pôde ser registrado.',
      ),
  });

  return (
    <section aria-label="Recursos encontrados">
      {actionError ? (
        <Alert variant="destructive" className="m-3">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Ação não concluída</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <div
        className="hidden grid-cols-[40px_minmax(280px,1fr)_150px_170px_130px_88px] items-center bg-muted/35 px-3 py-3 text-xs font-semibold text-muted-foreground lg:grid"
        aria-hidden="true"
      >
        <span />
        <span>Recurso</span>
        <span>Tipo</span>
        <span>Categoria</span>
        <span>Atualizado</span>
        <span />
      </div>

      <ul className="divide-y">
        {items.map((resource) => (
          <ResourceRow
            key={resource.id}
            resource={resource}
            favoritePending={
              favoriteMutation.isPending &&
              favoriteMutation.variables.resourceId === resource.id
            }
            onFavorite={() =>
              favoriteMutation.mutate({
                resourceId: resource.id,
                isFavorite: !resource.is_favorite,
              })
            }
            onVisit={() => visitMutation.mutate(resource.id)}
            onOpenDetail={() => onOpenDetail(resource.id)}
            onEdit={() => onEdit(resource.id)}
            onArchive={() => onArchive(resource)}
          />
        ))}
      </ul>
      {hasMore ? (
        <div className="flex justify-center border-t py-4">
          <Button
            type="button"
            variant="outline"
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : null}
            Carregar mais
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function ResourceRow({
  resource,
  favoritePending,
  onFavorite,
  onVisit,
  onOpenDetail,
  onEdit,
  onArchive,
}: {
  resource: ResourceListItem;
  favoritePending: boolean;
  onFavorite: () => void;
  onVisit: () => void;
  onOpenDetail: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const presentation = TYPE_PRESENTATION[resource.resource_type];
  const ResourceIcon = presentation.icon;

  return (
    <li className="group/resource grid min-h-[72px] grid-cols-[40px_minmax(0,1fr)_88px] items-center gap-x-1 px-3 py-2.5 transition-[background-color,box-shadow] hover:bg-primary/[0.045] hover:shadow-[inset_3px_0_0_color-mix(in_srgb,var(--primary)_72%,transparent)] lg:grid-cols-[40px_minmax(280px,1fr)_150px_170px_130px_88px] dark:hover:bg-primary/[0.075]">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className={cn(
          'text-muted-foreground',
          resource.is_favorite && 'text-amber-600 hover:text-amber-700',
        )}
        disabled={favoritePending}
        aria-label={
          resource.is_favorite
            ? `Remover ${resource.title} dos favoritos`
            : `Adicionar ${resource.title} aos favoritos`
        }
        onClick={onFavorite}
      >
        {favoritePending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Star
            aria-hidden="true"
            className={resource.is_favorite ? 'fill-current' : undefined}
          />
        )}
      </Button>

      <div className="min-w-0 py-1 pr-2">
        <div className="flex min-w-0 items-center gap-2">
          <ResourceIcon
            className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/resource:text-primary"
            aria-hidden="true"
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-auto min-h-11 min-w-0 justify-start px-1 text-left font-medium whitespace-normal hover:bg-transparent hover:text-primary lg:min-h-0"
            onClick={onOpenDetail}
          >
            <span className="line-clamp-2 break-words">{resource.title}</span>
          </Button>
          {resource.is_restricted ? (
            <span title="Acesso restrito">
              <LockKeyhole
                className="size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="sr-only">Acesso restrito</span>
            </span>
          ) : null}
        </div>
        {resource.description ? (
          <p className="mt-1 line-clamp-1 break-words text-xs text-muted-foreground">
            {resource.description}
          </p>
        ) : (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {resourceHostname(resource.external_url)}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground lg:hidden">
          <span>{presentation.label}</span>
          {resource.category ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{resource.category.name}</span>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <span>{formatUpdatedAt(resource.updated_at)}</span>
        </div>
      </div>

      <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
        <span>{presentation.label}</span>
      </div>

      <div className="hidden min-w-0 lg:block">
        {resource.category ? (
          <Badge variant="outline" className="max-w-[150px] font-normal">
            <span
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                categoryDotClass(resource.category.color),
              )}
              aria-hidden="true"
            />
            <span className="truncate">{resource.category.name}</span>
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">Sem categoria</span>
        )}
      </div>

      <span className="hidden text-sm text-muted-foreground lg:block">
        {formatUpdatedAt(resource.updated_at)}
      </span>

      <div
        className="flex justify-end"
        role="group"
        aria-label={`Ações de ${resource.title}`}
      >
        <Button asChild size="icon-sm" variant="ghost">
          <a
            href={resource.external_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir endereço externo de ${resource.title}`}
            onClick={onVisit}
          >
            <ArrowUpRight aria-hidden="true" />
          </a>
        </Button>
        {resource.can_edit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Ações de ${resource.title}`}
              >
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={onEdit}>Editar</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onArchive}>
                Arquivar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </li>
  );
}

function ArchiveResourceDialog({
  workspaceId,
  resource,
  onOpenChange,
}: {
  workspaceId: string;
  resource: ResourceListItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const archiveMutation = useMutation({
    mutationFn: async (target: ResourceListItem) => {
      const { data, error } = await createClient().rpc('archive_resource', {
        p_resource_id: target.id,
        p_expected_version: target.version,
      });
      if (error) throw error;
      return resourceDetailPayloadSchema.parse(data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: resourceKeys.all(workspaceId),
      });
      onOpenChange(false);
    },
  });

  return (
    <AlertDialog
      open={Boolean(resource)}
      onOpenChange={(open) => {
        if (!open) archiveMutation.reset();
        onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arquivar recurso?</AlertDialogTitle>
          <AlertDialogDescription>
            {resource
              ? `${resource.title} deixará de aparecer na central e na busca.`
              : 'O recurso deixará de aparecer na central e na busca.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {archiveMutation.isError ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Não foi possível arquivar</AlertTitle>
            <AlertDescription>
              {archiveErrorMessage(archiveMutation.error)}
            </AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={archiveMutation.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={archiveMutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              if (resource) archiveMutation.mutate(resource);
            }}
          >
            {archiveMutation.isPending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : null}
            Arquivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ResourcesLoading() {
  return (
    <div aria-label="Carregando recursos">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="grid min-h-[72px] grid-cols-[40px_minmax(0,1fr)_44px] items-center gap-2 border-b px-3 last:border-b-0"
        >
          <Skeleton className="size-7" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/3 min-w-32" />
            <Skeleton className="h-3 w-1/2 min-w-40" />
          </div>
          <Skeleton className="size-7 justify-self-end" />
        </div>
      ))}
    </div>
  );
}

function ResourcesError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="px-4 py-8">
      <Alert variant="destructive" className="mx-auto max-w-xl">
        <AlertCircle aria-hidden="true" />
        <AlertTitle>Não foi possível carregar a central</AlertTitle>
        <AlertDescription>
          Verifique sua conexão e tente novamente.
        </AlertDescription>
      </Alert>
      <div className="mt-4 flex justify-center">
        <Button type="button" variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}

function ResourcesEmpty({
  canCreate,
  hasFilters,
  view,
  onCreate,
}: {
  canCreate: boolean;
  hasFilters: boolean;
  view: ResourceViewMode;
  onCreate: () => void;
}) {
  const copy = hasFilters
    ? {
        title: 'Nenhum recurso corresponde aos filtros',
        description: 'Revise a busca ou limpe os filtros.',
      }
    : view === 'favorites'
      ? {
          title: 'Nenhum favorito ainda',
          description:
            'Use a estrela para manter os recursos importantes por perto.',
        }
      : view === 'recent'
        ? {
            title: 'Nenhum acesso recente',
            description: 'Os recursos abertos por você aparecerão aqui.',
          }
        : {
            title: 'Adicione o primeiro recurso',
            description:
              'Cadastre um link, documento online ou sistema usado pela equipe.',
          };

  return (
    <div className="px-5 py-14 sm:px-7 sm:py-16">
      <div className="max-w-lg">
        <h2 className="text-lg font-semibold leading-6">{copy.title}</h2>
        <p className="mt-2 text-[15px] leading-[23px] text-muted-foreground">
          {copy.description}
        </p>
        {canCreate && !hasFilters && view === 'all' ? (
          <Button type="button" className="mt-6" onClick={onCreate}>
            <Plus aria-hidden="true" />
            Adicionar recurso
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function hasActiveFilters(filters: ResourceFilters) {
  return (
    filters.query.trim().length >= 2 ||
    filters.categoryId !== 'all' ||
    filters.resourceType !== 'all'
  );
}

function resourceLibraryTitle(
  view: ResourceViewMode,
  categoryName: string | undefined,
) {
  if (categoryName) return categoryName;
  if (view === 'favorites') return 'Seus favoritos';
  if (view === 'recent') return 'Acessados recentemente';
  return 'Todos os recursos';
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })
    .format(date)
    .replace('.', '');
}

function resourceHostname(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return 'Endereço externo';
  }
}

function categoryDotClass(color: string) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500',
    cyan: 'bg-cyan-500',
    green: 'bg-emerald-500',
    lime: 'bg-lime-500',
    orange: 'bg-orange-500',
    pink: 'bg-pink-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
    stone: 'bg-stone-400',
    yellow: 'bg-amber-500',
  };
  return colors[color] ?? colors.stone;
}

function archiveErrorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof error.message === 'string'
        ? error.message
        : String(error);
  if (message.includes('PTA_VERSION_CONFLICT')) {
    return 'Outra pessoa alterou este recurso. Atualize a central antes de tentar novamente.';
  }
  return 'Sua permissão pode ter mudado. Atualize a central e tente novamente.';
}
