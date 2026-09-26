'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  CalendarRange,
  CircleUserRound,
  Clock3,
  ListPlus,
  LoaderCircle,
  Package,
  Plus,
  Shapes,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import type {
  WorkspaceMember,
  WorkspaceRole,
} from '@/features/workspace/types';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

import { useTaskCreationContext } from './creation-context';
import { priorityLabels, statusTone } from './formatters';
import { taskKeys, useTaskDetail } from './queries';
import {
  TaskCollaboration,
  TaskCollaborationActivity,
  TaskCollaborationMain,
  TaskDescriptionSection,
} from './task-collaboration';
import type {
  TaskDetailPayload,
  TaskCustomField,
  TaskCustomFieldType,
  TaskOverview,
  TaskPriority,
  TaskStatus,
} from './types';
import { safeTaskReturnPath } from './task-return-path';

type TaskUpdatePatch = Partial<{
  title: string | null;
  status_id: string | null;
  priority: string | null;
  due_date: string | null;
  due_time: string | null;
  blocked_reason: string | null;
  type_id: string | null;
  product_id: string | null;
  event_id: string | null;
}>;

export function TaskDetail({
  workspaceId,
  taskId,
  statuses,
  members,
  workspaceRole,
  currentUserId,
  taskPrefix,
  mode,
}: {
  workspaceId: string;
  taskId: string;
  statuses: TaskStatus[];
  members: WorkspaceMember[];
  workspaceRole: WorkspaceRole;
  currentUserId: string;
  taskPrefix: string;
  mode: 'peek' | 'full';
}) {
  const query = useTaskDetail(workspaceId, taskId);
  const contextQuery = useTaskCreationContext(workspaceId, true);
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [savingField, setSavingField] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');
  const [blockedStatusId, setBlockedStatusId] = useState<string>();
  const [draftResetKey, setDraftResetKey] = useState(0);
  const [customFieldOpen, setCustomFieldOpen] = useState(false);
  const [customFieldName, setCustomFieldName] = useState('');
  const [customFieldType, setCustomFieldType] =
    useState<TaskCustomFieldType>('text');
  const [customFieldOptions, setCustomFieldOptions] = useState('');

  async function refreshData(task?: TaskOverview) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: taskKeys.detail(workspaceId, taskId),
      }),
      queryClient.invalidateQueries({ queryKey: ['portfolio', workspaceId] }),
      task
        ? queryClient.invalidateQueries({
            queryKey: taskKeys.all(task.workspace_id),
          })
        : Promise.resolve(),
    ]);
  }

  async function refreshDescription(task: TaskOverview) {
    await refreshData(task);
    return queryClient.getQueryData<TaskDetailPayload>(
      taskKeys.detail(workspaceId, taskId),
    )?.task.version;
  }

  async function updateTask(
    task: TaskOverview,
    field: string,
    patch: TaskUpdatePatch,
  ) {
    setSavingField(field);
    setConflict(false);
    const { error } = await createClient().rpc('update_task', {
      p_task_id: task.id,
      p_expected_version: task.version,
      p_patch: patch,
    });

    if (error) {
      setDraftResetKey((value) => value + 1);
      if (error.message.includes('PTA_VERSION_CONFLICT')) {
        setConflict(true);
        toast.error('Esta tarefa foi atualizada por outra pessoa.');
      } else {
        toast.error('Não foi possível salvar. Recarregamos o valor atual.');
      }
    }
    await refreshData(task);
    setSavingField(undefined);
  }

  async function updateAssignee(task: TaskOverview, userId: string) {
    setSavingField('assignee');
    setConflict(false);
    // PostgreSQL accepts NULL here to remove the assignee, although generated
    // Supabase function argument types do not express argument nullability.
    const assigneeId = (userId === 'none' ? null : userId) as string;
    const { error } = await createClient().rpc('set_task_primary_assignee', {
      p_task_id: task.id,
      p_user_id: assigneeId,
      p_expected_version: task.version,
    });
    if (error) {
      if (error.message.includes('PTA_VERSION_CONFLICT')) setConflict(true);
      toast.error(
        error.message.includes('PTA_VERSION_CONFLICT')
          ? 'Esta tarefa possui uma versão mais recente.'
          : 'Não foi possível alterar o responsável.',
      );
    }
    await refreshData(task);
    setSavingField(undefined);
  }

  async function createCustomField() {
    const name = customFieldName.trim();
    const options = customFieldOptions
      .split(',')
      .map((option) => option.trim())
      .filter(Boolean);
    if (name.length < 2) return;
    setSavingField('custom-field-definition');
    const { error } = await createClient().rpc('create_task_custom_field', {
      p_workspace_id: workspaceId,
      p_name: name,
      p_field_type: customFieldType,
      p_options: customFieldType === 'single_select' ? options : [],
    });
    if (error) {
      toast.error(
        error.message.includes('PTA_CUSTOM_FIELD_LIMIT')
          ? 'Este workspace já possui o limite de 12 campos.'
          : 'Não foi possível criar o campo.',
      );
    } else {
      setCustomFieldOpen(false);
      setCustomFieldName('');
      setCustomFieldType('text');
      setCustomFieldOptions('');
      await refreshData();
    }
    setSavingField(undefined);
  }

  async function updateCustomFieldValue(
    task: TaskOverview,
    field: TaskCustomField,
    value: string | number | boolean | null,
  ) {
    setSavingField(`custom-field-${field.id}`);
    const { error } = await createClient().rpc('set_task_custom_field_value', {
      p_task_id: task.id,
      p_field_id: field.id,
      p_expected_task_version: task.version,
      p_value: value,
    });
    if (error) {
      if (error.message.includes('PTA_VERSION_CONFLICT')) setConflict(true);
      toast.error(
        error.message.includes('PTA_VERSION_CONFLICT')
          ? 'Esta tarefa possui uma versão mais recente.'
          : 'Não foi possível salvar o campo.',
      );
    }
    await refreshData(task);
    setSavingField(undefined);
  }

  function selectStatus(task: TaskOverview, statusId: string) {
    const selected = statuses.find((status) => status.id === statusId);
    if (selected?.category === 'blocked') {
      setBlockedStatusId(statusId);
      setBlockedOpen(true);
      return;
    }
    void updateTask(task, 'status', { status_id: statusId });
  }

  if (query.isPending) return <TaskDetailSkeleton mode={mode} />;
  if (query.isError || !query.data?.task) {
    return (
      <div
        className={cn(
          'mx-auto max-w-3xl px-5 py-16',
          mode === 'peek' && 'pt-24',
        )}
      >
        <Alert variant="destructive">
          <AlertTitle>Não foi possível abrir esta tarefa.</AlertTitle>
          <AlertDescription className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void query.refetch()}
            >
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { task, activity, collaboration, capabilities } = query.data;
  const taskTypes = contextQuery.data?.taskTypes ?? [];
  const products = contextQuery.data?.products ?? [];
  const events = contextQuery.data?.events ?? [];
  const currentProductUnavailable = Boolean(
    task.product_id &&
    !products.some((product) => product.id === task.product_id),
  );
  const currentEventUnavailable = Boolean(
    task.event_id && !events.some((event) => event.id === task.event_id),
  );
  const currentTypeUnavailable = Boolean(
    task.type_id && !taskTypes.some((type) => type.id === task.type_id),
  );
  const currentAssigneeUnavailable = Boolean(
    task.primary_assignee_id &&
    !members.some((member) => member.id === task.primary_assignee_id),
  );
  const requesterName =
    task.requester_name ??
    members.find((member) => member.id === task.created_by)?.fullName ??
    'Usuário indisponível';
  const returnHref = safeTaskReturnPath(
    searchParams.get('retorno'),
    '/demandas?visao=semana',
  );
  const returnLabel = returnHref.startsWith('/projetos/')
    ? 'Voltar para o projeto'
    : returnHref === '/inicio'
      ? 'Voltar para o início'
      : 'Voltar para minhas tarefas';
  return (
    <article
      className={cn(
        'mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8',
        mode === 'peek' &&
          'h-full min-h-0 max-w-none overflow-hidden bg-card p-0 sm:p-0',
      )}
      aria-labelledby={`task-title-${task.id}`}
    >
      <div
        className={cn(
          mode === 'peek'
            ? 'pta-scrollbar h-full min-h-0 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:overflow-hidden'
            : 'contents',
        )}
      >
        <div
          className={cn(
            mode === 'peek' &&
              'min-w-0 px-4 pb-10 pt-6 sm:px-6 lg:min-h-0 lg:overflow-y-auto lg:px-8',
          )}
        >
          {mode === 'full' ? (
            <Button
              asChild
              variant="ghost"
              className="mb-6 -ml-3 text-muted-foreground hover:bg-pta-blue/[0.08] hover:text-pta-blue"
            >
              <Link href={returnHref}>
                <ArrowLeft aria-hidden="true" />
                {returnLabel}
              </Link>
            </Button>
          ) : null}
          <header className="pb-1">
            {savingField ? (
              <div className="flex justify-end">
                <span
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  role="status"
                  aria-live="polite"
                >
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-3 animate-spin"
                  />
                  Salvando…
                </span>
              </div>
            ) : null}

            <h1
              id={`task-title-${task.id}`}
              className={
                capabilities.can_edit
                  ? 'sr-only'
                  : 'mt-4 text-[30px] font-bold leading-9 tracking-[-0.035em]'
              }
            >
              {task.title}
            </h1>
            {capabilities.can_edit ? (
              <EditableTitle
                key={`${task.id}:${task.version}:${draftResetKey}`}
                task={task}
                onSave={(title) => updateTask(task, 'title', { title })}
                disabled={Boolean(savingField)}
              />
            ) : null}

            <div
              className="mt-3 flex flex-wrap gap-2"
              role="group"
              aria-label="Status e prioridade da tarefa"
            >
              {capabilities.can_edit ? (
                <Select
                  value={task.status_id}
                  onValueChange={(value) => selectStatus(task, value)}
                  disabled={Boolean(savingField)}
                >
                  <SelectTrigger
                    className={cn(
                      'h-10 min-w-44 justify-start gap-2 border-0 px-3 text-sm font-medium shadow-none',
                      statusTone(task.status_category),
                    )}
                    aria-label="Alterar status"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span
                  className={cn(
                    'inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-medium',
                    statusTone(task.status_category),
                  )}
                >
                  {task.status_name}
                </span>
              )}

              {capabilities.can_edit ? (
                <Select
                  value={task.priority}
                  onValueChange={(value) =>
                    void updateTask(task, 'priority', { priority: value })
                  }
                  disabled={Boolean(savingField)}
                >
                  <SelectTrigger
                    className={cn(
                      'h-10 min-w-32 justify-start gap-2 border px-3 text-sm font-medium shadow-none',
                      priorityTone(task.priority),
                    )}
                    aria-label="Alterar prioridade"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(priorityLabels) as TaskPriority[]).map(
                      (priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priorityLabels[priority]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <span
                  className={cn(
                    'inline-flex min-h-9 items-center rounded-lg border px-3 text-sm font-medium',
                    priorityTone(task.priority),
                  )}
                >
                  {priorityLabels[task.priority]}
                </span>
              )}
            </div>
          </header>

          <TaskDescriptionSection
            key={`${task.id}:${task.version}`}
            task={task}
            canEdit={capabilities.can_edit_description}
            onRefresh={() => refreshDescription(task)}
            onVersionConflict={() => setConflict(true)}
          />

          {conflict ? (
            <Alert className="mb-6 border-pta-warning/30 bg-amber-50/60">
              <AlertTitle>
                Esta tarefa foi atualizada por outra pessoa.
              </AlertTitle>
              <AlertDescription className="mt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setConflict(false);
                    void refreshData(task);
                  }}
                >
                  Recarregar versão atual
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <section className="mt-7" aria-labelledby="properties-title">
            <h2
              id="properties-title"
              className="mb-3 text-base font-semibold tracking-[-0.01em]"
            >
              Organização da tarefa
            </h2>
            {contextQuery.isError ? (
              <div
                className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200"
                role="alert"
              >
                <span>Não foi possível carregar as opções de contexto.</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void contextQuery.refetch()}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : null}
            <dl className="divide-y divide-border/70 rounded-2xl border bg-muted/20 px-4 py-1 sm:px-5">
              <PropertyRow
                id="task-requester-label"
                icon={CircleUserRound}
                label="Solicitante"
              >
                <span className="text-sm font-medium">{requesterName}</span>
              </PropertyRow>
              <PropertyRow
                id="task-assignee-label"
                icon={UserRound}
                label="Responsável"
              >
                {capabilities.can_manage_assignees ? (
                  <Select
                    value={task.primary_assignee_id ?? 'none'}
                    onValueChange={(value) => void updateAssignee(task, value)}
                    disabled={Boolean(savingField)}
                  >
                    <SelectTrigger
                      className="w-full justify-start border-0 bg-transparent px-2 shadow-none transition-colors hover:bg-pta-blue/[0.06] focus:ring-pta-blue/30"
                      aria-labelledby="task-assignee-label"
                    >
                      <SelectValue placeholder="Sem responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem responsável</SelectItem>
                      {currentAssigneeUnavailable &&
                      task.primary_assignee_id ? (
                        <SelectItem value={task.primary_assignee_id} disabled>
                          {task.primary_assignee_name ??
                            'Responsável indisponível'}
                        </SelectItem>
                      ) : null}
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm">
                    {task.primary_assignee_name ?? 'Sem responsável'}
                  </span>
                )}
              </PropertyRow>
              <PropertyRow id="task-due-label" icon={Calendar} label="Prazo">
                {capabilities.can_edit ? (
                  <DueDateEditor
                    key={`${task.version}:${task.due_date}:${task.due_time}:${draftResetKey}`}
                    dueDate={task.due_date}
                    dueTime={task.due_time}
                    disabled={Boolean(savingField)}
                    onSave={(patch) => updateTask(task, 'due', patch)}
                  />
                ) : (
                  <span className="text-sm">
                    {task.due_date ?? 'Sem prazo'}
                    {task.due_time ? `, ${task.due_time.slice(0, 5)}` : ''}
                  </span>
                )}
              </PropertyRow>
              <PropertyRow
                id="task-product-label"
                icon={Package}
                label="Produto"
              >
                {capabilities.can_edit ? (
                  <Select
                    value={task.product_id ?? 'none'}
                    onValueChange={(value) => {
                      const productId = value === 'none' ? null : value;
                      const currentEvent = events.find(
                        (event) => event.id === task.event_id,
                      );
                      void updateTask(task, 'product', {
                        product_id: productId,
                        ...(currentEvent?.product_id &&
                        currentEvent.product_id !== productId
                          ? { event_id: null }
                          : {}),
                      });
                    }}
                    disabled={
                      Boolean(savingField) ||
                      contextQuery.isPending ||
                      contextQuery.isError
                    }
                  >
                    <SelectTrigger
                      className="w-full justify-start border-0 bg-transparent px-2 shadow-none transition-colors hover:bg-pta-blue/[0.06] focus:ring-pta-blue/30"
                      aria-labelledby="task-product-label"
                    >
                      <SelectValue placeholder="Nenhum produto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum produto</SelectItem>
                      {currentProductUnavailable && task.product_id ? (
                        <SelectItem value={task.product_id} disabled>
                          {task.product_name ?? 'Produto indisponível'}
                        </SelectItem>
                      ) : null}
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm font-medium">
                    {task.product_name ?? 'Nenhum'}
                  </span>
                )}
              </PropertyRow>
              <PropertyRow
                id="task-event-label"
                icon={CalendarRange}
                label="Projeto"
              >
                {capabilities.can_edit ? (
                  <Select
                    value={task.event_id ?? 'none'}
                    onValueChange={(value) => {
                      const selectedEvent = events.find(
                        (event) => event.id === value,
                      );
                      void updateTask(task, 'event', {
                        event_id: value === 'none' ? null : value,
                        ...(selectedEvent?.product_id
                          ? { product_id: selectedEvent.product_id }
                          : {}),
                      });
                    }}
                    disabled={
                      Boolean(savingField) ||
                      contextQuery.isPending ||
                      contextQuery.isError
                    }
                  >
                    <SelectTrigger
                      className="w-full justify-start border-0 bg-transparent px-2 shadow-none transition-colors hover:bg-pta-blue/[0.06] focus:ring-pta-blue/30"
                      aria-labelledby="task-event-label"
                    >
                      <SelectValue placeholder="Nenhum projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum projeto</SelectItem>
                      {currentEventUnavailable && task.event_id ? (
                        <SelectItem value={task.event_id} disabled>
                          {task.event_name ?? 'Projeto indisponível'}
                        </SelectItem>
                      ) : null}
                      {events.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm font-medium">
                    {task.event_name ?? 'Nenhum'}
                  </span>
                )}
              </PropertyRow>
              <PropertyRow id="task-type-label" icon={Shapes} label="Tipo">
                {capabilities.can_edit ? (
                  <Select
                    value={task.type_id ?? 'none'}
                    onValueChange={(value) =>
                      void updateTask(task, 'type', {
                        type_id: value === 'none' ? null : value,
                      })
                    }
                    disabled={
                      Boolean(savingField) ||
                      contextQuery.isPending ||
                      contextQuery.isError
                    }
                  >
                    <SelectTrigger
                      className="w-full justify-start border-0 bg-transparent px-2 shadow-none transition-colors hover:bg-pta-blue/[0.06] focus:ring-pta-blue/30"
                      aria-labelledby="task-type-label"
                    >
                      <SelectValue placeholder="Sem tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem tipo</SelectItem>
                      {currentTypeUnavailable && task.type_id ? (
                        <SelectItem value={task.type_id} disabled>
                          {task.type_name ?? 'Tipo indisponível'}
                        </SelectItem>
                      ) : null}
                      {taskTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm font-medium">
                    {task.type_name ?? 'Sem tipo'}
                  </span>
                )}
              </PropertyRow>
              {query.data.custom_fields.map((field) => (
                <PropertyRow
                  key={field.id}
                  id={`task-custom-field-${field.id}`}
                  icon={ListPlus}
                  label={field.name}
                >
                  <CustomFieldEditor
                    field={field}
                    disabled={
                      Boolean(savingField) ||
                      !capabilities.can_edit_custom_field_values
                    }
                    onSave={(value) =>
                      updateCustomFieldValue(task, field, value)
                    }
                  />
                </PropertyRow>
              ))}
              <PropertyRow
                id="task-created-label"
                icon={Clock3}
                label="Criada em"
              >
                <time
                  className="text-sm text-muted-foreground"
                  dateTime={task.created_at}
                >
                  {formatRecordDate(task.created_at)}
                </time>
              </PropertyRow>
            </dl>
            {capabilities.can_manage_custom_fields ? (
              <Button
                type="button"
                variant="ghost"
                className="mt-2 min-h-11 text-muted-foreground hover:text-foreground"
                onClick={() => setCustomFieldOpen(true)}
              >
                <Plus aria-hidden="true" />
                Adicionar campo
              </Button>
            ) : null}
          </section>

          {mode === 'peek' ? (
            <TaskCollaborationMain
              task={task}
              collaboration={collaboration}
              capabilities={capabilities}
              subtasks={query.data.subtasks}
              parentTask={query.data.parent_task}
              members={members}
              workspaceRole={workspaceRole}
              currentUserId={currentUserId}
              taskPrefix={taskPrefix}
              onRefresh={() => refreshData(task)}
            />
          ) : (
            <TaskCollaboration
              task={task}
              collaboration={collaboration}
              capabilities={capabilities}
              activity={activity}
              members={members}
              subtasks={query.data.subtasks}
              parentTask={query.data.parent_task}
              workspaceRole={workspaceRole}
              currentUserId={currentUserId}
              taskPrefix={taskPrefix}
              onRefresh={() => refreshData(task)}
            />
          )}
        </div>

        {mode === 'peek' ? (
          <aside
            className="min-w-0 border-t bg-muted/30 px-5 pb-12 pt-7 sm:px-8 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:px-6 lg:pt-8"
            aria-label="Comentários e atividade da tarefa"
          >
            <TaskCollaborationActivity
              task={task}
              collaboration={collaboration}
              capabilities={capabilities}
              activity={activity}
              members={members}
              onRefresh={() => refreshData(task)}
              panel
            />
          </aside>
        ) : null}
      </div>

      <Dialog open={blockedOpen} onOpenChange={setBlockedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Por que esta tarefa está bloqueada?</DialogTitle>
            <DialogDescription>
              O motivo ajuda a equipe a entender o impedimento e destravar o
              trabalho.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="blocked-reason">Motivo do bloqueio</Label>
            <Input
              id="blocked-reason"
              value={blockedReason}
              maxLength={1000}
              onChange={(event) => setBlockedReason(event.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBlockedOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={blockedReason.trim().length < 3 || !blockedStatusId}
              onClick={() => {
                if (blockedStatusId)
                  void updateTask(task, 'status', {
                    status_id: blockedStatusId,
                    blocked_reason: blockedReason.trim(),
                  });
                setBlockedOpen(false);
                setBlockedReason('');
              }}
            >
              Confirmar bloqueio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={customFieldOpen} onOpenChange={setCustomFieldOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar campo da tarefa</DialogTitle>
            <DialogDescription>
              O campo ficará disponível nas tarefas deste workspace. Use-o
              apenas para informações operacionais que precisam ser
              padronizadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-field-name">Nome</Label>
              <Input
                id="custom-field-name"
                value={customFieldName}
                maxLength={60}
                placeholder="Ex.: Canal de entrega"
                onChange={(event) => setCustomFieldName(event.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-field-type">Tipo</Label>
              <Select
                value={customFieldType}
                onValueChange={(value) =>
                  setCustomFieldType(value as TaskCustomFieldType)
                }
              >
                <SelectTrigger id="custom-field-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto curto</SelectItem>
                  <SelectItem value="number">Número</SelectItem>
                  <SelectItem value="date">Data</SelectItem>
                  <SelectItem value="boolean">Sim ou não</SelectItem>
                  <SelectItem value="single_select">Seleção única</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {customFieldType === 'single_select' ? (
              <div className="space-y-2">
                <Label htmlFor="custom-field-options">Opções</Label>
                <Input
                  id="custom-field-options"
                  value={customFieldOptions}
                  placeholder="Orgânico, Pago, Parceiro"
                  onChange={(event) =>
                    setCustomFieldOptions(event.target.value)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Separe até 30 opções por vírgula.
                </p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCustomFieldOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                customFieldName.trim().length < 2 ||
                Boolean(savingField) ||
                (customFieldType === 'single_select' &&
                  !customFieldOptions.trim())
              }
              onClick={() => void createCustomField()}
            >
              Criar campo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function EditableTitle({
  task,
  onSave,
  disabled,
}: {
  task: TaskOverview;
  onSave: (title: string) => Promise<void>;
  disabled: boolean;
}) {
  const [title, setTitle] = useState(task.title);
  const cancellingRef = useRef(false);
  return (
    <input
      value={title}
      maxLength={180}
      disabled={disabled}
      onChange={(event) => setTitle(event.target.value)}
      onBlur={() => {
        if (cancellingRef.current) {
          cancellingRef.current = false;
          return;
        }
        const clean = title.trim();
        if (clean.length >= 3 && clean !== task.title) void onSave(clean);
        else setTitle(task.title);
      }}
      onKeyDownCapture={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          cancellingRef.current = true;
          setTitle(task.title);
          event.currentTarget.blur();
        }
      }}
      data-task-inline-editor
      className="mt-4 w-full rounded-lg border-0 bg-transparent px-1 py-1 text-[30px] font-bold leading-9 tracking-[-0.035em] shadow-none outline-none transition-colors hover:bg-pta-blue/[0.04] focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-pta-blue/35"
      aria-label="Editar título da tarefa"
    />
  );
}

function CustomFieldEditor({
  field,
  disabled,
  onSave,
}: {
  field: TaskCustomField;
  disabled: boolean;
  onSave: (value: string | number | boolean | null) => Promise<void>;
}) {
  const labelId = `task-custom-field-${field.id}`;
  if (field.type === 'boolean') {
    return (
      <Select
        value={
          typeof field.value === 'boolean'
            ? field.value
              ? 'true'
              : 'false'
            : 'none'
        }
        onValueChange={(value) =>
          void onSave(value === 'none' ? null : value === 'true')
        }
        disabled={disabled}
      >
        <SelectTrigger
          className="w-full justify-start border-0 bg-transparent px-2 shadow-none hover:bg-pta-blue/[0.06]"
          aria-labelledby={labelId}
        >
          <SelectValue placeholder="Não definido" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Não definido</SelectItem>
          <SelectItem value="true">Sim</SelectItem>
          <SelectItem value="false">Não</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (field.type === 'single_select') {
    return (
      <Select
        value={typeof field.value === 'string' ? field.value : 'none'}
        onValueChange={(value) => void onSave(value === 'none' ? null : value)}
        disabled={disabled}
      >
        <SelectTrigger
          className="w-full justify-start border-0 bg-transparent px-2 shadow-none hover:bg-pta-blue/[0.06]"
          aria-labelledby={labelId}
        >
          <SelectValue placeholder="Não definido" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Não definido</SelectItem>
          {field.options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const initialValue = field.value == null ? '' : String(field.value);
  return (
    <Input
      key={`${field.id}:${initialValue}`}
      type={
        field.type === 'number'
          ? 'number'
          : field.type === 'date'
            ? 'date'
            : 'text'
      }
      defaultValue={initialValue}
      maxLength={field.type === 'text' ? 500 : undefined}
      disabled={disabled}
      aria-labelledby={labelId}
      placeholder="Não definido"
      className="w-full border-0 bg-transparent px-2 shadow-none hover:bg-pta-blue/[0.06]"
      onBlur={(event) => {
        const next = event.currentTarget.value.trim();
        if (next === initialValue) return;
        void onSave(
          next === '' ? null : field.type === 'number' ? Number(next) : next,
        );
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          event.currentTarget.value = initialValue;
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function DueDateEditor({
  dueDate,
  dueTime,
  disabled,
  onSave,
}: {
  dueDate: string | null;
  dueTime: string | null;
  disabled: boolean;
  onSave: (patch: TaskUpdatePatch) => Promise<void>;
}) {
  const initialDate = dueDate ?? '';
  const initialTime = dueTime?.slice(0, 5) ?? '';
  const [dateDraft, setDateDraft] = useState(initialDate);
  const [timeDraft, setTimeDraft] = useState(initialTime);

  function reset() {
    setDateDraft(initialDate);
    setTimeDraft(initialTime);
  }

  function commit() {
    const normalizedTime = dateDraft ? timeDraft : '';
    if (dateDraft === initialDate && normalizedTime === initialTime) return;
    void onSave({
      due_date: dateDraft || null,
      due_time: normalizedTime || null,
    });
  }

  return (
    <div
      data-task-inline-editor
      className="grid gap-2 sm:flex sm:flex-wrap"
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null))
          return;
        commit();
      }}
      onKeyDownCapture={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        reset();
      }}
    >
      <Input
        type="date"
        value={dateDraft}
        className="w-full border-0 bg-transparent px-2 shadow-none transition-colors hover:bg-pta-blue/[0.06] focus-visible:ring-pta-blue/30 sm:w-40"
        aria-label="Data do prazo"
        disabled={disabled}
        onChange={(event) => {
          const nextDate = event.target.value;
          setDateDraft(nextDate);
          if (!nextDate) setTimeDraft('');
        }}
      />
      <Input
        type="time"
        value={timeDraft}
        className="w-full border-0 bg-transparent px-2 shadow-none transition-colors hover:bg-pta-blue/[0.06] focus-visible:ring-pta-blue/30 sm:w-28"
        aria-label="Horário do prazo"
        disabled={disabled || !dateDraft}
        onChange={(event) => setTimeDraft(event.target.value)}
      />
    </div>
  );
}

function PropertyRow({
  id,
  icon: Icon,
  label,
  children,
  className,
}: {
  id: string;
  icon: typeof Calendar;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid min-h-14 grid-cols-1 gap-1 py-2.5 sm:grid-cols-[132px_minmax(0,1fr)] sm:items-center sm:gap-3',
        className,
      )}
    >
      <dt
        id={id}
        className="flex items-center gap-2.5 text-sm text-muted-foreground"
      >
        <Icon aria-hidden="true" className="size-4" />
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function TaskDetailSkeleton({ mode }: { mode: 'peek' | 'full' }) {
  if (mode === 'peek') {
    return (
      <div
        className="grid h-full min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.9fr)]"
        aria-busy="true"
        aria-label="Carregando tarefa"
      >
        <div className="space-y-5 overflow-hidden px-8 py-7">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-4/5" />
          <Skeleton className="h-20 w-full" />
          <div className="space-y-3 pt-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        </div>
        <div className="hidden border-l bg-muted/30 px-6 py-7 lg:block">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-5 h-28 w-full rounded-xl" />
          <div className="mt-7 space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto max-w-4xl px-5 py-10 sm:px-8"
      aria-busy="true"
      aria-label="Carregando tarefa"
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-9 w-4/5" />
      <div className="mt-10 space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

function formatRecordDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function priorityTone(priority: TaskPriority) {
  return {
    low: 'border-border bg-muted/45 text-muted-foreground',
    medium:
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200',
    high: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200',
    urgent:
      'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-100',
  }[priority];
}
