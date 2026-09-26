'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  AlignLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
  GitBranch,
  Link2,
  LoaderCircle,
  MessageSquare,
  Pencil,
  Plus,
  Reply,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useId, useRef, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type {
  WorkspaceMember,
  WorkspaceRole,
} from '@/features/workspace/types';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

import { fetchTaskCommentsPage, taskKeys } from './queries';
import { NewTaskDialog } from './new-task-dialog';
import { hasTaskDescriptionContent, taskDescriptionsEqual } from './rich-text';
import { RichTextEditor, RichTextViewer } from './rich-text-editor';
import type {
  TaskChecklist,
  TaskChecklistItem,
  TaskActivity,
  TaskCollaborationPayload,
  TaskComment,
  TaskCommentsPageInfo,
  TaskDetailPayload,
  TaskDetailTask,
  TaskLink,
  TaskOverview,
} from './types';

type TaskCollaborationProps = {
  task: TaskDetailTask;
  collaboration: TaskCollaborationPayload;
  capabilities: TaskDetailPayload['capabilities'];
  activity: TaskActivity[];
  members: WorkspaceMember[];
  subtasks: TaskOverview[];
  parentTask: TaskOverview | null;
  workspaceRole: WorkspaceRole;
  currentUserId: string;
  taskPrefix: string;
  onRefresh: () => Promise<void>;
};

