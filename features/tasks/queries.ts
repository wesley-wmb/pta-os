'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/client';

import { taskDescriptionSchema } from './rich-text';
import { coalesceRefresh, retainRealtime } from './shared-realtime';
import type {
  TaskComment,
  TaskCommentsCursor,
  TaskCommentsPage,
  TaskDetailPayload,
  TaskOverview,
} from './types';

const prioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
const statusCategorySchema = z.enum([
  'backlog',
  'todo',
  'in_progress',
  'review',
  'blocked',
  'done',
  'cancelled',
]);
const taskOverviewSchema = z.object({
  id: z.uuid(),
  workspace_id: z.uuid(),
  task_key: z.string().min(1),
  task_number: z.number().int().positive(),
  title: z.string().min(1),
  priority: prioritySchema,
  status_id: z.uuid(),
  status_name: z.string().min(1),
  status_category: statusCategorySchema,
  status_color: z.string(),
  due_date: z.string().nullable(),
  due_at: z.string().nullable(),
  due_time: z.string().nullable(),
  due_is_date_only: z.boolean(),
  week_position: z.number(),
  board_position: z
    .number()
    .optional()
    .transform((value) => value ?? 1000),
  week_lane: z.enum([
    'backlog',
    'emergency',
    'important',
    'scheduled',
    'delivered',
    'revision',
    'ideas',
    'discarded',
  ]),
  version: z.number().int().positive(),
  created_by: z.uuid(),
  created_at: z.string(),
  updated_at: z.string(),
  primary_assignee_id: z.uuid().nullable(),
  primary_assignee_name: z.string().nullable(),
  type_id: z.uuid().nullable().optional().transform(nullableValue),
  type_name: z.string().nullable().optional().transform(nullableValue),
  product_id: z.uuid().nullable().optional().transform(nullableValue),
  product_name: z.string().nullable().optional().transform(nullableValue),
  event_id: z.uuid().nullable().optional().transform(nullableValue),
  event_name: z.string().nullable().optional().transform(nullableValue),
  checklist_total: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .transform((value) => value ?? 0),
  checklist_completed: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .transform((value) => value ?? 0),
  comment_count: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .transform((value) => value ?? 0),
  description_preview: z
    .string()
    .max(240)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});
const taskChecklistItemSchema = z.object({
  id: z.uuid(),
  content: z.string(),
  position: z.number(),
  is_completed: z.boolean(),
  completed_by: z.uuid().nullable(),
  completed_by_name: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_by: z.uuid(),
  creator_name: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
const taskChecklistSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  is_default: z
    .boolean()
    .optional()
    .transform((value) => value ?? false),
  position: z.number(),
  created_by: z.uuid(),
  creator_name: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  items: z.array(taskChecklistItemSchema),
});
const taskCommentSchema = z.object({
  id: z.uuid(),
  parent_comment_id: z.uuid().nullable(),
  body: z.string().nullable(),
  created_by: z.uuid(),
  author_name: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  edited_at: z.string().nullable(),
  is_deleted: z.boolean(),
  deleted_at: z.string().nullable(),
  can_edit_comment: z.boolean(),
  can_delete_comment: z.boolean(),
});
const taskCommentRealtimeSchema = z.object({
  id: z.uuid(),
  task_id: z.uuid(),
  body: z.string().nullable(),
  updated_at: z.string(),
  edited_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
});
const taskCommentsCursorSchema = z.object({
  created_at: z.string(),
  id: z.uuid(),
});
const taskCommentsPageSchema = z.object({
  comments: z.array(taskCommentSchema).max(20),
  has_more: z.boolean(),
  next_cursor: taskCommentsCursorSchema.nullable(),
});
const taskLinkSchema = z.object({
  description: z.string().default(''),
  id: z.uuid(),
  url: z.string(),
  label: z.string().nullable(),
  provider: z.string().min(1).max(80),
  created_by: z.uuid(),
  author_name: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  can_edit_link: z.boolean(),
  can_delete_link: z.boolean(),
});
const taskDetailSchema = z.object({
  task: taskOverviewSchema.extend({
    description_json: taskDescriptionSchema,
    requester_id: z.uuid().nullable().optional().transform(nullableValue),
    requester_name: z.string().nullable().optional().transform(nullableValue),
  }),
  activity: z.array(
    z.object({
      id: z.uuid(),
      actor_id: z.uuid().nullable(),
      action: z.string(),
      changes_json: z.record(z.string(), z.unknown()),
      metadata_json: z.record(z.string(), z.unknown()),
      created_at: z.string(),
    }),
  ),
  collaboration: z.object({
    checklists: z.array(taskChecklistSchema),
    comments: z.array(taskCommentSchema).max(20),
    comments_page: taskCommentsPageSchema.omit({ comments: true }),
    links: z.array(taskLinkSchema),
  }),
  custom_fields: z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string().min(1),
        type: z.enum(['text', 'number', 'date', 'boolean', 'single_select']),
        position: z.number(),
        version: z.number().int().positive(),
        value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
        options: z.array(
          z.object({
            id: z.uuid(),
            label: z.string().min(1),
          }),
        ),
      }),
    )
    .optional()
    .transform((value) => value ?? []),
  subtasks: z
    .array(taskOverviewSchema)
    .optional()
    .transform((value) => value ?? []),
  parent_task: taskOverviewSchema
    .nullable()
    .optional()
    .transform(nullableValue),
  capabilities: z
    .object({
      can_edit: z.boolean(),
      can_manage_assignees: z.boolean(),
      can_manage_custom_fields: z
        .boolean()
        .optional()
        .transform((value) => value ?? false),
      can_edit_custom_field_values: z
        .boolean()
        .optional()
        .transform((value) => value ?? false),
      can_edit_description: z.boolean(),
      can_manage_checklist_structure: z.boolean(),
      can_toggle_checklist: z.boolean(),
      can_comment: z.boolean(),
      can_add_link: z.boolean(),
      can_remove_any_link: z.boolean(),
      can_create_subtask: z.boolean().optional(),
      can_manage_task_steps: z.boolean().optional(),
    })
    .transform((value) => ({
      ...value,
      can_create_subtask: value.can_create_subtask ?? false,
      supports_task_steps: value.can_create_subtask !== undefined,
      can_manage_task_steps: value.can_manage_task_steps ?? false,
    })),
});

