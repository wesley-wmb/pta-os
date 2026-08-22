'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
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
};

export function NewTaskDialog({
  workspaceId,
  taskPrefix,
  members,
  role,
  currentUserId,
  compact = false,
}: NewTaskDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<NewTaskInput>({
    resolver: zodResolver(newTaskSchema),
    defaultValues: {
      title: '',
      priority: 'medium',
      dueDate: '',
      dueTime: '',
      primaryAssigneeId: 'none',
    },
  });
  const priority = useWatch({ control: form.control, name: 'priority' });
  const primaryAssigneeId = useWatch({
    control: form.control,
    name: 'primaryAssigneeId',
  });
  const assignableMembers =
    role === 'member'
      ? members.filter((member) => member.id === currentUserId)
      : members;

  async function onSubmit(values: NewTaskInput) {
    const { data, error } = await createClient().rpc('create_task', {
      p_workspace_id: workspaceId,
      p_title: values.title,
      p_priority: values.priority,
      p_due_date: values.dueDate || undefined,
      p_due_time: values.dueTime || undefined,
      p_primary_assignee_id:
        values.primaryAssigneeId === 'none'
          ? undefined
          : values.primaryAssigneeId,
    });

    if (error) {
      toast.error('Não foi possível criar a demanda.');
      return;
    }

    const parsedTask = createdTaskSchema.safeParse(data);
    if (!parsedTask.success) {
      toast.error(
        'A demanda foi criada, mas a resposta não pôde ser validada. Atualize a lista.',
      );
      setOpen(false);
      router.refresh();
      return;
    }
    const task = parsedTask.data;
    toast.success(
      `${taskPrefix}-${String(task.task_number).padStart(6, '0')} criada.`,
    );
    setOpen(false);
    form.reset();
    router.push(`/tarefa/${task.id}`, { scroll: false });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size={compact ? 'icon' : 'default'}
          aria-label={compact ? 'Nova demanda' : undefined}
        >
          <Plus aria-hidden="true" />
          {compact ? (
            <span className="sr-only">Nova demanda</span>
          ) : (
            'Nova demanda'
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova demanda</DialogTitle>
          <DialogDescription>
            Título, prazo e prioridade já colocam a demanda em movimento.
          </DialogDescription>
        </DialogHeader>
        <form
          id="new-task-form"
          className="space-y-5"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="space-y-2">
            <Label htmlFor="task-title">Título</Label>
            <Input
              id="task-title"
              autoFocus
              placeholder="Ex.: Revisar página de vendas"
              {...form.register('title')}
              aria-invalid={Boolean(form.formState.errors.title)}
              aria-describedby={
                form.formState.errors.title ? 'task-title-error' : undefined
              }
            />
            {form.formState.errors.title ? (
              <p id="task-title-error" className="text-xs text-destructive">
                {form.formState.errors.title.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-due-date">Prazo</Label>
              <Input
                id="task-due-date"
                type="date"
                {...form.register('dueDate')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-due-time">Horário</Label>
              <Input
                id="task-due-time"
                type="time"
                {...form.register('dueTime')}
                aria-invalid={Boolean(form.formState.errors.dueTime)}
                aria-describedby={
                  form.formState.errors.dueTime
                    ? 'task-due-time-error'
                    : undefined
                }
              />
              {form.formState.errors.dueTime ? (
                <p
                  id="task-due-time-error"
                  className="text-xs text-destructive"
                >
                  {form.formState.errors.dueTime.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label id="task-priority-label">Prioridade</Label>
              <Select
                value={priority}
                onValueChange={(value) =>
                  form.setValue('priority', value as NewTaskInput['priority'])
                }
              >
                <SelectTrigger
                  className="w-full"
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
            <div className="space-y-2">
              <Label id="task-assignee-label">Responsável</Label>
              <Select
                value={primaryAssigneeId}
                onValueChange={(value) =>
                  form.setValue('primaryAssigneeId', value)
                }
              >
                <SelectTrigger
                  className="w-full"
                  aria-labelledby="task-assignee-label"
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
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="new-task-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : null}
            {form.formState.isSubmitting ? 'Criando…' : 'Criar demanda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
