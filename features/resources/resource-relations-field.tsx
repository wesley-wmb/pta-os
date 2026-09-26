'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, LoaderCircle, Plus, Search, X } from 'lucide-react';
import { useDeferredValue, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { createClient } from '@/lib/supabase/client';

import { resourceKeys, useResourceRelationOptions } from './queries';
import { resourceRelationOptionSchema } from './schemas';
import type {
  ResourceFormInput,
  ResourceRelationKind,
  ResourceRelationOption,
} from './types';

const RELATION_CONFIG: Record<
  ResourceRelationKind,
  { label: string; addLabel: string; emptyLabel: string }
> = {
  task: {
    label: 'Demandas',
    addLabel: 'Adicionar demanda',
    emptyLabel: 'Nenhuma demanda encontrada.',
  },
  product: {
    label: 'Produtos',
    addLabel: 'Adicionar produto',
    emptyLabel: 'Nenhum produto encontrado.',
  },
  event: {
    label: 'Projetos',
    addLabel: 'Adicionar projeto',
    emptyLabel: 'Nenhum projeto encontrado.',
  },
  tag: {
    label: 'Tags',
    addLabel: 'Adicionar tag',
    emptyLabel: 'Nenhuma tag encontrada.',
  },
};

type RelationValues = Pick<
  ResourceFormInput,
  'taskIds' | 'productIds' | 'eventIds' | 'tagIds'
>;

export function ResourceRelationsField({
  workspaceId,
  values,
  initialOptions,
  onChange,
}: {
  workspaceId: string;
  values: RelationValues;
  initialOptions: Record<ResourceRelationKind, ResourceRelationOption[]>;
  onChange: (field: keyof RelationValues, ids: string[]) => void;
}) {
  return (
    <fieldset className="space-y-4 border-t pt-5">
      <div>
        <legend className="text-sm font-medium">Relacionamentos</legend>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Conecte este recurso ao trabalho que ajuda a executar.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <RelationPicker
          workspaceId={workspaceId}
          kind="task"
          selectedIds={values.taskIds}
          initialOptions={initialOptions.task}
          onChange={(ids) => onChange('taskIds', ids)}
        />
        <RelationPicker
          workspaceId={workspaceId}
          kind="product"
          selectedIds={values.productIds}
          initialOptions={initialOptions.product}
          onChange={(ids) => onChange('productIds', ids)}
        />
        <RelationPicker
          workspaceId={workspaceId}
          kind="event"
          selectedIds={values.eventIds}
          initialOptions={initialOptions.event}
          onChange={(ids) => onChange('eventIds', ids)}
        />
        <RelationPicker
          workspaceId={workspaceId}
          kind="tag"
          selectedIds={values.tagIds}
          initialOptions={initialOptions.tag}
          onChange={(ids) => onChange('tagIds', ids)}
        />
      </div>
    </fieldset>
  );
}

function RelationPicker({
  workspaceId,
  kind,
  selectedIds,
  initialOptions,
  onChange,
}: {
  workspaceId: string;
  kind: ResourceRelationKind;
  selectedIds: string[];
  initialOptions: ResourceRelationOption[];
  onChange: (ids: string[]) => void;
}) {
  const config = RELATION_CONFIG[kind];
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [knownOptions, setKnownOptions] =
    useState<ResourceRelationOption[]>(initialOptions);
  const [actionError, setActionError] = useState<string | null>(null);
  const optionsQuery = useResourceRelationOptions(
    workspaceId,
    kind,
    deferredQuery,
    open,
  );
  const createTagMutation = useMutation({
    mutationFn: async (name: string) => {
      const normalizedName = name.trim();
      if (normalizedName.length < 1 || normalizedName.length > 60) {
        throw new Error('PTA_INVALID_RESOURCE_TAG_NAME');
      }
      const rpc = createClient().rpc as unknown as (
        rpcName: 'create_resource_tag',
        args: { p_workspace_id: string; p_name: string; p_color: string },
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await rpc('create_resource_tag', {
        p_workspace_id: workspaceId,
        p_name: normalizedName,
        p_color: 'stone',
      });
      if (error) throw error;
      return resourceRelationOptionSchema.parse(data);
    },
    onMutate: () => setActionError(null),
    onSuccess: async (tag) => {
      setKnownOptions((current) => mergeOptions(current, [tag]));
      onChange([...selectedIds, tag.id]);
      setQuery('');
      await queryClient.invalidateQueries({
        queryKey: resourceKeys.all(workspaceId),
      });
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setActionError(
        message.includes('PTA_RESOURCE_TAG_EXISTS')
          ? 'Já existe uma tag com esse nome.'
          : 'Não foi possível criar a tag.',
      );
    },
  });

  const availableOptions = optionsQuery.data?.items ?? [];
  const selectedOptions = selectedIds.map(
    (id) =>
      knownOptions.find((option) => option.id === id) ?? {
        id,
        label: 'Relação indisponível',
        meta: null,
        color: null,
      },
  );
  const exactTagExists = availableOptions.some(
    (option) =>
      option.label.localeCompare(query.trim(), 'pt-BR', {
        sensitivity: 'base',
      }) === 0,
  );

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{config.label}</Label>
        <Badge variant="outline" className="font-normal">
          {selectedIds.length}
        </Badge>
      </div>

      {selectedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" aria-label={config.label}>
          {selectedOptions.map((option) => (
            <span
              key={option.id}
              className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-lg border border-primary/15 bg-primary/[0.045] pl-2 text-xs text-accent-foreground"
            >
              <span className="truncate">{option.label}</span>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                className="min-h-8 min-w-8"
                aria-label={`Remover ${option.label}`}
                onClick={() =>
                  onChange(selectedIds.filter((id) => id !== option.id))
                }
              >
                <X aria-hidden="true" />
              </Button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum vínculo.</p>
      )}

      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setQuery('');
            setActionError(null);
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button type="button" size="sm" variant="outline">
            <Plus aria-hidden="true" />
            {config.addLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(360px,calc(100vw-32px))]"
        >
          <div className="relative">
            <Search
              className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              maxLength={100}
              className="pl-8"
              placeholder={`Buscar ${config.label.toLowerCase()}`}
              aria-label={`Buscar ${config.label.toLowerCase()}`}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="max-h-64 overflow-y-auto border-y">
            {optionsQuery.isPending ? (
              <div className="flex items-center gap-2 px-2 py-4 text-xs text-muted-foreground">
                <LoaderCircle className="animate-spin" aria-hidden="true" />
                Carregando opções
              </div>
            ) : optionsQuery.isError ? (
              <div className="px-2 py-4 text-xs text-destructive" role="status">
                Não foi possível carregar as opções.
              </div>
            ) : availableOptions.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">
                {config.emptyLabel}
              </p>
            ) : (
              availableOptions.map((option) => {
                const selected = selectedIds.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between gap-3 border-b px-2 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/65 hover:text-accent-foreground focus-visible:bg-accent/65 focus-visible:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    disabled={selected}
                    onClick={() => {
                      setKnownOptions((current) =>
                        mergeOptions(current, [option]),
                      );
                      onChange([...selectedIds, option.id]);
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{option.label}</span>
                      {option.meta ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {option.meta}
                        </span>
                      ) : null}
                    </span>
                    {selected ? (
                      <span className="text-xs text-muted-foreground">
                        Adicionado
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          {kind === 'tag' && query.trim() && !exactTagExists ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="justify-start"
              disabled={createTagMutation.isPending}
              onClick={() => createTagMutation.mutate(query)}
            >
              {createTagMutation.isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Plus aria-hidden="true" />
              )}
              Criar tag “{query.trim()}”
            </Button>
          ) : null}

          {actionError ? (
            <p
              className="flex items-start gap-1.5 text-xs text-destructive"
              role="status"
            >
              <AlertCircle
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              {actionError}
            </p>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function mergeOptions(
  current: ResourceRelationOption[],
  incoming: ResourceRelationOption[],
) {
  const byId = new Map(current.map((option) => [option.id, option]));
  for (const option of incoming) byId.set(option.id, option);
  return [...byId.values()];
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return String(error);
}