const HTTPS_LINK_PATTERN =
  /^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]{1,5})?(?:[/?#]\S*)?$/i;
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function TaskCollaboration({
  task,
  collaboration,
  capabilities,
  activity,
  members,
  subtasks,
  parentTask,
  workspaceRole,
  currentUserId,
  taskPrefix,
  onRefresh,
}: TaskCollaborationProps) {
  return (
    <div className="mt-0">
      <TaskCollaborationMain
        task={task}
        collaboration={collaboration}
        capabilities={capabilities}
        subtasks={subtasks}
        parentTask={parentTask}
        members={members}
        workspaceRole={workspaceRole}
        currentUserId={currentUserId}
        taskPrefix={taskPrefix}
        onRefresh={onRefresh}
      />
      <div className="min-w-0 border-t pt-8">
        <TaskCollaborationActivity
          task={task}
          collaboration={collaboration}
          capabilities={capabilities}
          activity={activity}
          members={members}
          onRefresh={onRefresh}
        />
      </div>
    </div>
  );
}

export function TaskCollaborationMain({
  task,
  collaboration,
  capabilities,
  subtasks,
  parentTask,
  members,
  workspaceRole,
  currentUserId,
  taskPrefix,
  onRefresh,
}: Pick<
  TaskCollaborationProps,
  | 'task'
  | 'collaboration'
  | 'capabilities'
  | 'subtasks'
  | 'parentTask'
  | 'members'
  | 'workspaceRole'
  | 'currentUserId'
  | 'taskPrefix'
  | 'onRefresh'
>) {
  return (
    <>
      <div className="min-w-0">
        <ChecklistSection
          taskId={task.id}
          checklists={collaboration.checklists}
          canManageStructure={capabilities.can_manage_checklist_structure}
          supportsTaskSteps={capabilities.supports_task_steps}
          canManageTaskSteps={capabilities.can_manage_task_steps}
          canToggle={capabilities.can_toggle_checklist}
          onRefresh={onRefresh}
        />
      </div>

      {capabilities.supports_task_steps ? (
        <div className="min-w-0 border-t py-8">
          <SubtasksSection
            task={task}
            subtasks={subtasks}
            parentTask={parentTask}
            members={members}
            workspaceRole={workspaceRole}
            currentUserId={currentUserId}
            taskPrefix={taskPrefix}
            canCreate={capabilities.can_create_subtask}
            canUnlink={capabilities.can_manage_task_steps}
            onRefresh={onRefresh}
          />
        </div>
      ) : null}

      <div className="min-w-0 border-t py-8">
        <LinksSection
          taskId={task.id}
          links={collaboration.links}
          canAdd={capabilities.can_add_link}
          onRefresh={onRefresh}
        />
      </div>
    </>
  );
}

export function TaskCollaborationActivity({
  task,
  collaboration,
  capabilities,
  activity,
  members,
  onRefresh,
  panel = false,
}: Pick<
  TaskCollaborationProps,
  | 'task'
  | 'collaboration'
  | 'capabilities'
  | 'activity'
  | 'members'
  | 'onRefresh'
> & { panel?: boolean }) {
  return (
    <CommentsSection
      workspaceId={task.workspace_id}
      taskId={task.id}
      comments={collaboration.comments}
      commentsPage={collaboration.comments_page}
      activity={activity}
      members={members}
      canComment={capabilities.can_comment}
      onRefresh={onRefresh}
      panel={panel}
    />
  );
}

export function TaskDescriptionSection({
  task,
  canEdit,
  onRefresh,
  onVersionConflict,
}: {
  task: TaskDetailTask;
  canEdit: boolean;
  onRefresh: () => Promise<number | undefined>;
  onVersionConflict: () => void;
}) {
  const [draft, setDraft] = useState(() => task.description_json);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const editorFocusedRef = useRef(false);
  const description = task.description_json;
  const descriptionId = useId();

  async function saveDescription() {
    if (saving || !dirty) return;

    setSaving(true);
    const { error } = await createClient().rpc('update_task_description', {
      p_task_id: task.id,
      p_expected_version: task.version,
      p_description: draft,
    });

    if (error) {
      if (error.message.includes('PTA_VERSION_CONFLICT')) {
        onVersionConflict();
        toast.error('A tarefa foi atualizada por outra pessoa.');
      } else {
        toast.error('Não foi possível salvar a descrição.');
      }
      await onRefresh();
    } else {
      setDirty(false);
      await onRefresh();
    }
    setSaving(false);
  }

  return (
    <section className="mt-6" aria-labelledby={`${descriptionId}-title`}>
      <SectionHeading
        id={`${descriptionId}-title`}
        icon={AlignLeft}
        title="Descrição"
        meta={saving ? 'Salvando' : undefined}
      />

      {canEdit ? (
        <div
          className="mt-2"
          data-task-inline-editor
          onFocusCapture={() => {
            editorFocusedRef.current = true;
          }}
          onBlur={(event) => {
            if (
              event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              return;
            void saveDescription();
          }}
          onKeyDownCapture={(event) => {
            if (event.key !== 'Escape') return;
            if (
              (event.target as HTMLElement).closest(
                '[data-rich-text-link-editor]',
              )
            )
              return;
            event.preventDefault();
            event.stopPropagation();
            setDraft(description);
            setDirty(false);
          }}
        >
          <Label id={`${descriptionId}-field-label`} className="sr-only">
            Descrição da tarefa
          </Label>
          <RichTextEditor
            value={draft}
            labelledBy={`${descriptionId}-field-label`}
            disabled={saving}
            onChange={(value) => {
              if (!editorFocusedRef.current) return;
              setDraft(value);
              setDirty(!taskDescriptionsEqual(value, description));
            }}
            onSaveShortcut={() => void saveDescription()}
            editorClassName="min-h-28 sm:min-h-32"
          />
          <div className="mt-2 flex min-h-5 justify-end text-xs text-muted-foreground">
            {saving
              ? 'Salvando…'
              : dirty
                ? 'Alterações pendentes · Ctrl + Enter para salvar'
                : 'Salvo automaticamente'}
          </div>
        </div>
      ) : (
        <div className="mt-2 min-h-16 max-w-[76ch] rounded-xl px-3 py-3 text-[15px] leading-6 text-muted-foreground">
          {hasTaskDescriptionContent(description) ? (
            <RichTextViewer value={description} />
          ) : (
            <p>Adicione contexto, briefing, links e critérios importantes.</p>
          )}
        </div>
      )}
    </section>
  );
}

function ChecklistSection({
  taskId,
  checklists,
  canManageStructure,
  supportsTaskSteps,
  canManageTaskSteps,
  canToggle,
  onRefresh,
}: {
  taskId: string;
  checklists: TaskChecklist[];
  canManageStructure: boolean;
  supportsTaskSteps: boolean;
  canManageTaskSteps: boolean;
  canToggle: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [creatingList, setCreatingList] = useState(false);
  const [addingQuickItem, setAddingQuickItem] = useState(false);
  const [listTitle, setListTitle] = useState('');
  const [addingTo, setAddingTo] = useState<string>();
  const [itemContent, setItemContent] = useState('');
  const [savingStructure, setSavingStructure] = useState(false);
  const [editingList, setEditingList] = useState<TaskChecklist>();
  const [editingItem, setEditingItem] =
    useState<TaskChecklist['items'][number]>();
  const [removingList, setRemovingList] = useState<TaskChecklist>();
  const [removingItem, setRemovingItem] = useState<TaskChecklistItem>();
  const [editValue, setEditValue] = useState('');
  const [pendingToggles, setPendingToggles] = useState<Record<string, boolean>>(
    {},
  );
  const sectionId = useId();

  async function createChecklist() {
    const title = listTitle.trim();
    if (!title) return;
    setSavingStructure(true);
    const { error } = await createClient().rpc('create_task_checklist', {
      p_task_id: taskId,
      p_title: title,
    });
    if (error) {
      toast.error(
        taskStructureError(error.message, 'Não foi possível criar a lista.'),
      );
    } else {
      setListTitle('');
      setCreatingList(false);
    }
    await onRefresh();
    setSavingStructure(false);
  }

  async function addItem(checklistId: string) {
    const content = itemContent.trim();
    if (!content) return;
    setSavingStructure(true);
    const { error } = await createClient().rpc('add_task_checklist_item', {
      p_checklist_id: checklistId,
      p_content: content,
    });
    if (error) {
      toast.error(
        taskStructureError(error.message, 'Não foi possível adicionar o item.'),
      );
    } else {
      setItemContent('');
      setAddingTo(undefined);
    }
    await onRefresh();
    setSavingStructure(false);
  }

  async function addQuickItem() {
    const content = itemContent.trim();
    if (!content) return;
    setSavingStructure(true);
    const { error } = await createClient().rpc(
      'add_task_checklist_item_to_task',
      { p_task_id: taskId, p_content: content },
    );
    if (error) {
      toast.error(
        taskStructureError(
          error.message,
          'Não foi possível adicionar o passo.',
        ),
      );
    } else {
      setItemContent('');
      setAddingQuickItem(false);
    }
    await onRefresh();
    setSavingStructure(false);
  }

  async function saveListTitle() {
    const title = editValue.trim();
    if (!editingList || !title) return;
    setSavingStructure(true);
    const { error } = await createClient().rpc('update_task_checklist', {
      p_checklist_id: editingList.id,
      p_title: title,
      p_expected_updated_at: editingList.updated_at,
    });
    if (error) {
      toast.error(
        taskStructureError(error.message, 'Não foi possível renomear a seção.'),
      );
    } else {
      setEditingList(undefined);
      setEditValue('');
    }
    await onRefresh();
    setSavingStructure(false);
  }

  async function saveItemContent() {
    const content = editValue.trim();
    if (!editingItem || !content) return;
    setSavingStructure(true);
    const { error } = await createClient().rpc('update_task_checklist_item', {
      p_item_id: editingItem.id,
      p_content: content,
      p_expected_updated_at: editingItem.updated_at,
    });
    if (error) {
      toast.error(
        taskStructureError(error.message, 'Não foi possível editar o passo.'),
      );
    } else {
      setEditingItem(undefined);
      setEditValue('');
    }
    await onRefresh();
    setSavingStructure(false);
  }

  async function toggleItem(itemId: string, isCompleted: boolean) {
    setPendingToggles((current) => ({ ...current, [itemId]: isCompleted }));
    const { error } = await createClient().rpc('toggle_task_checklist_item', {
      p_item_id: itemId,
      p_is_completed: isCompleted,
    });
    if (error) toast.error('Não foi possível atualizar o item.');
    await onRefresh();
    setPendingToggles((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }

  async function removeItem() {
    if (!removingItem) return;
    setSavingStructure(true);
    const { error } = await createClient().rpc('remove_task_checklist_item', {
      p_item_id: removingItem.id,
      p_expected_updated_at: removingItem.updated_at,
    });
    if (error) {
      toast.error(
        taskStructureError(
          error.message,
          'Não foi possível excluir este passo.',
        ),
      );
    } else {
      setRemovingItem(undefined);
      setEditingItem(undefined);
      toast.success('Passo excluído.');
    }
    await onRefresh();
    setSavingStructure(false);
  }

  async function removeChecklist() {
    if (!removingList) return;
    setSavingStructure(true);
    const { error } = await createClient().rpc('remove_task_checklist', {
      p_checklist_id: removingList.id,
      p_expected_updated_at: removingList.updated_at,
    });
    if (error) {
      toast.error(
        taskStructureError(
          error.message,
          'Não foi possível excluir esta seção.',
        ),
      );
    } else {
      setRemovingList(undefined);
      setEditingList(undefined);
      toast.success('Seção e seus passos foram excluídos.');
    }
    await onRefresh();
    setSavingStructure(false);
  }

  return (
    <section className="border-t py-7" aria-labelledby={`${sectionId}-title`}>
      <SectionHeading
        id={`${sectionId}-title`}
        icon={CheckCircle2}
        title="Checklist"
        meta={checklistProgress(checklists)}
        action={
          canManageStructure ? (
            <div className="flex flex-wrap items-center justify-end gap-1">
              {supportsTaskSteps && !addingQuickItem ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setItemContent('');
                    setAddingTo(undefined);
                    setAddingQuickItem(true);
                  }}
                >
                  <Plus aria-hidden="true" />
                  Adicionar passo
                </Button>
              ) : null}
              {!creatingList ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setCreatingList(true)}
                >
                  Nova seção
                </Button>
              ) : null}
            </div>
          ) : null
        }
      />

      {addingQuickItem ? (
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void addQuickItem();
          }}
        >
          <Label htmlFor={`${sectionId}-quick-item`} className="sr-only">
            Novo passo
          </Label>
          <Input
            id={`${sectionId}-quick-item`}
            value={itemContent}
            maxLength={500}
            autoFocus
            disabled={savingStructure}
            placeholder="Ex.: validar as imagens finais"
            onChange={(event) => setItemContent(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={savingStructure}
              onClick={() => {
                setItemContent('');
                setAddingQuickItem(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={savingStructure || !itemContent.trim()}
            >
              Adicionar
            </Button>
          </div>
        </form>
      ) : null}

      {checklists.some((checklist) => checklist.items.length > 0) ? (
        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Progresso do checklist"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={checklistPercentage(checklists)}
        >
          <span
            className="block h-full rounded-full bg-emerald-600 transition-[width] dark:bg-emerald-400"
            style={{ width: `${checklistPercentage(checklists)}%` }}
          />
        </div>
      ) : null}

      {creatingList ? (
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void createChecklist();
          }}
        >
          <Label htmlFor={`${sectionId}-new-list`} className="sr-only">
            Nome da nova seção
          </Label>
          <Input
            id={`${sectionId}-new-list`}
            value={listTitle}
            maxLength={200}
            autoFocus
            disabled={savingStructure}
            placeholder="Ex.: Aprovação final"
            onChange={(event) => setListTitle(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={savingStructure}
              onClick={() => {
                setListTitle('');
                setCreatingList(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={savingStructure || !listTitle.trim()}
            >
              {savingStructure ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              Criar
            </Button>
          </div>
        </form>
      ) : null}

      {checklists.length ? (
        <div className="mt-4 divide-y">
          {checklists.map((checklist) => {
            const completed = checklist.items.filter(
              (item) => item.is_completed,
            ).length;
            return (
              <div key={checklist.id} className="py-4 first:pt-0 last:pb-0">
                {checklist.is_default && checklists.length === 1 ? null : (
                  <div className="flex items-baseline justify-between gap-4">
                    {checklist.is_default ? (
                      <h3 className="sr-only">Checklist principal</h3>
                    ) : editingList?.id === checklist.id ? (
                      <form
                        className="flex min-w-0 flex-1 gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveListTitle();
                        }}
                      >
                        <Input
                          value={editValue}
                          maxLength={200}
                          autoFocus
                          disabled={savingStructure}
                          aria-label="Nome da seção"
                          onChange={(event) => setEditValue(event.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={savingStructure}
                          onClick={() => {
                            setEditingList(undefined);
                            setEditValue('');
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={savingStructure || !editValue.trim()}
                        >
                          Salvar
                        </Button>
                      </form>
                    ) : (
                      <div className="flex min-w-0 items-center gap-1">
                        <h3 className="truncate text-sm font-semibold">
                          {checklist.title}
                        </h3>
                        {canManageStructure && supportsTaskSteps ? (
                          <span className="flex items-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Renomear ${checklist.title}`}
                              onClick={() => {
                                setEditingList(checklist);
                                setEditingItem(undefined);
                                setEditValue(checklist.title);
                              }}
                            >
                              <Pencil aria-hidden="true" />
                            </Button>
                            {canManageTaskSteps ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="text-muted-foreground hover:text-destructive"
                                aria-label={`Excluir seção ${checklist.title}`}
                                onClick={() => setRemovingList(checklist)}
                              >
                                <Trash2 aria-hidden="true" />
                              </Button>
                            ) : null}
                          </span>
                        ) : null}
                      </div>
                    )}
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {completed} de {checklist.items.length}
                    </span>
                  </div>
                )}
                {checklist.items.length ? (
                  <ul className="mt-3 space-y-1">
                    {checklist.items.map((item) => {
                      const checked =
                        pendingToggles[item.id] ?? item.is_completed;
                      const isPending = item.id in pendingToggles;
                      return (
                        <li
                          key={item.id}
                          className="flex min-h-10 items-start gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-pta-blue/[0.045]"
                        >
                          {canToggle ? (
                            <Checkbox
                              id={`${sectionId}-${item.id}`}
                              checked={checked}
                              disabled={isPending}
                              aria-label={`${checked ? 'Reabrir' : 'Concluir'} ${item.content}`}
                              onCheckedChange={(value) =>
                                void toggleItem(item.id, value === true)
                              }
                            />
                          ) : checked ? (
                            <CheckCircle2
                              aria-hidden="true"
                              className="mt-px size-4 shrink-0 text-primary"
                            />
                          ) : (
                            <Circle
                              aria-hidden="true"
                              className="mt-px size-4 shrink-0 text-muted-foreground"
                            />
                          )}
                          {editingItem?.id === item.id ? (
                            <form
                              className="flex min-w-0 flex-1 gap-2"
                              onSubmit={(event) => {
                                event.preventDefault();
                                void saveItemContent();
                              }}
                            >
                              <Input
                                value={editValue}
                                maxLength={500}
                                autoFocus
                                disabled={savingStructure}
                                aria-label="Editar passo"
                                onChange={(event) =>
                                  setEditValue(event.target.value)
                                }
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={savingStructure}
                                onClick={() => {
                                  setEditingItem(undefined);
                                  setEditValue('');
                                }}
                              >
                                Cancelar
                              </Button>
                              <Button
                                type="submit"
                                size="sm"
                                disabled={savingStructure || !editValue.trim()}
                              >
                                Salvar
                              </Button>
                            </form>
                          ) : (
                            <>
                              <span
                                className={cn(
                                  'min-w-0 flex-1 text-sm leading-5 [overflow-wrap:anywhere]',
                                  checked &&
                                    'text-muted-foreground line-through decoration-emerald-600/55',
                                )}
                              >
                                {item.content}
                              </span>
                              {canManageStructure && supportsTaskSteps ? (
                                <span className="flex shrink-0 items-center">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-xs"
                                    className="opacity-70 hover:opacity-100"
                                    aria-label={`Editar ${item.content}`}
                                    onClick={() => {
                                      setEditingItem(item);
                                      setEditingList(undefined);
                                      setEditValue(item.content);
                                    }}
                                  >
                                    <Pencil aria-hidden="true" />
                                  </Button>
                                  {canManageTaskSteps ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-xs"
                                      className="text-muted-foreground opacity-70 hover:text-destructive hover:opacity-100"
                                      aria-label={`Excluir ${item.content}`}
                                      onClick={() => setRemovingItem(item)}
                                    >
                                      <Trash2 aria-hidden="true" />
                                    </Button>
                                  ) : null}
                                </span>
                              ) : null}
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Esta lista ainda não tem itens.
                  </p>
                )}

                {canManageStructure && !checklist.is_default ? (
                  addingTo === checklist.id ? (
                    <form
                      className="mt-3 flex flex-col gap-2 sm:flex-row"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void addItem(checklist.id);
                      }}
                    >
                      <Label
                        htmlFor={`${sectionId}-item-${checklist.id}`}
                        className="sr-only"
                      >
                        Novo item em {checklist.title}
                      </Label>
                      <Input
                        id={`${sectionId}-item-${checklist.id}`}
                        value={itemContent}
                        maxLength={500}
                        autoFocus
                        disabled={savingStructure}
                        placeholder="Descreva o próximo passo"
                        onChange={(event) => setItemContent(event.target.value)}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={savingStructure}
                          onClick={() => {
                            setItemContent('');
                            setAddingTo(undefined);
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          disabled={savingStructure || !itemContent.trim()}
                        >
                          Adicionar
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-muted-foreground"
                      onClick={() => {
                        setItemContent('');
                        setAddingQuickItem(false);
                        setAddingTo(checklist.id);
                      }}
                    >
                      <Plus aria-hidden="true" />
                      Adicionar item
                    </Button>
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      ) : creatingList ? null : (
        <p className="mt-3 text-sm text-muted-foreground">
          Adicione passos rápidos ou crie seções quando precisar organizar uma
          entrega maior.
        </p>
      )}

      <AlertDialog
        open={Boolean(removingItem)}
        onOpenChange={(open) => {
          if (!open && !savingStructure) setRemovingItem(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este passo?</AlertDialogTitle>
            <AlertDialogDescription>
              “{removingItem?.content}” será removido do checklist. Esta ação
              não altera os demais passos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingStructure}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={savingStructure}
              onClick={(event) => {
                event.preventDefault();
                void removeItem();
              }}
            >
              {savingStructure ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              Excluir passo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(removingList)}
        onOpenChange={(open) => {
          if (!open && !savingStructure) setRemovingList(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta seção?</AlertDialogTitle>
            <AlertDialogDescription>
              A seção “{removingList?.title}” e seus{' '}
              {removingList?.items.length ?? 0} passos serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingStructure}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={savingStructure}
              onClick={(event) => {
                event.preventDefault();
                void removeChecklist();
              }}
            >
              {savingStructure ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              Excluir seção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function SubtasksSection({
  task,
  subtasks,
  parentTask,
  members,
  workspaceRole,
  currentUserId,
  taskPrefix,
  canCreate,
  canUnlink,
  onRefresh,
}: {
  task: TaskDetailTask;
  subtasks: TaskOverview[];
  parentTask: TaskOverview | null;
  members: WorkspaceMember[];
  workspaceRole: WorkspaceRole;
  currentUserId: string;
  taskPrefix: string;
  canCreate: boolean;
  canUnlink: boolean;
  onRefresh: () => Promise<void>;
}) {
  const completed = subtasks.filter(
    (subtask) => subtask.status_category === 'done',
  ).length;
  const sectionId = useId();
  const [unlinking, setUnlinking] = useState<TaskOverview>();
  const [saving, setSaving] = useState(false);

  async function unlinkSubtask() {
    if (!unlinking) return;
    setSaving(true);
    const { error } = await createClient().rpc('unlink_task_subtask', {
      p_parent_task_id: task.id,
      p_child_task_id: unlinking.id,
      p_expected_parent_version: task.version,
    });
    if (error) {
      toast.error(
        taskStructureError(
          error.message,
          'Não foi possível desvincular esta tarefa.',
        ),
      );
    } else {
      setUnlinking(undefined);
      toast.success(
        'Tarefa desvinculada. Ela continua disponível no workspace.',
      );
    }
    await onRefresh();
    setSaving(false);
  }

  return (
    <section aria-labelledby={`${sectionId}-title`}>
      <SectionHeading
        id={`${sectionId}-title`}
        icon={GitBranch}
        title="Tarefas vinculadas"
        meta={
          subtasks.length ? `${completed} de ${subtasks.length}` : undefined
        }
        action={
          canCreate ? (
            <NewTaskDialog
              workspaceId={task.workspace_id}
              taskPrefix={taskPrefix}
              members={members}
              role={workspaceRole}
              currentUserId={currentUserId}
              parentTaskId={task.id}
              initialTypeId={task.type_id}
              initialProductId={task.product_id}
              initialEventId={task.event_id}
              navigateAfterCreate={false}
              onCreated={onRefresh}
              trigger={
                <Button type="button" variant="ghost" size="sm">
                  <Plus aria-hidden="true" />
                  Delegar entrega
                </Button>
              }
            />
          ) : null
        }
      />

      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Crie uma tarefa completa para outra pessoa. Projeto, prazo, comentários,
        links e histórico permanecem próprios e podem ser acompanhados daqui.
      </p>

      {parentTask ? (
        <Link
          href={`/tarefa/${parentTask.id}`}
          scroll={false}
          className="mt-4 flex min-h-12 items-center gap-3 rounded-xl border bg-muted/25 px-4 py-3 transition-colors hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GitBranch
            aria-hidden="true"
            className="size-4 shrink-0 text-primary"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-muted-foreground">
              Faz parte de
            </span>
            <span className="block truncate text-sm font-semibold">
              {parentTask.title}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">Abrir</span>
        </Link>
      ) : null}

      {subtasks.length ? (
        <ul className="mt-4 divide-y rounded-2xl border bg-muted/[0.12] px-3 sm:px-4">
          {subtasks.map((subtask) => (
            <li key={subtask.id} className="flex min-w-0 items-center gap-1">
              <Link
                href={`/tarefa/${subtask.id}`}
                scroll={false}
                className="group flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-lg py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: subtask.status_color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold group-hover:text-primary">
                    {subtask.title}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{subtask.status_name}</span>
                    <span>
                      {subtask.primary_assignee_name ?? 'Sem responsável'}
                    </span>
                    {subtask.due_date ? (
                      <time dateTime={subtask.due_date}>
                        {formatTaskDate(subtask.due_date)}
                      </time>
                    ) : null}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-medium text-primary opacity-70 group-hover:opacity-100">
                  Abrir
                </span>
              </Link>
              {canUnlink ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Desvincular ${subtask.title}`}
                  onClick={() => setUnlinking(subtask)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed px-5 py-6 text-sm text-muted-foreground">
          Nenhuma entrega delegada. Use o checklist para passos simples e crie
          uma tarefa vinculada quando outra pessoa precisar de contexto e
          acompanhamento próprios.
        </div>
      )}

      <AlertDialog
        open={Boolean(unlinking)}
        onOpenChange={(open) => {
          if (!open && !saving) setUnlinking(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular esta tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              “{unlinking?.title}” deixará de aparecer nesta seção, mas
              continuará existindo com responsável, comentários, links e
              histórico próprios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={saving}
              onClick={(event) => {
                event.preventDefault();
                void unlinkSubtask();
              }}
            >
              {saving ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function LinksSection({
  taskId,
  links,
  canAdd,
  onRefresh,
}: {
  taskId: string;
  links: TaskLink[];
  canAdd: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TaskLink>();
  const [removing, setRemoving] = useState<TaskLink>();
  const [busy, setBusy] = useState(false);
  const sectionId = useId();

  async function saveLink(values: LinkValues) {
    setBusy(true);
    const client = createClient();
    const result = editing
      ? await client.rpc('update_task_link', {
          p_link_id: editing.id,
          p_url: values.url,
          p_label: values.label || undefined,
        })
      : await client.rpc('add_task_link', {
          p_task_id: taskId,
          p_url: values.url,
          p_label: values.label || undefined,
        });
    if (result.error) {
      toast.error('Não foi possível salvar o link.');
    } else {
      setCreating(false);
      setEditing(undefined);
    }
    await onRefresh();
    setBusy(false);
  }

  async function removeLink() {
    if (!removing) return;
    setBusy(true);
    const { error } = await createClient().rpc('remove_task_link', {
      p_link_id: removing.id,
    });
    if (error) toast.error('Não foi possível remover o link.');
    setRemoving(undefined);
    await onRefresh();
    setBusy(false);
  }

  return (
    <section aria-labelledby={`${sectionId}-title`}>
      <SectionHeading
        id={`${sectionId}-title`}
        icon={Link2}
        title="Links e arquivos"
        meta={links.length ? String(links.length) : undefined}
        action={
          canAdd && !creating && !editing ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCreating(true)}
            >
              <Plus aria-hidden="true" />
              Adicionar link
            </Button>
          ) : null
        }
      />

      {creating || editing ? (
        <LinkForm
          key={editing?.id ?? 'new-link'}
          id={sectionId}
          initialLink={editing}
          busy={busy}
          onCancel={() => {
            setCreating(false);
            setEditing(undefined);
          }}
          onSubmit={saveLink}
        />
      ) : null}

      {links.length ? (
        <ul className="mt-4 space-y-2">
          {links.map((link) => {
            const parsedLink = parseHttpsLink(link.url);
            const linkName =
              link.label ?? parsedLink?.hostname ?? 'Link indisponível';
            return (
              <li
                key={link.id}
                className="group rounded-xl border bg-muted/30 p-2 transition-[border-color,background-color] hover:border-pta-blue/30 hover:bg-pta-blue/[0.035]"
              >
                <div className="flex min-h-12 items-center gap-2">
                  <span
                    className={cn(
                      'grid size-10 shrink-0 place-items-center rounded-xl',
                      providerTone(link.provider),
                    )}
                  >
                    <Link2 aria-hidden="true" className="size-4" />
                  </span>
                  {parsedLink ? (
                    <a
                      href={parsedLink.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-pta-blue/35"
                    >
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground group-hover:text-pta-blue">
                        <span className="truncate">{linkName}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {providerLabel(link.provider)}
                      </span>
                    </a>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{linkName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Endereço inválido
                      </p>
                    </div>
                  )}
                  {parsedLink ? (
                    <ExternalLink
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-pta-blue"
                    />
                  ) : null}
                  {link.can_edit_link ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Editar ${linkName}`}
                      onClick={() => setEditing(link)}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                  ) : null}
                  {link.can_delete_link ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remover ${linkName}`}
                      className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => setRemoving(link)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : creating ? null : (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhum arquivo ou link adicionado.
        </p>
      )}

      <AlertDialog
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open && !busy) setRemoving(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este link?</AlertDialogTitle>
            <AlertDialogDescription>
              O link deixará de aparecer nesta tarefa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void removeLink();
              }}
            >
              {busy ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

type LinkValues = { url: string; label: string };

function LinkForm({
  id,
  initialLink,
  busy,
  onCancel,
  onSubmit,
}: {
  id: string;
  initialLink?: TaskLink;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: LinkValues) => Promise<void>;
}) {
  const [url, setUrl] = useState(initialLink?.url ?? '');
  const [label, setLabel] = useState(initialLink?.label ?? '');
  const [error, setError] = useState<string>();

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const cleanUrl = url.trim();
        const validationError = validateHttpsUrl(cleanUrl);
        if (validationError) {
          setError(validationError);
          return;
        }
        setError(undefined);
        void onSubmit({ url: cleanUrl, label: label.trim() });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-link-url`}>Endereço HTTPS</Label>
        <Input
          id={`${id}-link-url`}
          type="url"
          inputMode="url"
          value={url}
          maxLength={2048}
          autoFocus
          disabled={busy}
          placeholder="https://drive.google.com/..."
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-link-error` : undefined}
          onChange={(event) => {
            setUrl(event.target.value);
            if (error) setError(undefined);
          }}
        />
        {error ? (
          <p id={`${id}-link-error`} className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-link-label`}>
          Nome do arquivo ou referência
        </Label>
        <Input
          id={`${id}-link-label`}
          value={label}
          maxLength={200}
          disabled={busy}
          placeholder="Ex.: Briefing aprovado"
          onChange={(event) => setLabel(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={busy || !url.trim()}>
          {busy ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : null}
          Salvar link
        </Button>
      </div>
    </form>
  );
}

function CommentsSection({
  workspaceId,
  taskId,
  comments,
  commentsPage,
  activity,
  members,
  canComment,
  onRefresh,
  panel = false,
}: {
  workspaceId: string;
  taskId: string;
  comments: TaskComment[];
  commentsPage: TaskCommentsPageInfo;
  activity: TaskActivity[];
  members: WorkspaceMember[];
  canComment: boolean;
  onRefresh: () => Promise<void>;
  panel?: boolean;
}) {
  const [body, setBody] = useState('');
  const [mutation, setMutation] = useState<string>();
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [editing, setEditing] = useState<TaskComment>();
  const [editBody, setEditBody] = useState('');
  const [replying, setReplying] = useState<TaskComment>();
  const [replyBody, setReplyBody] = useState('');
  const [deleting, setDeleting] = useState<TaskComment>();
  const [feed, setFeed] = useState(() => ({
    taskId,
    comments: [] as TaskComment[],
    page: commentsPage,
    loadedEarlier: false,
  }));
  const sectionId = useId();
  const queryClient = useQueryClient();
  const visibleComments =
    feed.taskId === taskId
      ? mergeCommentPages(feed.comments, comments)
      : comments;
  const visiblePage =
    feed.taskId === taskId && feed.loadedEarlier ? feed.page : commentsPage;
  const commentsById = new Map(
    visibleComments.map((comment) => [comment.id, comment]),
  );

  async function addComment(parent?: TaskComment) {
    if (mutation) return;
    const cleanBody = (parent ? replyBody : body).trim();
    if (!cleanBody) return;
    setMutation(parent ? `reply:${parent.id}` : 'new');
    const { error } = await createClient().rpc('add_task_comment', {
      p_task_id: taskId,
      p_body: cleanBody,
      ...(parent ? { p_parent_comment_id: parent.id } : {}),
    });
    if (error) {
      toast.error(
        parent
          ? 'Não foi possível publicar a resposta.'
          : 'Não foi possível publicar o comentário.',
      );
    } else {
      if (parent) {
        setReplyBody('');
        setReplying(undefined);
      } else {
        setBody('');
      }
    }
    await onRefresh();
    setMutation(undefined);
  }

  async function editComment() {
    if (!editing || mutation) return;
    const cleanBody = editBody.trim();
    if (!cleanBody) return;
    if (cleanBody === editing.body) {
      setEditing(undefined);
      setEditBody('');
      return;
    }

    setMutation(`edit:${editing.id}`);
    const { error } = await createClient().rpc('update_task_comment', {
      p_comment_id: editing.id,
      p_body: cleanBody,
    });
    if (error) {
      toast.error('Não foi possível editar o comentário.');
    } else {
      const editedAt = new Date().toISOString();
      updateCommentInFeed(editing.id, (comment) => ({
        ...comment,
        body: cleanBody,
        updated_at: editedAt,
        edited_at: editedAt,
      }));
      setEditing(undefined);
      setEditBody('');
    }
    await onRefresh();
    setMutation(undefined);
  }

  async function deleteComment() {
    if (!deleting || mutation) return;
    setMutation(`delete:${deleting.id}`);
    const { error } = await createClient().rpc('delete_task_comment', {
      p_comment_id: deleting.id,
    });
    if (error) {
      toast.error('Não foi possível excluir o comentário.');
    } else {
      const deletedAt = new Date().toISOString();
      updateCommentInFeed(deleting.id, (comment) => ({
        ...comment,
        body: null,
        is_deleted: true,
        deleted_at: deletedAt,
        can_edit_comment: false,
        can_delete_comment: false,
      }));
    }
    setDeleting(undefined);
    await onRefresh();
    setMutation(undefined);
  }

  async function loadEarlierComments() {
    if (loadingEarlier || !visiblePage.next_cursor) return;
    setLoadingEarlier(true);
    try {
      const page = await fetchTaskCommentsPage(taskId, visiblePage.next_cursor);
      queryClient.setQueryData<TaskDetailPayload>(
        taskKeys.detail(workspaceId, taskId),
        (current) =>
          current
            ? {
                ...current,
                collaboration: {
                  ...current.collaboration,
                  comments: mergeCommentPages(
                    current.collaboration.comments,
                    page.comments,
                  ),
                },
              }
            : current,
      );
      setFeed((current) => ({
        taskId,
        comments: mergeCommentPages(
          page.comments,
          current.taskId === taskId ? current.comments : [],
        ),
        page: {
          has_more: page.has_more,
          next_cursor: page.next_cursor,
        },
        loadedEarlier: true,
      }));
    } catch {
      toast.error('Não foi possível carregar os comentários anteriores.');
    } finally {
      setLoadingEarlier(false);
    }
  }

  function updateCommentInFeed(
    commentId: string,
    update: (comment: TaskComment) => TaskComment,
  ) {
    queryClient.setQueryData<TaskDetailPayload>(
      taskKeys.detail(workspaceId, taskId),
      (current) =>
        current
          ? {
              ...current,
              collaboration: {
                ...current.collaboration,
                comments: current.collaboration.comments.map((comment) =>
                  comment.id === commentId ? update(comment) : comment,
                ),
              },
            }
          : current,
    );
    setFeed((current) => ({
      ...(current.taskId === taskId
        ? current
        : {
            taskId,
            comments: [] as TaskComment[],
            page: commentsPage,
            loadedEarlier: false,
          }),
      comments: mergeCommentPages(
        (current.taskId === taskId ? current.comments : []).map((comment) =>
          comment.id === commentId ? update(comment) : comment,
        ),
      ),
    }));
  }

  const commentComposer = canComment ? (
    <form
      className="mt-4 rounded-xl border bg-card p-2 shadow-[0_8px_28px_rgb(8_30_50/6%)]"
      onSubmit={(event) => {
        event.preventDefault();
        void addComment();
      }}
    >
      <Label htmlFor={`${sectionId}-body`} className="sr-only">
        Novo comentário
      </Label>
      <Textarea
        id={`${sectionId}-body`}
        value={body}
        maxLength={10000}
        rows={2}
        disabled={Boolean(mutation)}
        placeholder="Escreva uma atualização para a equipe"
        className="min-h-11 resize-y border-0 bg-transparent shadow-none focus-visible:ring-0"
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-3 px-1 pb-1">
        <span
          className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline"
          title="Ctrl ou Cmd + Enter para publicar"
        >
          Ctrl + Enter
        </span>
        <Button
          type="submit"
          size="sm"
          disabled={Boolean(mutation) || !body.trim()}
        >
          {mutation === 'new' ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : null}
          Comentar
        </Button>
      </div>
    </form>
  ) : null;

  return (
    <section className="pb-3" aria-labelledby={`${sectionId}-title`}>
      <div
        className={cn(
          panel &&
            'sticky top-0 z-10 -mx-1 border-b bg-muted/95 px-1 pb-5 backdrop-blur-xl',
        )}
      >
        <SectionHeading
          id={`${sectionId}-title`}
          icon={MessageSquare}
          title={panel ? 'Comentários e atividade' : 'Atividade'}
          meta={
            !panel && (visibleComments.length || activity.length)
              ? interactionCountLabel(visibleComments.length + activity.length)
              : undefined
          }
        />
        {panel ? commentComposer : null}
      </div>

      {activity.length ? (
        <ol className="mt-4 space-y-1">
          {activity.map((item) => {
            const actor = members.find((member) => member.id === item.actor_id);
            return (
              <li
                key={item.id}
                className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-xl px-1 py-2"
              >
                <span className="grid size-7 place-items-center rounded-full bg-muted text-xs font-semibold ring-1 ring-border">
                  {personInitials(actor?.fullName ?? null)}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] leading-5">
                    {actor?.fullName ? (
                      <strong>{actor.fullName} </strong>
                    ) : null}
                    {taskActivityLabel(item.action)}
                  </p>
                  <time
                    className="mt-0.5 block text-xs text-muted-foreground"
                    dateTime={item.created_at}
                  >
                    {DATE_TIME_FORMATTER.format(new Date(item.created_at))}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}

      {!panel ? commentComposer : null}

      {visiblePage.has_more && visiblePage.next_cursor ? (
        <div className="mt-6 border-b pb-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loadingEarlier}
            onClick={() => void loadEarlierComments()}
          >
            {loadingEarlier ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : null}
            {loadingEarlier ? 'Carregando…' : 'Carregar anteriores'}
          </Button>
        </div>
      ) : null}

      {visibleComments.length ? (
        <ol className="mt-2">
          {visibleComments.map((comment) => {
            const parent = comment.parent_comment_id
              ? commentsById.get(comment.parent_comment_id)
              : undefined;
            const isEditing = editing?.id === comment.id;
            const isReplying = replying?.id === comment.id;
            return (
              <li
                key={comment.id}
                className={cn(
                  'border-t py-5 first:border-t-0',
                  comment.parent_comment_id && 'ml-6 border-l pl-4 sm:ml-10',
                )}
              >
                {comment.parent_comment_id ? (
                  <p className="mb-2 text-xs text-muted-foreground">
                    Resposta a {parent?.author_name ?? 'comentário anterior'}
                  </p>
                ) : null}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {comment.author_name ?? 'Pessoa da equipe'}
                    </p>
                    <time
                      className="mt-0.5 block text-xs text-muted-foreground"
                      dateTime={comment.created_at}
                    >
                      {formatDateTime(comment.created_at)}
                    </time>
                    {comment.edited_at ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Editado
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {canComment &&
                    !comment.parent_comment_id &&
                    !comment.is_deleted ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={Boolean(mutation)}
                        onClick={() => {
                          setEditing(undefined);
                          setEditBody('');
                          setReplyBody('');
                          setReplying(comment);
                        }}
                      >
                        <Reply aria-hidden="true" />
                        Responder
                      </Button>
                    ) : null}
                    {canComment && comment.can_edit_comment ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={Boolean(mutation)}
                        onClick={() => {
                          setReplying(undefined);
                          setReplyBody('');
                          setEditBody(comment.body ?? '');
                          setEditing(comment);
                        }}
                      >
                        <Pencil aria-hidden="true" />
                        Editar
                      </Button>
                    ) : null}
                    {comment.can_delete_comment ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={Boolean(mutation)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Excluir comentário"
                        onClick={() => setDeleting(comment)}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                </div>

                {isEditing ? (
                  <form
                    className="mt-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void editComment();
                    }}
                  >
                    <Label
                      htmlFor={`${sectionId}-edit-${comment.id}`}
                      className="sr-only"
                    >
                      Editar comentário
                    </Label>
                    <Textarea
                      id={`${sectionId}-edit-${comment.id}`}
                      value={editBody}
                      maxLength={10000}
                      rows={3}
                      autoFocus
                      disabled={Boolean(mutation)}
                      className="min-h-24 resize-y"
                      onChange={(event) => setEditBody(event.target.value)}
                      onKeyDown={(event) => {
                        if (
                          event.key === 'Enter' &&
                          (event.ctrlKey || event.metaKey)
                        ) {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={Boolean(mutation)}
                        onClick={() => {
                          setEditing(undefined);
                          setEditBody('');
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={Boolean(mutation) || !editBody.trim()}
                      >
                        {mutation === `edit:${comment.id}` ? (
                          <LoaderCircle
                            aria-hidden="true"
                            className="animate-spin"
                          />
                        ) : null}
                        Salvar
                      </Button>
                    </div>
                  </form>
                ) : comment.is_deleted ? (
                  <p className="mt-3 text-sm italic text-muted-foreground">
                    Comentário removido.
                  </p>
                ) : (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">
                    {comment.body}
                  </p>
                )}

                {isReplying ? (
                  <form
                    className="mt-4 border-l pl-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void addComment(comment);
                    }}
                  >
                    <Label
                      htmlFor={`${sectionId}-reply-${comment.id}`}
                      className="sr-only"
                    >
                      Responder a {comment.author_name ?? 'comentário'}
                    </Label>
                    <Textarea
                      id={`${sectionId}-reply-${comment.id}`}
                      value={replyBody}
                      maxLength={10000}
                      rows={3}
                      autoFocus
                      disabled={Boolean(mutation)}
                      placeholder={`Responder a ${comment.author_name ?? 'esta pessoa'}`}
                      className="min-h-24 resize-y"
                      onChange={(event) => setReplyBody(event.target.value)}
                      onKeyDown={(event) => {
                        if (
                          event.key === 'Enter' &&
                          (event.ctrlKey || event.metaKey)
                        ) {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={Boolean(mutation)}
                        onClick={() => {
                          setReplying(undefined);
                          setReplyBody('');
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={Boolean(mutation) || !replyBody.trim()}
                      >
                        {mutation === `reply:${comment.id}` ? (
                          <LoaderCircle
                            aria-hidden="true"
                            className="animate-spin"
                          />
                        ) : null}
                        Responder
                      </Button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Ainda não há comentários.
        </p>
      )}

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open && !mutation) setDeleting(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este comentário?</AlertDialogTitle>
            <AlertDialogDescription>
              A mensagem será removida, mas o registro continuará no histórico
              da conversa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(mutation)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={Boolean(mutation)}
              onClick={(event) => {
                event.preventDefault();
                void deleteComment();
              }}
            >
              {mutation?.startsWith('delete:') ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function SectionHeading({
  id,
  icon: Icon,
  title,
  meta,
  action,
  visuallyHidden = false,
}: {
  id: string;
  icon: typeof AlignLeft;
  title: string;
  meta?: string;
  action?: React.ReactNode;
  visuallyHidden?: boolean;
}) {
  if (visuallyHidden) {
    return (
      <div className="relative">
        <h2 id={id} className="sr-only">
          {title}
        </h2>
        <div className="absolute right-0 top-0">{action}</div>
      </div>
    );
  }
  return (
    <div className="flex min-h-8 items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2">
        <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {meta ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {meta}
          </span>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function checklistProgress(checklists: TaskChecklist[]) {
  let completed = 0;
  let total = 0;
  for (const checklist of checklists) {
    for (const item of checklist.items) {
      total += 1;
      if (item.is_completed) completed += 1;
    }
  }
  return total ? `${completed} de ${total}` : undefined;
}

function checklistPercentage(checklists: TaskChecklist[]) {
  let completed = 0;
  let total = 0;
  for (const checklist of checklists) {
    for (const item of checklist.items) {
      total += 1;
      if (item.is_completed) completed += 1;
    }
  }
  return total ? Math.round((completed / total) * 100) : 0;
}

function providerTone(provider: string) {
  const normalized = provider.toLocaleLowerCase('pt-BR');
  if (normalized.includes('canva'))
    return 'bg-cyan-500/10 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300';
  if (normalized.includes('figma'))
    return 'bg-pta-purple/10 text-pta-purple dark:bg-pta-purple/20';
  if (normalized.includes('drive') || normalized.includes('google'))
    return 'bg-pta-blue/10 text-pta-blue dark:bg-pta-blue/20';
  return 'bg-muted text-muted-foreground';
}

function personInitials(name: string | null) {
  if (!name) return '•';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('pt-BR');
}

function taskActivityLabel(action: string) {
  return (
    (
      {
        'task.created': 'criou a tarefa.',
        'task.updated': 'atualizou as propriedades.',
        'task.assignee_added': 'adicionou um responsável.',
        'task.assignee_removed': 'removeu o responsável.',
        'task.assignee_changed': 'alterou o responsável.',
        'task.attachment_added': 'adicionou um arquivo.',
        'task.attachment_removed': 'removeu um arquivo.',
        'task.subtask_created': 'criou uma tarefa vinculada.',
        'task.subtask_unlinked': 'desvinculou uma tarefa.',
        'task.checklist_item_removed': 'removeu um passo do checklist.',
        'task.checklist_removed': 'removeu uma seção do checklist.',
      } as Record<string, string>
    )[action] ?? 'atualizou a tarefa.'
  );
}

function interactionCountLabel(count: number) {
  return `${count} ${count === 1 ? 'interação' : 'interações'}`;
}

function mergeCommentPages(...pages: TaskComment[][]) {
  const commentsById = new Map<string, TaskComment>();
  for (const page of pages) {
    for (const comment of page) commentsById.set(comment.id, comment);
  }
  return [...commentsById.values()].sort((left, right) => {
    const timeOrder =
      Date.parse(left.created_at) - Date.parse(right.created_at);
    return timeOrder || left.id.localeCompare(right.id);
  });
}

function validateHttpsUrl(value: string) {
  if (!value) return 'Informe um endereço.';
  if (value.length > 2048) return 'O endereço é muito longo.';
  if (!parseHttpsLink(value))
    return 'Use um endereço HTTPS válido, sem credenciais ou porta inválida.';
  return undefined;
}

function parseHttpsLink(value: string) {
  if (
    !value ||
    value.length > 2048 ||
    /\s|%0d|%0a/i.test(value) ||
    !HTTPS_LINK_PATTERN.test(value)
  )
    return null;
  try {
    const parsed = new URL(value);
    const port = parsed.port ? Number(parsed.port) : undefined;
    if (
      parsed.protocol !== 'https:' ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      (port !== undefined &&
        (!Number.isInteger(port) || port < 1 || port > 65535))
    )
      return null;
    return {
      href: parsed.href,
      hostname: parsed.hostname.replace(/^www\./, ''),
    };
  } catch {
    return null;
  }
}

function providerLabel(provider: string) {
  return (
    (
      {
        figma: 'Figma',
        canva: 'Canva',
        notion: 'Notion',
        google_drive: 'Google Drive',
        youtube: 'YouTube',
        loom: 'Loom',
        dropbox: 'Dropbox',
        link: 'Link',
      } as Record<string, string>
    )[provider] ?? 'Link'
  );
}

function formatDateTime(value: string) {
  return DATE_TIME_FORMATTER.format(new Date(value));
}

function formatTaskDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function taskStructureError(message: string, fallback: string) {
  if (message.includes('PTA_VERSION_CONFLICT'))
    return 'Esta estrutura mudou em outra sessão. Atualize a tarefa e tente novamente.';
  if (
    message.includes('Could not find the function') ||
    message.includes('PGRST202')
  )
    return 'A atualização do banco necessária para esta ação ainda não foi publicada.';
  return fallback;
}
