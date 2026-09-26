'use client';

import { useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

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
import { createClient } from '@/lib/supabase/client';

import { portfolioKeys } from './portfolio-queries';
import type { EventMilestone, ProjectPhase } from './types';

const NO_PHASE = 'none';

export function TimelineMilestoneDialog({
  open,
  onOpenChange,
  workspaceId,
  projectId,
  milestone,
  phases,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  projectId: string;
  milestone: EventMilestone | null;
  phases: ProjectPhase[];
}) {
  return (
    <TimelineMilestoneEditor
      key={`${milestone?.id ?? 'empty'}:${milestone?.version ?? 0}:${open ? 'open' : 'closed'}`}
      open={open}
      onOpenChange={onOpenChange}
      workspaceId={workspaceId}
      projectId={projectId}
      milestone={milestone}
      phases={phases}
    />
  );
}

function TimelineMilestoneEditor({
  open,
  onOpenChange,
  workspaceId,
  projectId,
  milestone,
  phases,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  projectId: string;
  milestone: EventMilestone | null;
  phases: ProjectPhase[];
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(milestone?.title ?? '');
  const [dueDate, setDueDate] = useState(milestone?.dueDate ?? '');
  const [phaseId, setPhaseId] = useState(milestone?.eventPhaseId ?? NO_PHASE);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function refreshTimeline() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: portfolioKeys.timeline(workspaceId, projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: portfolioKeys.event(workspaceId, projectId),
      }),
    ]);
  }

  async function save() {
    if (!milestone || title.trim().length < 2) return;
    setSaving(true);
    const result = await createClient().rpc('update_event_milestone', {
      p_workspace_id: workspaceId,
      p_milestone_id: milestone.id,
      p_expected_version: milestone.version,
      p_patch: {
        title: title.trim(),
        due_date: dueDate || null,
        event_phase_id: phaseId === NO_PHASE ? null : phaseId,
      },
    });
    setSaving(false);
    if (result.error) {
      toast.error(
        result.error.message.includes('PTA_VERSION_CONFLICT')
          ? 'Este marco mudou em outra sessão. O cronograma foi atualizado.'
          : 'Não foi possível salvar o marco.',
      );
      await refreshTimeline();
      return;
    }
    await refreshTimeline();
    onOpenChange(false);
    toast.success('Marco atualizado.');
  }

  async function remove() {
    if (!milestone) return;
    setDeleting(true);
    const result = await createClient().rpc('delete_event_milestone', {
      p_workspace_id: workspaceId,
      p_milestone_id: milestone.id,
      p_expected_version: milestone.version,
    });
    setDeleting(false);
    if (result.error) {
      toast.error(
        result.error.message.includes('PTA_VERSION_CONFLICT')
          ? 'Este marco mudou em outra sessão. O cronograma foi atualizado.'
          : 'Não foi possível excluir o marco.',
      );
      setDeleteOpen(false);
      await refreshTimeline();
      return;
    }
    setDeleteOpen(false);
    onOpenChange(false);
    await refreshTimeline();
    toast.success('Marco excluído.');
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar marco</DialogTitle>
            <DialogDescription>
              Ajuste o ponto de controle sem transformar o marco em uma tarefa.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="timeline-milestone-title">Título</Label>
              <Input
                id="timeline-milestone-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                minLength={2}
                maxLength={180}
                autoFocus
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="timeline-milestone-date">Data</Label>
                <Input
                  id="timeline-milestone-date"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeline-milestone-phase">Fase</Label>
                <Select value={phaseId} onValueChange={setPhaseId}>
                  <SelectTrigger id="timeline-milestone-phase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PHASE}>Sem fase</SelectItem>
                    {phases.map((phase) => (
                      <SelectItem key={phase.id} value={phase.id}>
                        {phase.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                disabled={saving || deleting}
              >
                <Trash2 aria-hidden="true" />
                Excluir marco
              </Button>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving || deleting || title.trim().length < 2}
                >
                  {saving ? <LoaderCircle className="animate-spin" /> : null}
                  Salvar
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este marco?</AlertDialogTitle>
            <AlertDialogDescription>
              “{milestone?.title}” será removido do cronograma. As tarefas e a
              fase permanecem no projeto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
            >
              {deleting ? <LoaderCircle className="animate-spin" /> : null}
              Excluir marco
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
