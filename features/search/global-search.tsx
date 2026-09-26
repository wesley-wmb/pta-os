'use client';

import { ArrowRight, LoaderCircle, RotateCcw, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type RefObject } from 'react';

import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

import { useWorkspaceSearch } from './queries';
import { displaySearchSubtitle, SearchEntityIcon } from './result-presentation';
import type { SearchResultItem } from './types';

const DEBOUNCE_MS = 240;

export function GlobalSearch({
  workspaceId,
  open,
  onOpenChange,
  returnFocusRef,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [query]);

  const normalizedQuery = query.trim();
  const isDebouncing =
    normalizedQuery.length >= 2 && normalizedQuery !== debouncedQuery;
  const resultsQuery = useWorkspaceSearch(workspaceId, debouncedQuery, 8);
  const payload = resultsQuery.data;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setQuery('');
      setDebouncedQuery('');
    }
    onOpenChange(nextOpen);
  }

  function openResult(item: SearchResultItem) {
    handleOpenChange(false);
    router.push(item.href);
  }

  function openFullResults() {
    if (normalizedQuery.length < 2) return;
    handleOpenChange(false);
    router.push(`/busca?q=${encodeURIComponent(normalizedQuery)}`);
  }

  const loading =
    isDebouncing ||
    (debouncedQuery.length >= 2 &&
      (resultsQuery.isPending || resultsQuery.isFetching));
  const statusMessage = getStatusMessage({
    query: normalizedQuery,
    loading,
    failed: resultsQuery.isError,
    total: payload?.total ?? null,
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[10dvh] max-h-[78dvh] translate-y-0 gap-0 overflow-hidden rounded-[10px] p-0 sm:max-w-[640px]"
        onCloseAutoFocus={(event) => {
          const returnTarget = returnFocusRef.current;
          if (!returnTarget?.isConnected) return;
          event.preventDefault();
          returnTarget.focus();
        }}
      >
        <DialogTitle className="sr-only">Busca global</DialogTitle>
        <DialogDescription className="sr-only">
          Pesquise tarefas, projetos, produtos, recursos e pessoas do workspace.
        </DialogDescription>

        <Command
          shouldFilter={false}
          label="Busca global"
          className="rounded-[10px]! p-0"
        >
          <CommandInput
            autoFocus
            value={query}
            onValueChange={setQuery}
            maxLength={100}
            placeholder="Buscar em todo o workspace"
            aria-label="Buscar no workspace"
            className="h-full text-[15px]"
          />

          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {statusMessage}
          </div>

          <CommandList className="max-h-[min(58dvh,520px)] px-1 pb-1">
            {normalizedQuery.length === 0 ? (
              <SearchState
                title="Busque em todo o workspace"
                description="Encontre tarefas, projetos, produtos, recursos e pessoas."
              />
            ) : normalizedQuery.length === 1 ? (
              <SearchState
                title="Digite mais um caractere"
                description="A busca começa a partir de dois caracteres."
              />
            ) : loading ? (
              <SearchState
                title="Buscando"
                description="Consultando as áreas do workspace."
                loading
              />
            ) : resultsQuery.isError ? (
              <div className="flex min-h-40 flex-col items-center justify-center px-6 text-center">
                <p className="text-sm font-semibold">
                  Não foi possível concluir a busca
                </p>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  Verifique sua conexão e tente novamente.
                </p>
                <button
                  type="button"
                  onClick={() => void resultsQuery.refetch()}
                  className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold hover:bg-muted"
                >
                  <RotateCcw aria-hidden="true" className="size-3.5" />
                  Tentar novamente
                </button>
              </div>
            ) : !payload || payload.total === 0 ? (
              <SearchState
                title="Nenhum resultado encontrado"
                description={`Não encontramos correspondências para “${normalizedQuery}”.`}
              />
            ) : (
              payload.groups.map((group, groupIndex) => (
                <div key={group.entity_type}>
                  {groupIndex > 0 ? <CommandSeparator /> : null}
                  <CommandGroup heading={group.label}>
                    {group.items.map((item) => {
                      const subtitle = displaySearchSubtitle(
                        item.subtitle,
                        group.entity_type,
                      );

                      return (
                        <CommandItem
                          key={`${group.entity_type}-${item.id}`}
                          value={`${group.entity_type}:${item.id}:${item.title}`}
                          onSelect={() => openResult(item)}
                          className="min-h-12 gap-3 px-2.5 py-2"
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-card text-muted-foreground group-data-selected/command-item:text-pta-blue">
                            <SearchEntityIcon
                              entityType={group.entity_type}
                              className="size-4"
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {item.title}
                            </span>
                            {subtitle ? (
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {subtitle}
                              </span>
                            ) : null}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </div>
              ))
            )}

            {normalizedQuery.length >= 2 &&
            !loading &&
            !resultsQuery.isError ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value={`full-search:${normalizedQuery}`}
                    onSelect={openFullResults}
                    className="min-h-11 px-2.5 text-pta-blue"
                  >
                    <Search aria-hidden="true" className="size-4" />
                    <span className="font-medium">Abrir página de busca</span>
                    <ArrowRight aria-hidden="true" className="ml-auto size-4" />
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>

          <div className="flex h-9 items-center justify-between border-t bg-muted/35 px-3 text-[11px] text-muted-foreground">
            <span>Use as setas para navegar</span>
            <span className="flex items-center gap-2">
              <kbd className="rounded border bg-card px-1.5 py-0.5 font-sans">
                Enter
              </kbd>
              <span>para abrir</span>
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function SearchState({
  title,
  description,
  loading = false,
}: {
  title: string;
  description: string;
  loading?: boolean;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center px-6 text-center">
      {loading ? (
        <LoaderCircle
          aria-hidden="true"
          className="mb-3 size-5 animate-spin text-pta-blue motion-reduce:animate-none"
        />
      ) : null}
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function getStatusMessage({
  query,
  loading,
  failed,
  total,
}: {
  query: string;
  loading: boolean;
  failed: boolean;
  total: number | null;
}) {
  if (query.length === 0) return 'Busca pronta.';
  if (query.length === 1) return 'Digite mais um caractere.';
  if (loading) return 'Buscando no workspace.';
  if (failed) return 'Não foi possível concluir a busca.';
  if (total === 0) return 'Nenhum resultado encontrado.';
  if (total === 1) return '1 resultado encontrado.';
  if (total !== null) return `${total} resultados encontrados.`;
  return 'Busca pronta.';
}
