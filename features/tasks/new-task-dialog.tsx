'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  BriefcaseBusiness,
  CalendarClock,
  ChevronRight,
  CircleDot,
  LoaderCircle,
  MessageSquareText,
  Package2,
  Plus,
  Tag,
  UserRound,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
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
import type {
  WorkspaceMember,
  WorkspaceRole,
} from '@/features/workspace/types';
import { createClient } from '@/lib/supabase/client';

import { newTaskSchema, type NewTaskInput } from './schemas';
import { useTaskCreationContext } from './creation-context';
import styles from './new-task-dialog.module.css';
import {
  createEmptyTaskDescription,
  hasTaskDescriptionContent,
} from './rich-text';
import { RichTextEditor } from './rich-text-editor';
import type { TaskWeekLane } from './types';

const createdTaskSchema = z.object({
  id: z.uuid(),
  task_number: z.number().int().positive(),
  version: z.number().int().positive(),
});

type NewTaskDialogProps = {
  workspaceId: string;
  taskPrefix: string;
  members: WorkspaceMember[];
  role: WorkspaceRole;
  currentUserId: string;
  compact?: boolean;
  initialDueDate?: string;
  initialStatusId?: string;
  initialBlocked?: boolean;
  initialWeekLane?: Exclude<TaskWeekLane, 'scheduled'>;
  parentTaskId?: string;
  initialTypeId?: string | null;
  initialProductId?: string | null;
  initialEventId?: string | null;
  navigateAfterCreate?: boolean;
  onCreated?: () => void | Promise<void>;
  trigger?: React.ReactNode;
};

