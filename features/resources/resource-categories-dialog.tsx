'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';

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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';

import { resourceKeys, useResourceCategories } from './queries';
import {
  resourceCategoryAdminSchema,
  resourceCategoryListPayloadSchema,
  resourceCategorySchema,
} from './schemas';
import type { ResourceCategoryAdmin } from './types';

const CATEGORY_COLORS = [
  { value: 'stone', label: 'Cinza' },
  { value: 'blue', label: 'Azul' },
  { value: 'cyan', label: 'Ciano' },
  { value: 'green', label: 'Verde' },
  { value: 'lime', label: 'Lima' },
  { value: 'orange', label: 'Laranja' },
  { value: 'pink', label: 'Rosa' },
  { value: 'purple', label: 'Roxo' },
  { value: 'red', label: 'Vermelho' },
  { value: 'yellow', label: 'Amarelo' },
] as const;

const archiveCategoryResultSchema = z.object({
  id: z.uuid(),
  archived_at: z.string(),
  detached_resources: z.number().int().nonnegative(),
});

export function ResourceCategoriesDialog({
  workspaceId,
  open,
  onOpenChange,
  onCategoryArchived,
  canArchive,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoryArchived: (categoryId: string) => void;
  canArchive: boolean;
}) {
  const queryClient = useQueryClient();
  const categoriesQuery = useResourceCategories(workspaceId, open);
  const [editing, setEditing] = useState<ResourceCategoryAdmin | null>(null);
  const [archiveTarget, setArchiveTarget] =
    useState<ResourceCategoryAdmin | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('stone');
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('stone');
  const [actionError, setActionError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const normalizedName = newName.trim();
      if (normalizedName.length < 2 || normalizedName.length > 80) {
        throw new Error('PTA_INVALID_RESOURCE_CATEGORY_NAME');
      }
      const rpc = createClient().rpc as unknown as (
        name: 'create_resource_category',
        args: { p_workspace_id: string; p_name: string; p_color: string },
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await rpc('create_resource_category', {
        p_workspace_id: workspaceId,
        p_name: normalizedName,
        p_color: newColor,
      });
      if (error) throw error;
      return resourceCategorySchema.parse(data);
    },
    onMutate: () => setActionError(null),
    onSuccess: async () => {
      setCreating(false);
      setNewName('');
      setNewColor('stone');
      await invalidateCategories(queryClient, workspaceId);
    },
    onError: (error) => setActionError(categoryErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: async (category: ResourceCategoryAdmin) => {
      const normalizedName = editName.trim();
      if (normalizedName.length < 2 || normalizedName.length > 80) {
        throw new Error('PTA_INVALID_RESOURCE_CATEGORY_NAME');
      }
      const rpc = createClient().rpc as unknown as (
        name: 'update_resource_category',
        args: {
          p_category_id: string;
          p_expected_updated_at: string;
          p_name: string;
          p_color: string;
        },
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await rpc('update_resource_category', {
        p_category_id: category.id,
        p_expected_updated_at: category.updated_at,
        p_name: normalizedName,
        p_color: editColor,
      });
      if (error) throw error;
      return resourceCategoryAdminSchema.parse(data);
    },
    onMutate: () => setActionError(null),
    onSuccess: async () => {
      setEditing(null);
      await invalidateCategories(queryClient, workspaceId);
    },
    onError: (error) => setActionError(categoryErrorMessage(error)),
  });

  const reorderMutation = useMutation({
    mutationFn: async (categoryIds: string[]) => {
      const expectedSnapshot = categoriesQuery.data?.snapshot;
      if (!expectedSnapshot) {
        throw new Error('PTA_RESOURCE_CATEGORY_CONFLICT');
      }
      const rpc = createClient().rpc as unknown as (
        name: 'reorder_resource_categories',
        args: {
          p_workspace_id: string;
          p_category_ids: string[];
          p_expected_snapshot: string;
        },
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await rpc('reorder_resource_categories', {
        p_workspace_id: workspaceId,
        p_category_ids: categoryIds,
        p_expected_snapshot: expectedSnapshot,
      });
      if (error) throw error;
      return resourceCategoryListPayloadSchema.parse(data);
    },
    onMutate: () => setActionError(null),
    onSuccess: async (payload) => {
      queryClient.setQueryData(resourceKeys.categories(workspaceId), payload);
      await invalidateCategories(queryClient, workspaceId);
    },
    onError: async (error) => {
      setActionError(categoryErrorMessage(error));
      await invalidateCategories(queryClient, workspaceId);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (category: ResourceCategoryAdmin) => {
      const rpc = createClient().rpc as unknown as (
        name: 'archive_resource_category',
        args: { p_category_id: string; p_expected_updated_at: string },
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await rpc('archive_resource_category', {
        p_category_id: category.id,
        p_expected_updated_at: category.updated_at,
      });
      if (error) throw error;
      return archiveCategoryResultSchema.parse(data);
    },
    onMutate: () => setActionError(null),
    onSuccess: async (result) => {
      setArchiveTarget(null);
      onCategoryArchived(result.id);
      await invalidateCategories(queryClient, workspaceId);
    },
    onError: (error) => {
      setArchiveTarget(null);
      setActionError(categoryErrorMessage(error));
    },
  });

  const categories = categoriesQuery.data?.categories ?? [];
  const busy =
    createMutation.isPending ||
    updateMutation.isPending ||
    reorderMutation.isPending ||
    archiveMutation.isPending;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && busy) return;
          onOpenChange(nextOpen);
          if (!nextOpen) {
            setEditing(null);
            setCreating(false);
            setActionError(null);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-24px)] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Categorias de recursos</DialogTitle>
            <DialogDescription>
              Ajuste os nomes, as cores e a ordem usadas na central.
            </DialogDescription>
          </DialogHeader>

          {actionError ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Ação não concluída</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}

          {categoriesQuery.isPending ? (
            <div className="space-y-2" aria-label="Carregando categorias">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : categoriesQuery.isError ? (
            <div className="py-3">
              <Alert>
                <AlertCircle aria-hidden="true" />
                <AlertTitle>Gestão de categorias indisponível</AlertTitle>
                <AlertDescription>
                  Esta área depende de uma atualização do sistema que ainda não
                  foi concluída. Você pode continuar criando recursos e usar as
                  categorias existentes.
                </AlertDescription>
              </Alert>
              <Button
                type="button"
                variant="outline"
                className="mt-4 rounded-xl"
                onClick={() => void categoriesQuery.refetch()}
              >
                Tentar novamente
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {creating ? (
                <CategoryFields
                  name={newName}
                  color={newColor}
                  disabled={busy}
                  prefix="new-resource-category"
                  onNameChange={setNewName}
                  onColorChange={setNewColor}
                  onCancel={() => {
                    setCreating(false);
                    setNewName('');
                    setNewColor('stone');
                  }}
                  onSave={() => createMutation.mutate()}
                  saveLabel="Criar categoria"
                />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreating(true)}
                >
                  <Plus aria-hidden="true" />
                  Nova categoria
                </Button>
              )}

              {categories.length === 0 ? (
                <p className="border-y py-8 text-center text-sm text-muted-foreground">
                  Nenhuma categoria criada.
                </p>
              ) : (
                <ol className="border-y">
                  {categories.map((category, index) =>
                    editing?.id === category.id ? (
                      <li
                        key={category.id}
                        className="border-b py-3 last:border-b-0"
                      >
                        <CategoryFields
                          name={editName}
                          color={editColor}
                          disabled={busy}
                          prefix={`resource-category-${category.id}`}
                          onNameChange={setEditName}
                          onColorChange={setEditColor}
                          onCancel={() => setEditing(null)}
                          onSave={() => updateMutation.mutate(category)}
                          saveLabel="Salvar"
                        />
                      </li>
                    ) : (
                      <li
                        key={category.id}
                        className="flex min-h-14 items-center gap-2 border-b py-2 last:border-b-0"
                      >
                        <span
                          className={`size-2 shrink-0 rounded-full ${categoryDotClass(category.color)}`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {category.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {category.resource_count === 1
                              ? '1 recurso'
                              : `${category.resource_count} recursos`}
                          </p>
                        </div>
                        <div
                          className="flex items-center"
                          role="group"
                          aria-label={`Ações de ${category.name}`}
                        >
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            disabled={busy || index === 0}
                            aria-label={`Mover ${category.name} para cima`}
                            onClick={() =>
                              reorderMutation.mutate(
                                moveCategory(categories, index, index - 1),
                              )
                            }
                          >
                            <ArrowUp aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            disabled={busy || index === categories.length - 1}
                            aria-label={`Mover ${category.name} para baixo`}
                            onClick={() =>
                              reorderMutation.mutate(
                                moveCategory(categories, index, index + 1),
                              )
                            }
                          >
                            <ArrowDown aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            disabled={busy}
                            aria-label={`Editar ${category.name}`}
                            onClick={() => {
                              setEditing(category);
                              setEditName(category.name);
                              setEditColor(category.color);
                            }}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                          {canArchive ? (
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={busy}
                              aria-label={`Arquivar ${category.name}`}
                              onClick={() => setArchiveTarget(category)}
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ),
                  )}
                </ol>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !archiveMutation.isPending) setArchiveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.resource_count
                ? archiveTarget.resource_count === 1
                  ? '1 recurso ficará sem categoria.'
                  : `${archiveTarget.resource_count} recursos ficarão sem categoria.`
                : 'A categoria deixará de aparecer nos filtros e editores.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={archiveMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (archiveTarget) archiveMutation.mutate(archiveTarget);
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
    </>
  );
}

function CategoryFields({
  name,
  color,
  disabled,
  prefix,
  onNameChange,
  onColorChange,
  onCancel,
  onSave,
  saveLabel,
}: {
  name: string;
  color: string;
  disabled: boolean;
  prefix: string;
  onNameChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
}) {
  return (
    <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-name`}>Nome</Label>
        <Input
          id={`${prefix}-name`}
          value={name}
          maxLength={80}
          disabled={disabled}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label id={`${prefix}-color-label`}>Cor</Label>
        <Select value={color} disabled={disabled} onValueChange={onColorChange}>
          <SelectTrigger aria-labelledby={`${prefix}-color-label`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_COLORS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2" role="group" aria-label="Edição da categoria">
        <Button type="button" size="sm" disabled={disabled} onClick={onSave}>
          {disabled ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : null}
          {saveLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function moveCategory(
  categories: ResourceCategoryAdmin[],
  from: number,
  to: number,
) {
  const next = [...categories];
  const [moved] = next.splice(from, 1);
  if (!moved) return categories.map((category) => category.id);
  next.splice(to, 0, moved);
  return next.map((category) => category.id);
}

async function invalidateCategories(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
) {
  await queryClient.invalidateQueries({
    queryKey: resourceKeys.all(workspaceId),
  });
}

function categoryErrorMessage(error: unknown) {
  const message = getErrorMessage(error);
  if (message.includes('PTA_RESOURCE_CATEGORY_EXISTS')) {
    return 'Já existe uma categoria com esse nome.';
  }
  if (message.includes('PTA_RESOURCE_CATEGORY_CONFLICT')) {
    return 'Outra pessoa alterou as categorias. Atualize e tente novamente.';
  }
  if (message.includes('PTA_INVALID_RESOURCE_CATEGORY_NAME')) {
    return 'Use um nome entre 2 e 80 caracteres.';
  }
  return 'Verifique sua permissão e tente novamente.';
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
