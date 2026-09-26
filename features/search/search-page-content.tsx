import { ArrowUpRight, Search } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { displaySearchSubtitle, SearchEntityIcon } from './result-presentation';
import type { SearchWorkspacePayload } from './types';

export function SearchPageContent({
  query,
  payload,
  failed = false,
}: {
  query: string;
  payload: SearchWorkspacePayload | null;
  failed?: boolean;
}) {
  const visibleCount =
    payload?.groups.reduce((total, group) => total + group.items.length, 0) ??
    0;

  return (
    <div className="mx-auto w-full max-w-[1040px] px-5 py-9 sm:px-8 sm:py-12">
      <header className="max-w-2xl">
        <h1 className="text-[2rem] font-bold leading-9 tracking-[-0.025em] sm:text-[2.5rem] sm:leading-[2.75rem]">
          Busca global
        </h1>
        <p className="mt-3 text-[15px] leading-[23px] text-muted-foreground">
          Pesquise tarefas, projetos, produtos, recursos e pessoas do workspace.
        </p>
      </header>

      <form
        action="/busca"
        method="get"
        role="search"
        className="mt-7 flex max-w-2xl items-center gap-2"
      >
        <label htmlFor="workspace-search-page" className="sr-only">
          Buscar no workspace
        </label>
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.8}
          />
          <Input
            id="workspace-search-page"
            name="q"
            type="search"
            defaultValue={query}
            minLength={2}
            maxLength={100}
            autoComplete="off"
            placeholder="Buscar em todo o workspace"
            className="h-11 pl-11 text-[15px] shadow-none"
          />
        </div>
        <Button type="submit" className="h-11 px-5">
          Buscar
        </Button>
      </form>

      <div className="mt-10" aria-live="polite">
        {query.length === 0 ? (
          <SearchPageState
            title="Comece com uma busca"
            description="Digite ao menos dois caracteres para consultar o workspace."
          />
        ) : query.length === 1 ? (
          <SearchPageState
            title="Digite mais um caractere"
            description="A busca aceita termos com dois ou mais caracteres."
          />
        ) : failed ? (
          <SearchPageState
            title="Não foi possível concluir a busca"
            description="Atualize a página para tentar novamente."
          />
        ) : !payload || payload.total === 0 ? (
          <SearchPageState
            title="Nenhum resultado encontrado"
            description={`Não encontramos correspondências para “${query}”.`}
          />
        ) : (
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-4">
              <p className="text-sm font-semibold">
                {formatResultCount(payload.total)}
              </p>
              {payload.total > visibleCount ? (
                <p className="text-xs text-muted-foreground">
                  Mostrando os itens mais relevantes de cada área.
                </p>
              ) : null}
            </div>

            <div className="divide-y">
              {payload.groups.map((group) => (
                <section
                  key={group.entity_type}
                  aria-labelledby={`search-group-${group.entity_type}`}
                  className="grid gap-4 py-7 md:grid-cols-[150px_minmax(0,1fr)]"
                >
                  <h2
                    id={`search-group-${group.entity_type}`}
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    {group.label}
                  </h2>
                  <ol className="divide-y">
                    {group.items.map((item) => {
                      const subtitle = displaySearchSubtitle(
                        item.subtitle,
                        group.entity_type,
                      );

                      return (
                        <li key={`${group.entity_type}-${item.id}`}>
                          <Link
                            href={item.href}
                            className="group flex min-h-14 items-center gap-3 rounded-md px-2 py-2.5 transition-[background-color,box-shadow,color] hover:bg-accent/65 hover:text-accent-foreground hover:shadow-[inset_2px_0_0_color-mix(in_srgb,var(--primary)_70%,transparent)] focus-visible:bg-accent/65 focus-visible:text-accent-foreground"
                          >
                            <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-card text-muted-foreground transition-[border-color,background-color,color] group-hover:border-primary/25 group-hover:bg-primary/[0.08] group-hover:text-primary group-focus-visible:border-primary/25 group-focus-visible:bg-primary/[0.08] group-focus-visible:text-primary">
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
                            <ArrowUpRight
                              aria-hidden="true"
                              className="size-4 shrink-0 text-muted-foreground/55 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-primary group-focus-visible:translate-x-0.5 group-focus-visible:text-primary"
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SearchPageState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-t py-12">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1.5 max-w-lg text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function formatResultCount(total: number) {
  return total === 1
    ? '1 resultado encontrado'
    : `${total} resultados encontrados`;
}