export const taskKeys = {
  all: (workspaceId: string) => ['tasks', workspaceId] as const,
  detail: (workspaceId: string, taskId: string) =>
    ['task', workspaceId, taskId] as const,
};

export async function fetchTaskCommentsPage(
  taskId: string,
  cursor: TaskCommentsCursor,
) {
  const { data, error } = await createClient().rpc('list_task_comments', {
    p_task_id: taskId,
    p_cursor_created_at: cursor.created_at,
    p_cursor_id: cursor.id,
    p_limit: 20,
  });
  if (error) throw error;
  return taskCommentsPageSchema.parse(data) satisfies TaskCommentsPage;
}

export function useTasks(workspaceId: string, projectId?: string) {
  useTaskRealtime(workspaceId);
  const query = useQuery({
    queryKey: projectId
      ? [...taskKeys.all(workspaceId), 'project', projectId]
      : taskKeys.all(workspaceId),
    queryFn: async ({ signal }) => {
      let request = createClient()
        .from('v_task_overview')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });
      if (projectId) request = request.eq('event_id', projectId);
      const { data, error } = await request.abortSignal(signal);
      if (error) throw error;
      return taskOverviewSchema
        .array()
        .parse(data ?? []) satisfies TaskOverview[];
    },
  });

  return query;
}

export function useTaskRealtime(workspaceId: string) {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      retainRealtime(queryClient, `tasks:${workspaceId}`, () => {
        const supabase = createClient();
        const refresh = coalesceRefresh(
          () =>
            Promise.all([
              queryClient.invalidateQueries({
                queryKey: taskKeys.all(workspaceId),
              }),
              queryClient.invalidateQueries({
                queryKey: ['weekly-task-summary', workspaceId],
              }),
            ]),
          () => {
            void queryClient.invalidateQueries({
              queryKey: taskKeys.all(workspaceId),
              refetchType: 'none',
            });
            void queryClient.invalidateQueries({
              queryKey: ['weekly-task-summary', workspaceId],
              refetchType: 'none',
            });
          },
        );
        const channel = supabase.channel(
          `tasks:${workspaceId}:${crypto.randomUUID()}`,
        );
        for (const table of [
          'tasks',
          'task_checklist_items',
          'task_comments',
          'task_assignees',
          'task_statuses',
        ]) {
          channel.on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table,
              filter: `workspace_id=eq.${workspaceId}`,
            },
            refresh.schedule,
          );
        }
        channel.subscribe();
        return () => {
          refresh.dispose();
          void supabase.removeChannel(channel);
        };
      }),
    [queryClient, workspaceId],
  );
}

