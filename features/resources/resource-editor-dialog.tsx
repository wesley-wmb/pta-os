'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowUpRight, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';

import { resourceKeys, useResourceDetail } from './queries';
import { ResourceRelationsField } from './resource-relations-field';
import {
  resourceCategorySchema,
  resourceDetailPayloadSchema,
  resourceFormSchema,
} from './schemas';
import type {
  ResourceCategory,
  ResourceDetailPayload,
  ResourceFormInput,
  ResourcePermissionMember,
  ResourceRelationKind,
  ResourceRelationOption,
  ResourceType,
} from './types';

const RESOURCE_TYPE_OPTIONS: Array<{
  value: ResourceType;
  label: string;
}> = [
  { value: 'link', label: 'Link' },
  { value: 'document', label: 'Documento online' },
  { value: 'folder', label: 'Pasta' },
  { value: 'system', label: 'Sistema' },
  { value: 'dashboard', label: 'Painel' },
  { value: 'page', label: 'Página' },
  { value: 'creative', label: 'Criativo' },
  { value: 'video', label: 'Vídeo' },
];

const READ_ONLY_TYPE_LABELS = Object.fromEntries(
  RESOURCE_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ResourceType, string>;

const EMPTY_FORM: ResourceFormInput = {
  title: '',
  externalUrl: '',
  resourceType: 'link',
  description: '',
  categoryId: 'none',
  taskIds: [],
  productIds: [],
  eventIds: [],
  tagIds: [],
  isRestricted: false,
  permissions: [],
};

type ResourceEditorDialogProps = {
  workspaceId: string;
  canManageRestriction: boolean;
  permissionMembers: ResourcePermissionMember[];
  resourceId: string | null;
  mode: 'create' | 'detail' | 'edit';
  categories: ResourceCategory[];
  open: boolean;
  onRequestEdit: (resourceId: string) => void;
  onOpenChange: (open: boolean) => void;
};

export function ResourceEditorDialog({
  workspaceId,
  canManageRestriction,
  permissionMembers,
  resourceId,
  mode,
  categories,
  open,
  onRequestEdit,
  onOpenChange,
}: ResourceEditorDialogProps) {
  const creating = mode === 'create';
  const detailQuery = useResourceDetail(
    workspaceId,
    open && !creating ? resourceId : null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-24px)] gap-0 overflow-y-auto p-0 sm:max-w-[680px]">
        <DialogHeader className="border-b px-5 py-5 text-left sm:px-6">
          <DialogTitle className="text-lg font-semibold">
            {creating
              ? 'Novo recurso'
              : mode === 'edit'
                ? 'Editar recurso'
                : 'Detalhes do recurso'}
          </DialogTitle>
          <DialogDescription>
            {!creating && mode === 'detail'
              ? 'Consulte as informações e abra o endereço em uma nova aba.'
              : 'Salve um endereço HTTPS para a equipe encontrar e reutilizar.'}
          </DialogDescription>
        </DialogHeader>

        {creating ? (
          <ResourceForm
            key="create-resource"
            workspaceId={workspaceId}
            canManageRestriction={canManageRestriction}
            permissionMembers={permissionMembers}
            categories={categories}
            initialValues={EMPTY_FORM}
            onSaved={() => onOpenChange(false)}
          />
        ) : detailQuery.isPending ? (
          <EditorLoading />
        ) : detailQuery.isError ? (
          <div className="px-5 py-6 sm:px-6">
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Não foi possível carregar este recurso</AlertTitle>
              <AlertDescription>
                Verifique sua conexão e tente novamente.
              </AlertDescription>
            </Alert>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => void detailQuery.refetch()}
            >
              Tentar novamente
            </Button>
          </div>
        ) : mode === 'edit' && detailQuery.data.capabilities.can_edit ? (
          <ResourceForm
            key={`${detailQuery.data.resource.id}:${detailQuery.data.resource.version}`}
            workspaceId={workspaceId}
            canManageRestriction={canManageRestriction}
            permissionMembers={permissionMembers}
            categories={categories}
            detail={detailQuery.data}
            initialValues={toFormValues(detailQuery.data, permissionMembers)}
            onSaved={() => onOpenChange(false)}
          />
        ) : (
          <ResourceReadOnly
            detail={detailQuery.data}
            workspaceId={workspaceId}
            onEdit={
              detailQuery.data.capabilities.can_edit
                ? () => onRequestEdit(detailQuery.data.resource.id)
                : undefined
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResourceReadOnly({
  detail,
  workspaceId,
  onEdit,
}: {
  detail: ResourceDetailPayload;
  workspaceId: string;
  onEdit?: () => void;
}) {
  const queryClient = useQueryClient();
  const [visitError, setVisitError] = useState(false);

  async function recordVisit() {
    setVisitError(false);
    const { error } = await createClient().rpc('record_resource_visit', {
      p_resource_id: detail.resource.id,
    });
    if (error) {
      setVisitError(true);
      return;
    }
    await queryClient.invalidateQueries({
      queryKey: resourceKeys.all(workspaceId),
    });
  }

  return (
    <div className="px-5 py-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{READ_ONLY_TYPE_LABELS[detail.resource.resource_type]}</span>
        {detail.resource.category ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{detail.resource.category.name}</span>
          </>
        ) : null}
      </div>
      <h2 className="mt-3 break-words text-lg font-semibold tracking-[-0.015em]">
        {detail.resource.title}
      </h2>
      {detail.resource.description ? (
        <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {detail.resource.description}
        </p>
      ) : null}
      <ResourceRelationsReadOnly detail={detail} />
      <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {onEdit
            ? 'Consulte o recurso ou abra a edição para fazer alterações.'
            : 'Você pode consultar este recurso, mas não alterá-lo.'}
        </p>
        <div className="flex gap-2" role="group" aria-label="Ações do recurso">
          {onEdit ? (
            <Button type="button" variant="outline" onClick={onEdit}>
              Editar
            </Button>
          ) : null}
          <Button asChild>
            <a
              href={detail.resource.external_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void recordVisit()}
            >
              Abrir endereço
              <ArrowUpRight aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>
      {visitError ? (
        <p className="mt-3 text-xs text-destructive" role="status">
          O endereço foi aberto, mas o acesso recente não pôde ser registrado.
        </p>
      ) : null}
    </div>
  );
}

function ResourceRelationsReadOnly({
  detail,
}: {
  detail: ResourceDetailPayload;
}) {
  const hasRelations =
    detail.relations.tasks.length > 0 ||
    detail.relations.products.length > 0 ||
    detail.relations.events.length > 0 ||
    detail.relations.tags.length > 0;

  if (!hasRelations) return null;

  return (
    <section
      className="mt-6 border-t pt-5"
      aria-labelledby="resource-relations-title"
    >
      <h3 id="resource-relations-title" className="text-sm font-medium">
        Onde este recurso é usado
      </h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <RelationLinkList
          label="Demandas"
          items={detail.relations.tasks.map((task) => ({
            id: task.id,
            label: task.title,
            meta: task.task_key,
            href: `/tarefa/${task.id}`,
          }))}
        />
        <RelationLinkList
          label="Produtos"
          items={detail.relations.products.map((product) => ({
            id: product.id,
            label: product.name,
            href: `/produtos?produto=${product.id}`,
          }))}
        />
        <RelationLinkList
          label="Projetos"
          items={detail.relations.events.map((event) => ({
            id: event.id,
            label: event.name,
            href: `/projetos/${event.id}`,
          }))}
        />
        {detail.relations.tags.length > 0 ? (
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Tags</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {detail.relations.tags.map((tag) => (
                <Badge key={tag.id} variant="outline" className="font-normal">
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RelationLinkList({
  label,
  items,
}: {
  label: string;
  items: Array<{ id: string; label: string; meta?: string; href: string }>;
}) {
  if (items.length === 0) return null;

  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <Button
              asChild
              variant="link"
              className="h-auto min-h-8 max-w-full justify-start px-0 text-left whitespace-normal"
            >
              <Link href={item.href}>
                <span className="min-w-0 break-words">{item.label}</span>
                {item.meta ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.meta}
                  </span>
                ) : null}
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResourceForm({
  workspaceId,
  canManageRestriction,
  permissionMembers,
  categories,
  initialValues,
  detail,
  onSaved,
}: {
  workspaceId: string;
  canManageRestriction: boolean;
  permissionMembers: ResourcePermissionMember[];
  categories: ResourceCategory[];
  initialValues: ResourceFormInput;
  detail?: ResourceDetailPayload;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [categoryPending, setCategoryPending] = useState(false);
  const form = useForm<ResourceFormInput>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: initialValues,
  });
  const resourceType = useWatch({
    control: form.control,
    name: 'resourceType',
  });
  const categoryId = useWatch({
    control: form.control,
    name: 'categoryId',
  });
  const isRestricted = useWatch({
    control: form.control,
    name: 'isRestricted',
  });
  const permissions = useWatch({
    control: form.control,
    name: 'permissions',
  });
  const taskIds = useWatch({ control: form.control, name: 'taskIds' });
  const productIds = useWatch({ control: form.control, name: 'productIds' });
  const eventIds = useWatch({ control: form.control, name: 'eventIds' });
  const tagIds = useWatch({ control: form.control, name: 'tagIds' });
  const saveMutation = useMutation({
    mutationFn: async (values: ResourceFormInput) => {
      const client = createClient();
      const normalizedPermissions = normalizePermissions(
        values.permissions,
        permissionMembers,
      );
      const basePatch = {
        title: values.title,
        external_url: values.externalUrl,
        resource_type: values.resourceType,
        description: values.description || null,
        category_id: values.categoryId === 'none' ? null : values.categoryId,
        task_ids: values.taskIds,
        product_ids: values.productIds,
        event_ids: values.eventIds,
        tag_ids: values.tagIds,
      };
      const result = detail
        ? await client.rpc('update_resource', {
            p_resource_id: detail.resource.id,
            p_expected_version: detail.resource.version,
            p_patch: canManageRestriction
              ? {
                  ...basePatch,
                  is_restricted: values.isRestricted,
                  permissions: normalizedPermissions.map((permission) => ({
                    user_id: permission.userId,
                    permission: permission.permission,
                  })),
                }
              : basePatch,
          })
        : await client.rpc('create_resource', {
            p_workspace_id: workspaceId,
            p_title: values.title,
            p_external_url: values.externalUrl,
            p_resource_type: values.resourceType,
            p_description: values.description || undefined,
            p_category_id:
              values.categoryId === 'none' ? undefined : values.categoryId,
            ...(canManageRestriction
              ? { p_is_restricted: values.isRestricted }
              : {}),
            p_task_ids: values.taskIds,
            p_product_ids: values.productIds,
            p_event_ids: values.eventIds,
            p_tag_ids: values.tagIds,
            p_permissions: canManageRestriction
              ? normalizedPermissions.map((permission) => ({
                  user_id: permission.userId,
                  permission: permission.permission,
                }))
              : [],
          });

      if (result.error) throw result.error;
      return resourceDetailPayloadSchema.parse(result.data);
    },
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: resourceKeys.all(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: resourceKeys.detail(workspaceId, saved.resource.id),
        }),
      ]);
      onSaved();
    },
  });

  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        if (!categoryPending) saveMutation.mutate(values);
      })}
    >
      <div className="space-y-5 px-5 py-6 sm:px-6">
        {saveMutation.isError ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Não foi possível salvar</AlertTitle>
            <AlertDescription>
              {resourceMutationMessage(saveMutation.error)}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="resource-title">Título</Label>
          <Input
            id="resource-title"
            autoFocus
            placeholder="Ex.: Guia de identidade visual"
            {...form.register('title')}
            aria-invalid={Boolean(form.formState.errors.title)}
            aria-describedby={
              form.formState.errors.title ? 'resource-title-error' : undefined
            }
          />
          <FieldError
            id="resource-title-error"
            message={form.formState.errors.title?.message}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="resource-url">Endereço HTTPS</Label>
          <Input
            id="resource-url"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://exemplo.com/recurso"
            {...form.register('externalUrl')}
            aria-invalid={Boolean(form.formState.errors.externalUrl)}
            aria-describedby={
              form.formState.errors.externalUrl
                ? 'resource-url-error'
                : 'resource-url-help'
            }
          />
          <p id="resource-url-help" className="text-xs text-muted-foreground">
            A central aceita apenas endereços HTTPS.
          </p>
          <FieldError
            id="resource-url-error"
            message={form.formState.errors.externalUrl?.message}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label id="resource-type-label">Tipo</Label>
            <Select
              value={resourceType}
              onValueChange={(value) =>
                form.setValue('resourceType', value as ResourceType, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger
                className="w-full"
                aria-labelledby="resource-type-label"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label id="resource-category-label">Categoria</Label>
            <Select
              value={categoryId}
              onValueChange={(value) =>
                form.setValue('categoryId', value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger
                className="w-full"
                aria-labelledby="resource-category-label"
              >
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <InlineCategoryCreator
              workspaceId={workspaceId}
              onPendingChange={setCategoryPending}
              onCreated={(category) =>
                form.setValue('categoryId', category.id, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="resource-description">Descrição</Label>
          <Textarea
            id="resource-description"
            rows={4}
            placeholder="Explique quando e por que este recurso deve ser usado."
            {...form.register('description')}
            aria-invalid={Boolean(form.formState.errors.description)}
            aria-describedby={
              form.formState.errors.description
                ? 'resource-description-error'
                : undefined
            }
          />
          <FieldError
            id="resource-description-error"
            message={form.formState.errors.description?.message}
          />
        </div>

        <ResourceRelationsField
          workspaceId={workspaceId}
          values={{ taskIds, productIds, eventIds, tagIds }}
          initialOptions={toRelationOptions(detail)}
          onChange={(field, ids) =>
            form.setValue(field, ids, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />

        {canManageRestriction ? (
          <div className="space-y-4 border-t pt-5">
            <label className="group/field-label flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/25 px-3 py-3">
              <Checkbox
                className="mt-0.5"
                checked={isRestricted}
                onCheckedChange={(checked) =>
                  form.setValue('isRestricted', checked === true, {
                    shouldDirty: true,
                  })
                }
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  Acesso restrito
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  Somente administradores e pessoas autorizadas poderão
                  encontrar este recurso.
                </span>
              </span>
            </label>
            <PermissionEditor
              members={permissionMembers}
              value={permissions}
              onChange={(nextPermissions) =>
                form.setValue('permissions', nextPermissions, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
          </div>
        ) : null}
      </div>

      <DialogFooter className="m-0">
        <Button
          type="submit"
          disabled={saveMutation.isPending || categoryPending}
        >
          {saveMutation.isPending ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : null}
          {detail ? 'Salvar alterações' : 'Adicionar recurso'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function InlineCategoryCreator({
  workspaceId,
  onPendingChange,
  onCreated,
}: {
  workspaceId: string;
  onPendingChange: (pending: boolean) => void;
  onCreated: (category: ResourceCategory) => void;
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const createMutation = useMutation({
    mutationFn: async (categoryName: string) => {
      const normalizedName = categoryName.trim();
      if (normalizedName.length < 2 || normalizedName.length > 80) {
        throw new Error('PTA_INVALID_RESOURCE_CATEGORY_NAME');
      }

      const client = createClient();
      const rpc = client.rpc as unknown as (
        name: 'create_resource_category',
        args: { p_workspace_id: string; p_name: string; p_color: string },
      ) => PromiseLike<{
        data: unknown;
        error: { message: string } | null;
      }>;
      const { data, error } = await rpc('create_resource_category', {
        p_workspace_id: workspaceId,
        p_name: normalizedName,
        p_color: 'stone',
      });
      if (error) throw error;
      return resourceCategorySchema.parse(data);
    },
    onMutate: () => {
      setValidationError(null);
      onPendingChange(true);
    },
    onSuccess: async (category) => {
      await queryClient.invalidateQueries({
        queryKey: resourceKeys.all(workspaceId),
      });
      setName('');
      setAdding(false);
      onCreated(category);
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setValidationError(
        message.includes('PTA_RESOURCE_CATEGORY_EXISTS')
          ? 'Já existe uma categoria com esse nome.'
          : 'Use um nome entre 2 e 80 caracteres.',
      );
    },
    onSettled: () => onPendingChange(false),
  });

  if (!adding) {
    return (
      <Button
        type="button"
        size="xs"
        variant="ghost"
        className="px-1 text-muted-foreground"
        onClick={() => setAdding(true)}
      >
        Criar categoria
      </Button>
    );
  }

  return (
    <div className="space-y-2 pt-1">
      <Input
        value={name}
        maxLength={80}
        disabled={createMutation.isPending}
        placeholder="Nome da categoria"
        aria-label="Nome da nova categoria"
        aria-invalid={Boolean(validationError)}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            createMutation.mutate(name);
          }
          if (event.key === 'Escape') {
            setAdding(false);
            setName('');
            setValidationError(null);
          }
        }}
      />
      {validationError ? (
        <p className="text-xs text-destructive">{validationError}</p>
      ) : null}
      <div className="flex gap-2" role="group" aria-label="Nova categoria">
        <Button
          type="button"
          size="xs"
          disabled={createMutation.isPending}
          onClick={() => createMutation.mutate(name)}
        >
          {createMutation.isPending ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : null}
          Criar
        </Button>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          disabled={createMutation.isPending}
          onClick={() => {
            setAdding(false);
            setName('');
            setValidationError(null);
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function PermissionEditor({
  members,
  value,
  onChange,
}: {
  members: ResourcePermissionMember[];
  value: ResourceFormInput['permissions'];
  onChange: (value: ResourceFormInput['permissions']) => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Pessoas autorizadas</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Editar concede alteração somente a gestores. Para membros e
            visualizadores, o acesso permanece somente para consulta.
          </p>
        </div>
        <Badge variant="outline" className="font-normal">
          {value.length}
        </Badge>
      </div>

      {members.length === 0 ? (
        <p className="mt-3 border-y py-3 text-sm text-muted-foreground">
          Nenhuma outra pessoa ativa está disponível.
        </p>
      ) : (
        <div className="mt-3 max-h-56 overflow-y-auto border-y">
          {members.map((member) => {
            const current = value.find(
              (permission) => permission.userId === member.id,
            );
            return (
              <div
                key={member.id}
                className="flex min-h-12 items-center gap-3 border-b py-2 last:border-b-0"
              >
                <Checkbox
                  checked={Boolean(current)}
                  aria-label={
                    current
                      ? `Remover acesso de ${member.fullName}`
                      : `Autorizar ${member.fullName}`
                  }
                  onCheckedChange={(checked) => {
                    if (checked === true) {
                      onChange([
                        ...value,
                        { userId: member.id, permission: 'view' },
                      ]);
                    } else {
                      onChange(
                        value.filter(
                          (permission) => permission.userId !== member.id,
                        ),
                      );
                    }
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.fullName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {workspaceRoleLabel(member.role)}
                  </p>
                </div>
                {current && member.role === 'manager' ? (
                  <Select
                    value={current.permission}
                    onValueChange={(permission) =>
                      onChange(
                        value.map((item) =>
                          item.userId === member.id
                            ? {
                                ...item,
                                permission: permission as 'view' | 'edit',
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      className="w-28"
                      aria-label={`Nível de acesso de ${member.fullName}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">Visualizar</SelectItem>
                      <SelectItem value="edit">Editar</SelectItem>
                    </SelectContent>
                  </Select>
                ) : current ? (
                  <span className="text-xs text-muted-foreground">
                    Visualizar
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EditorLoading() {
  return (
    <div
      className="space-y-5 px-5 py-6 sm:px-6"
      aria-label="Carregando recurso"
    >
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  ) : null;
}

function toRelationOptions(
  detail?: ResourceDetailPayload,
): Record<ResourceRelationKind, ResourceRelationOption[]> {
  if (!detail) {
    return { task: [], product: [], event: [], tag: [] };
  }

  return {
    task: detail.relations.tasks.map((task) => ({
      id: task.id,
      label: task.title,
      meta: task.task_key,
      color: null,
    })),
    product: detail.relations.products.map((product) => ({
      id: product.id,
      label: product.name,
      meta: null,
      color: null,
    })),
    event: detail.relations.events.map((event) => ({
      id: event.id,
      label: event.name,
      meta: null,
      color: null,
    })),
    tag: detail.relations.tags.map((tag) => ({
      id: tag.id,
      label: tag.name,
      meta: null,
      color: tag.color,
    })),
  };
}

function toFormValues(
  detail: ResourceDetailPayload,
  permissionMembers: ResourcePermissionMember[],
): ResourceFormInput {
  return {
    title: detail.resource.title,
    externalUrl: detail.resource.external_url,
    resourceType: detail.resource.resource_type,
    description: detail.resource.description ?? '',
    categoryId: detail.resource.category?.id ?? 'none',
    taskIds: detail.relations.tasks.map((task) => task.id),
    productIds: detail.relations.products.map((product) => product.id),
    eventIds: detail.relations.events.map((event) => event.id),
    tagIds: detail.relations.tags.map((tag) => tag.id),
    isRestricted: detail.resource.is_restricted,
    permissions: normalizePermissions(
      detail.permissions.map((permission) => ({
        userId: permission.user_id,
        permission: permission.permission,
      })),
      permissionMembers,
    ),
  };
}

function normalizePermissions(
  permissions: ResourceFormInput['permissions'],
  candidates: ResourcePermissionMember[],
) {
  const candidateById = new Map(
    candidates
      .filter(
        (candidate) => candidate.role !== 'owner' && candidate.role !== 'admin',
      )
      .map((candidate) => [candidate.id, candidate]),
  );
  const normalized = new Map<
    string,
    ResourceFormInput['permissions'][number]
  >();

  for (const permission of permissions) {
    const candidate = candidateById.get(permission.userId);
    if (!candidate) continue;
    normalized.set(permission.userId, {
      userId: permission.userId,
      permission:
        permission.permission === 'edit' && candidate.role === 'manager'
          ? 'edit'
          : 'view',
    });
  }

  return [...normalized.values()];
}

function workspaceRoleLabel(role: ResourcePermissionMember['role']) {
  const labels: Record<ResourcePermissionMember['role'], string> = {
    owner: 'Proprietário',
    admin: 'Administrador',
    manager: 'Gestor',
    member: 'Membro',
    viewer: 'Visualizador',
  };
  return labels[role];
}

function resourceMutationMessage(error: unknown) {
  const message = getErrorMessage(error);
  if (message.includes('PTA_VERSION_CONFLICT')) {
    return 'Outra pessoa alterou este recurso. Feche a janela, abra novamente e refaça sua alteração.';
  }
  if (message.includes('PTA_INVALID_RESOURCE_URL')) {
    return 'O endereço precisa ser HTTPS e não pode incluir usuário ou senha.';
  }
  if (message.includes('PTA_RESOURCE_NOT_FOUND')) {
    return 'O recurso não está mais disponível ou sua permissão mudou.';
  }
  return 'Verifique os dados e tente novamente.';
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
