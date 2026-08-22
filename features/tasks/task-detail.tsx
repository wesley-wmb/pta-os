'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  CircleDotDashed,
  Flag,
  History,
  LoaderCircle,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
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
import type { WorkspaceMember } from '@/features/workspace/types';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

import { priorityLabels, statusTone } from './formatters';
import { taskKeys, useTaskDetail } from './queries';
import type { TaskOverview, TaskPriority, TaskStatus } from './types';

export function TaskDetail({
  taskId,
  statuses,
  members,
  mode,
}: {
  taskId: string;
  statuses: TaskStatus[];
  members: WorkspaceMember[];
  mode: 'peek' | 'full';
}) {
  const query = useTaskDetail(taskId);
  const queryClient = useQueryClient();
  const [savingField, setSavingField] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');
  const [blockedStatusId, setBlockedStatusId] = useState<string>();
  const [draftResetKey, setDraftResetKey] = useState(0);

  async function refreshData(task?: TaskOverview) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) }),
      task
        ? queryClient.invalidateQueries({
            queryKey: taskKeys.all(task.workspace_id),
          })
        : Promise.resolve(),
    ]);
  }

  async function updateTask(
    task: TaskOverview,
    field: string,
    patch: Record<string, string | null>,
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
        toast.error('Esta demanda foi atualizada por outra pessoa.');
      } else {
        toast.error('Não foi possível salvar. Recarregamos o valor atual.');
      }
    } else {
      toast.success('Salvo');
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
          ? 'Esta demanda possui uma versão mais recente.'
          : 'Não foi possível alterar o responsável.',
      );
    } else {
      toast.success('Responsável atualizado.');
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
          <AlertTitle>Não foi possível abrir esta demanda.</AlertTitle>
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

  const { task, activity, capabilities } = query.data;

  return (
    <article
      className={cn(
        'mx-auto w-full max-w-4xl px-5 py-7 sm:px-8 sm:py-10',
        mode === 'peek' && 'max-w-none px-5 pb-20 pt-6 sm:px-7',
      )}
      aria-labelledby={`task-title-${task.id}`}
    >
      <header className="mb-8 border-b pb-7">
        <div className="flex items-center justify-between gap-4">
          <span className="font-mono text-xs text-muted-foreground">
            {task.task_key}
          </span>
          {savingField ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LoaderCircle
                aria-hidden="true"
                className="size-3 animate-spin"
              />
              Salvando…
            </span>
          ) : null}
        </div>
        <h1
          id={`task-title-${task.id}`}
          className={
            capabilities.can_edit
              ? 'sr-only'
              : 'mt-3 text-2xl font-semibold leading-tight tracking-[-0.035em] sm:text-3xl'
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
      </header>

      {conflict ? (
        <Alert className="mb-6 border-pta-warning/30 bg-amber-50/60">
          <AlertTitle>Esta demanda foi atualizada por outra pessoa.</AlertTitle>
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

      <section aria-labelledby="properties-title">
        <h2 id="properties-title" className="sr-only">
          Propriedades
        </h2>
        <dl className="divide-y border-y">
          <PropertyRow
            id="task-status-label"
            icon={CircleDotDashed}
            label="Status"
          >
            {capabilities.can_edit ? (
              <Select
                value={task.status_id}
                onValueChange={(value) => selectStatus(task, value)}
                disabled={Boolean(savingField)}
              >
                <SelectTrigger
                  className="w-full justify-start border-0 px-0 shadow-none sm:w-56"
                  aria-labelledby="task-status-label"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs',
                          statusTone(status.category),
                        )}
                      >
                        {status.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span
                className={cn(
                  'inline-flex rounded-full px-2 py-1 text-xs',
                  statusTone(task.status_category),
                )}
              >
                {task.status_name}
              </span>
            )}
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
                  className="w-full justify-start border-0 px-0 shadow-none sm:w-56"
                  aria-labelledby="task-assignee-label"
                >
                  <SelectValue placeholder="Sem responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
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
              <div
                key={`${task.version}:${task.due_date}:${task.due_time}:${draftResetKey}`}
                className="flex flex-wrap gap-2"
              >
                <Input
                  type="date"
                  defaultValue={task.due_date ?? ''}
                  className="w-40 border-0 px-0 shadow-none"
                  aria-label="Data do prazo"
                  disabled={Boolean(savingField)}
                  onBlur={(event) => {
                    if (event.target.value !== (task.due_date ?? ''))
                      void updateTask(task, 'due', {
                        due_date: event.target.value || null,
                      });
                  }}
                />
                <Input
                  type="time"
                  defaultValue={task.due_time?.slice(0, 5) ?? ''}
                  className="w-28 border-0 px-0 shadow-none"
                  aria-label="Horário do prazo"
                  disabled={Boolean(savingField) || !task.due_date}
                  onBlur={(event) => {
                    if (
                      event.target.value !== (task.due_time?.slice(0, 5) ?? '')
                    )
                      void updateTask(task, 'due', {
                        due_time: event.target.value || null,
                      });
                  }}
                />
              </div>
            ) : (
              <span className="text-sm">
                {task.due_date ?? 'Sem prazo'}
                {task.due_time ? `, ${task.due_time.slice(0, 5)}` : ''}
              </span>
            )}
          </PropertyRow>
          <PropertyRow id="task-priority-label" icon={Flag} label="Prioridade">
            {capabilities.can_edit ? (
              <Select
                value={task.priority}
                onValueChange={(value) =>
                  void updateTask(task, 'priority', { priority: value })
                }
                disabled={Boolean(savingField)}
              >
                <SelectTrigger
                  className="w-full justify-start border-0 px-0 shadow-none sm:w-56"
                  aria-labelledby="task-priority-label"
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
              <span className="text-sm">{priorityLabels[task.priority]}</span>
            )}
          </PropertyRow>
        </dl>
      </section>

      <section className="mt-10" aria-labelledby="description-title">
        <h2 id="description-title" className="text-base font-semibold">
          Descrição
        </h2>
        <p className="mt-3 border-y py-7 text-sm text-muted-foreground">
          Nenhuma descrição.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="activity-title">
        <div className="flex items-center gap-2">
          <History
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2 id="activity-title" className="text-base font-semibold">
            Atividade
          </h2>
        </div>
        {activity.length ? (
          <ol className="mt-4 border-l pl-5">
            {activity.map((item) => (
              <li key={item.id} className="relative pb-5 text-sm">
                <span className="absolute -left-[23px] top-1.5 size-1.5 rounded-full bg-muted-foreground" />
                <p>{activityLabel(item.action)}</p>
                <time
                  className="mt-1 block text-xs text-muted-foreground"
                  dateTime={item.created_at}
                >
                  {new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(new Date(item.created_at))}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhuma atividade registrada.
          </p>
        )}
      </section>

      <Dialog open={blockedOpen} onOpenChange={setBlockedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Por que esta demanda está bloqueada?</DialogTitle>
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
  return (
    <input
      value={title}
      maxLength={180}
      disabled={disabled}
      onChange={(event) => setTitle(event.target.value)}
      onBlur={() => {
        const clean = title.trim();
        if (clean.length >= 3 && clean !== task.title) void onSave(clean);
        else setTitle(task.title);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setTitle(task.title);
          event.currentTarget.blur();
        }
      }}
      className="mt-3 w-full rounded-md border-0 bg-transparent px-1 text-2xl font-semibold leading-tight tracking-[-0.035em] shadow-none outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:text-3xl"
      aria-label="Editar título da demanda"
    />
  );
}

function PropertyRow({
  id,
  icon: Icon,
  label,
  children,
}: {
  id: string;
  icon: typeof Calendar;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-12 grid-cols-[120px_minmax(0,1fr)] items-center gap-3 py-1 sm:grid-cols-[150px_minmax(0,1fr)]">
      <dt
        id={id}
        className="flex items-center gap-2 text-xs text-muted-foreground"
      >
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function TaskDetailSkeleton({ mode }: { mode: 'peek' | 'full' }) {
  return (
    <div
      className={cn(
        'mx-auto max-w-4xl px-5 py-10 sm:px-8',
        mode === 'peek' && 'max-w-none',
      )}
      aria-busy="true"
      aria-label="Carregando demanda"
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

function activityLabel(action: string) {
  return (
    (
      {
        'task.created': 'Demanda criada',
        'task.updated': 'Propriedades atualizadas',
        'task.assignee_added': 'Responsável adicionado',
        'task.assignee_removed': 'Responsável removido',
        'task.assignee_changed': 'Responsável alterado',
      } as Record<string, string>
    )[action] ?? 'Demanda atualizada'
  );
}