export function taskDetailQueryOptions(workspaceId: string, taskId: string) {
  return {
    queryKey: taskKeys.detail(workspaceId, taskId),
    staleTime: 30_000,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const { data, error } = await createClient()
        .rpc('get_task_detail', { p_task_id: taskId })
        .abortSignal(signal);
      if (error) throw error;
      const payload = taskDetailSchema.parse(data);
      if (payload.task.workspace_id !== workspaceId)
        throw new Error('PTA_TASK_WORKSPACE_MISMATCH');
      return payload satisfies TaskDetailPayload;
    },
  };
}

export function useTaskDetail(workspaceId: string, taskId: string) {
  const queryClient = useQueryClient();
  const query = useQuery<TaskDetailPayload>({
    ...taskDetailQueryOptions(workspaceId, taskId),
    structuralSharing: (previous, current) => {
      const previousPayload = previous as TaskDetailPayload | undefined;
      const currentPayload = current as TaskDetailPayload;
      if (
        !previousPayload ||
        previousPayload.task.id !== currentPayload.task.id
      )
        return currentPayload;
      return {
        ...currentPayload,
        collaboration: {
          ...currentPayload.collaboration,
          comments: mergeTaskComments(
            previousPayload.collaboration.comments,
            currentPayload.collaboration.comments,
          ),
        },
      };
    },
  });

  useEffect(
    () =>
      retainRealtime(
        queryClient,
        `task-detail:${workspaceId}:${taskId}`,
        () => {
          const supabase = createClient();
          const refresh = coalesceRefresh(
            () =>
              queryClient.invalidateQueries({
                queryKey: taskKeys.detail(workspaceId, taskId),
              }),
            () => {
              void queryClient.invalidateQueries({
                queryKey: taskKeys.detail(workspaceId, taskId),
                refetchType: 'none',
              });
            },
          );
          const invalidateDetail = refresh.schedule;
          const updateCachedComment = (record: Record<string, unknown>) => {
            const parsed = taskCommentRealtimeSchema.safeParse(record);
            if (!parsed.success || parsed.data.task_id !== taskId) return;
            queryClient.setQueryData<TaskDetailPayload>(
              taskKeys.detail(workspaceId, taskId),
              (current) => {
                if (!current) return current;
                const commentIndex = current.collaboration.comments.findIndex(
                  (comment) => comment.id === parsed.data.id,
                );
                if (commentIndex < 0) return current;
                const comments = [...current.collaboration.comments];
                const existing = comments[commentIndex];
                const isDeleted = parsed.data.deleted_at !== null;
                comments[commentIndex] = {
                  ...existing,
                  body: parsed.data.body,
                  updated_at: parsed.data.updated_at,
                  edited_at: parsed.data.edited_at,
                  is_deleted: isDeleted,
                  deleted_at: parsed.data.deleted_at,
                  can_edit_comment: isDeleted
                    ? false
                    : existing.can_edit_comment,
                  can_delete_comment: isDeleted
                    ? false
                    : existing.can_delete_comment,
                };
                return {
                  ...current,
                  collaboration: {
                    ...current.collaboration,
                    comments,
                  },
                };
              },
            );
          };
          const channel = supabase
            .channel(`task:${taskId}`, {
              config: { private: true },
            })
            .on('broadcast', { event: 'link_removed' }, invalidateDetail)
            .on('broadcast', { event: 'attachment_changed' }, () => {
              void queryClient.invalidateQueries({
                queryKey: ['task-media', workspaceId, taskId],
              });
              invalidateDetail();
            })
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'tasks',
                filter: `id=eq.${taskId}`,
              },
              invalidateDetail,
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'task_comments',
                filter: `task_id=eq.${taskId}`,
              },
              (payload) => {
                if (payload.eventType === 'UPDATE')
                  updateCachedComment(payload.new);
                invalidateDetail();
              },
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'task_checklists',
                filter: `task_id=eq.${taskId}`,
              },
              invalidateDetail,
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'task_checklist_items',
                filter: `task_id=eq.${taskId}`,
              },
              invalidateDetail,
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'task_links',
                filter: `task_id=eq.${taskId}`,
              },
              invalidateDetail,
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'task_subtasks',
                filter: `parent_task_id=eq.${taskId}`,
              },
              invalidateDetail,
            )
            .subscribe();
          return () => {
            refresh.dispose();
            void supabase.removeChannel(channel);
          };
        },
      ),
    [queryClient, taskId, workspaceId],
  );

  return query;
}

function mergeTaskComments(...pages: TaskComment[][]) {
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

function nullableValue<T>(value: T | null | undefined) {
  return value ?? null;
}