export function NewTaskDialog({
  workspaceId,
  taskPrefix,
  members,
  role,
  currentUserId,
  compact = false,
  initialDueDate = '',
  initialStatusId,
  initialBlocked = false,
  initialWeekLane,
  parentTaskId,
  initialTypeId,
  initialProductId,
  initialEventId,
  navigateAfterCreate = true,
  onCreated,
  trigger,
}: NewTaskDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const creationContext = useTaskCreationContext(workspaceId, open);
  const form = useForm<NewTaskInput>({
    resolver: zodResolver(newTaskSchema),
    defaultValues: {
      title: '',
      priority: 'medium',
      dueDate: initialDueDate,
      dueTime: '',
      primaryAssigneeId: 'none',
      typeId: initialTypeId ?? 'none',
      productId: initialProductId ?? 'none',
      eventId: initialEventId ?? 'none',
      description: createEmptyTaskDescription(),
      blockedReason: '',
    },
  });
  const priority = useWatch({ control: form.control, name: 'priority' });
  const primaryAssigneeId = useWatch({
    control: form.control,
    name: 'primaryAssigneeId',
  });
  const productId = useWatch({ control: form.control, name: 'productId' });
  const eventId = useWatch({ control: form.control, name: 'eventId' });
  const typeId = useWatch({ control: form.control, name: 'typeId' });
  const dueDate = useWatch({ control: form.control, name: 'dueDate' });
  const description = useWatch({ control: form.control, name: 'description' });
  const context = creationContext.data;
  const events = useMemo(
    () =>
      (context?.events ?? []).filter(
        (event) =>
          productId === 'none' ||
          event.product_id === null ||
          event.product_id === productId,
      ),
    [context?.events, productId],
  );
  const assignableMembers =
    role === 'member' && !parentTaskId
      ? members.filter((member) => member.id === currentUserId)
      : members;
  const requester =
    members.find((member) => member.id === currentUserId)?.fullName ?? 'Você';
  const selectedAssignee = members.find(
    (member) => member.id === primaryAssigneeId,
  )?.fullName;

  async function onSubmit(values: NewTaskInput) {
    if (initialBlocked && !values.blockedReason.trim()) {
      form.setError('blockedReason', {
        message: 'Informe por que esta tarefa está bloqueada.',
      });
      return;
    }
    const supabase = createClient();
    const taskArguments = {
      p_title: values.title,
      p_status_id: initialStatusId,
      p_priority: values.priority,
      p_due_date: values.dueDate || undefined,
      p_due_time: values.dueTime || undefined,
      p_primary_assignee_id:
        values.primaryAssigneeId === 'none'
          ? undefined
          : values.primaryAssigneeId,
      p_type_id: values.typeId === 'none' ? undefined : values.typeId,
      p_product_id: values.productId === 'none' ? undefined : values.productId,
      p_event_id: values.eventId === 'none' ? undefined : values.eventId,
      p_description: hasTaskDescriptionContent(values.description)
        ? values.description
        : undefined,
      p_blocked_reason: values.blockedReason || undefined,
    };
    const globalResult = parentTaskId
      ? await supabase.rpc('create_task_subtask', {
          ...taskArguments,
          p_parent_task_id: parentTaskId,
        })
      : await supabase.rpc('create_global_task', {
          ...taskArguments,
          p_workspace_id: workspaceId,
        });
    let data = globalResult.data;
    let error = globalResult.error;

    const hasExtendedContext = Boolean(
      hasTaskDescriptionContent(values.description) ||
      values.typeId !== 'none' ||
      values.productId !== 'none' ||
      values.eventId !== 'none' ||
      values.blockedReason,
    );
    if (
      !parentTaskId &&
      error &&
      isMissingGlobalTaskRpc(error.message) &&
      !hasExtendedContext
    ) {
      const fallback = await supabase.rpc('create_task', {
        p_workspace_id: workspaceId,
        p_title: values.title,
        p_status_id: initialStatusId,
        p_priority: values.priority,
        p_due_date: values.dueDate || undefined,
        p_due_time: values.dueTime || undefined,
        p_primary_assignee_id:
          values.primaryAssigneeId === 'none'
            ? undefined
            : values.primaryAssigneeId,
      });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      toast.error(
        parentTaskId && isMissingSubtaskRpc(error.message)
          ? 'A atualização do banco para tarefas vinculadas ainda não foi publicada.'
          : isMissingGlobalTaskRpc(error.message)
            ? 'A atualização de contexto do banco ainda não foi aplicada.'
            : 'Não foi possível criar a tarefa.',
      );
      return;
    }

    const parsedTask = createdTaskSchema.safeParse(data);
    if (!parsedTask.success) {
      toast.error(
        'A tarefa foi criada, mas a resposta não pôde ser validada. Atualize a lista.',
      );
      setOpen(false);
      router.refresh();
      return;
    }
    const task = parsedTask.data;
    if (initialWeekLane) {
      const { error: placementError } = await supabase.rpc(
        'move_task_in_week',
        {
          p_task_id: task.id,
          p_week_lane: initialWeekLane,
          p_due_date: null,
          p_position: task.task_number * 1024,
          p_expected_version: task.version,
        },
      );
      if (placementError) {
        toast.error(
          'A tarefa foi criada, mas não foi posicionada nesta lista.',
        );
      }
    }
    toast.success(
      parentTaskId
        ? 'Tarefa vinculada criada e atribuída.'
        : `${taskPrefix}-${String(task.task_number).padStart(6, '0')} criada.`,
    );
    setOpen(false);
    form.reset({
      title: '',
      priority: 'medium',
      dueDate: initialDueDate,
      dueTime: '',
      primaryAssigneeId: 'none',
      typeId: initialTypeId ?? 'none',
      productId: initialProductId ?? 'none',
      eventId: initialEventId ?? 'none',
      description: createEmptyTaskDescription(),
      blockedReason: '',
    });
    await onCreated?.();
    if (navigateAfterCreate)
      router.push(`/tarefa/${task.id}`, { scroll: false });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            size={compact ? 'icon' : 'default'}
            aria-label={compact ? 'Nova tarefa' : undefined}
          >
            <Plus aria-hidden="true" />
            {compact ? (
              <span className="sr-only">Nova tarefa</span>
            ) : (
              'Nova tarefa'
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/45 backdrop-blur-[3px] dark:bg-black/65"
        className={styles.composer}
      >
        <DialogTitle className="sr-only">
          {parentTaskId ? 'Nova tarefa vinculada' : 'Nova tarefa'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Crie uma tarefa usando o mesmo cartão utilizado para acompanhar o
          trabalho depois da criação.
        </DialogDescription>

        <div className={styles.composerHeader}>
          <div className={styles.breadcrumb}>
            <span>Tarefas</span>
            <ChevronRight aria-hidden="true" />
            <strong>
              {parentTaskId ? 'Nova tarefa vinculada' : 'Nova tarefa'}
            </strong>
          </div>
          <span className={styles.draftBadge}>
            <CircleDot aria-hidden="true" /> Rascunho
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            aria-label="Fechar criação de tarefa"
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <form
          id="new-task-form"
          className={styles.form}
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className={styles.contentGrid}>
            <div className={styles.mainColumn}>
              <div className={styles.titleBlock}>
                <Label htmlFor="task-title" className="sr-only">
                  Título
                </Label>
                <Input
                  id="task-title"
                  autoFocus
                  placeholder="Dê um nome claro para esta tarefa"
                  className={styles.titleInput}
                  {...form.register('title')}
                  aria-invalid={Boolean(form.formState.errors.title)}
                  aria-describedby={
                    form.formState.errors.title ? 'task-title-error' : undefined
                  }
                />
                {form.formState.errors.title ? (
                  <p id="task-title-error" className={styles.fieldError}>
                    {form.formState.errors.title.message}
                  </p>
                ) : null}
                <div className={styles.topProperties}>
                  <span className={styles.statusPill}>
                    {initialBlocked
                      ? 'Bloqueada'
                      : initialStatusId
                        ? 'Status da coluna'
                        : 'A fazer'}
                  </span>
                  <div>
                    <Label id="task-priority-label" className="sr-only">
                      Prioridade
                    </Label>
                    <Select
                      value={priority}
                      onValueChange={(value) =>
                        form.setValue(
                          'priority',
                          value as NewTaskInput['priority'],
                        )
                      }
                    >
                      <SelectTrigger
                        className={styles.priorityPill}
                        aria-labelledby="task-priority-label"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <section className={styles.editorSection}>
                <div className={styles.sectionTitle}>
                  <MessageSquareText aria-hidden="true" />
                  <div>
                    <Label id="task-description-label">Descrição</Label>
                    <p>Contexto, objetivo e critérios importantes.</p>
                  </div>
                </div>
                <RichTextEditor
                  value={description}
                  labelledBy="task-description-label"
                  onChange={(value) =>
                    form.setValue('description', value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                {form.formState.errors.description ? (
                  <p id="task-description-error" className={styles.fieldError}>
                    {form.formState.errors.description.message}
                  </p>
                ) : null}
              </section>

              <section className={styles.organization}>
                <div className={styles.sectionTitle}>
                  <BriefcaseBusiness aria-hidden="true" />
                  <div>
                    <h3>Organização da tarefa</h3>
                    <p>Defina as pessoas, o prazo e onde esta entrega vive.</p>
                  </div>
                </div>
                <div className={styles.propertySheet}>
                  <PropertyRow icon={UserRound} label="Solicitante">
                    <strong className={styles.fixedValue}>{requester}</strong>
                  </PropertyRow>
                  <PropertyRow icon={UserRound} label="Responsável">
                    <Select
                      value={primaryAssigneeId}
                      onValueChange={(value) =>
                        form.setValue('primaryAssigneeId', value)
                      }
                    >
                      <SelectTrigger
                        className={styles.inlineControl}
                        aria-label="Responsável"
                      >
                        <SelectValue placeholder="Sem responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem responsável</SelectItem>
                        {assignableMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </PropertyRow>
                  <PropertyRow icon={CalendarClock} label="Prazo">
                    <div className={styles.dateControls}>
                      <Label htmlFor="task-due-date" className="sr-only">
                        Prazo
                      </Label>
                      <Input
                        id="task-due-date"
                        type="date"
                        className={styles.dateInput}
                        {...form.register('dueDate')}
                      />
                      <Label htmlFor="task-due-time" className="sr-only">
                        Horário
                      </Label>
                      <Input
                        id="task-due-time"
                        type="time"
                        className={styles.timeInput}
                        {...form.register('dueTime')}
                        aria-invalid={Boolean(form.formState.errors.dueTime)}
                      />
                    </div>
                  </PropertyRow>
                  <PropertyRow icon={Package2} label="Produto">
                    <Select
                      value={productId}
                      onValueChange={(value) => {
                        form.setValue('productId', value);
                        const selectedEvent = context?.events.find(
                          (event) => event.id === eventId,
                        );
                        if (
                          selectedEvent?.product_id &&
                          selectedEvent.product_id !== value
                        )
                          form.setValue('eventId', 'none');
                      }}
                      disabled={creationContext.isPending}
                    >
                      <SelectTrigger
                        className={styles.inlineControl}
                        aria-label="Produto"
                      >
                        <SelectValue placeholder="Sem produto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem produto</SelectItem>
                        {context?.products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </PropertyRow>
                  <PropertyRow icon={BriefcaseBusiness} label="Projeto">
                    <Select
                      value={eventId}
                      onValueChange={(value) => {
                        form.setValue('eventId', value);
                        const selectedEvent = context?.events.find(
                          (event) => event.id === value,
                        );
                        if (selectedEvent?.product_id)
                          form.setValue('productId', selectedEvent.product_id);
                      }}
                      disabled={creationContext.isPending}
                    >
                      <SelectTrigger
                        className={styles.inlineControl}
                        aria-label="Projeto"
                      >
                        <SelectValue placeholder="Sem projeto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem projeto</SelectItem>
                        {events.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </PropertyRow>
                  <PropertyRow icon={Tag} label="Tipo">
                    <Select
                      value={typeId}
                      onValueChange={(value) => form.setValue('typeId', value)}
                      disabled={creationContext.isPending}
                    >
                      <SelectTrigger
                        className={styles.inlineControl}
                        aria-label="Tipo"
                      >
                        <SelectValue placeholder="Sem tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem tipo</SelectItem>
                        {context?.taskTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </PropertyRow>
                </div>

                {initialBlocked ? (
                  <div className={styles.blockedField}>
                    <Label htmlFor="task-blocked-reason">
                      Motivo do bloqueio
                    </Label>
                    <Input
                      id="task-blocked-reason"
                      placeholder="Ex.: aguardando aprovação"
                      {...form.register('blockedReason')}
                      aria-invalid={Boolean(
                        form.formState.errors.blockedReason,
                      )}
                    />
                    {form.formState.errors.blockedReason ? (
                      <p className={styles.fieldError}>
                        {form.formState.errors.blockedReason.message}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {form.formState.errors.dueTime ? (
                  <p className={styles.fieldError}>
                    {form.formState.errors.dueTime.message}
                  </p>
                ) : null}
                {creationContext.isError ? (
                  <p className={styles.fieldError}>
                    Não foi possível carregar tipos, produtos e projetos.
                  </p>
                ) : null}
              </section>
            </div>

            <aside className={styles.contextColumn}>
              <div className={styles.contextHeading}>
                <MessageSquareText aria-hidden="true" />
                <div>
                  <h3>Contexto da criação</h3>
                  <p>O histórico começa depois de salvar.</p>
                </div>
              </div>
              <div className={styles.requesterCard}>
                <span>{requester.slice(0, 1).toUpperCase()}</span>
                <div>
                  <strong>{requester}</strong>
                  <small>solicitou esta tarefa</small>
                </div>
              </div>
              <dl className={styles.creationSummary}>
                <div>
                  <dt>Responsável</dt>
                  <dd>{selectedAssignee ?? 'A definir'}</dd>
                </div>
                <div>
                  <dt>Prazo</dt>
                  <dd>{dueDate || 'Sem prazo definido'}</dd>
                </div>
                <div>
                  <dt>Projeto</dt>
                  <dd>
                    {context?.events.find((item) => item.id === eventId)
                      ?.name ?? 'Nenhum projeto'}
                  </dd>
                </div>
              </dl>
              <div className={styles.afterCreate}>
                <span>Depois de criar</span>
                <p>
                  Comentários, checklist, arquivos, tarefas vinculadas e todo o
                  histórico ficam disponíveis neste mesmo cartão.
                </p>
              </div>
            </aside>
          </div>

          <DialogFooter className={styles.composerFooter}>
            <p>
              {parentTaskId
                ? 'A nova entrega ficará vinculada à tarefa atual.'
                : 'Você poderá complementar a tarefa depois de criar.'}
            </p>
            <div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : null}
                {form.formState.isSubmitting ? 'Criando…' : 'Criar tarefa'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PropertyRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof UserRound;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.propertyRow}>
      <span className={styles.propertyLabel}>
        <Icon aria-hidden="true" />
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

function isMissingGlobalTaskRpc(message: string) {
  return (
    message.includes('create_global_task') &&
    (message.includes('schema cache') || message.includes('Could not find'))
  );
}

function isMissingSubtaskRpc(message: string) {
  return (
    message.includes('create_task_subtask') &&
    (message.includes('schema cache') || message.includes('Could not find'))
  );
}
