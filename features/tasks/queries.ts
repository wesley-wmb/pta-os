'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/client';

import type { TaskDetailPayload, TaskOverview } from './types';

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
  due_time: z.string().nullable(),
  due_is_date_only: z.boolean(),
  week_position: z.number(),
  version: z.number().int().positive(),
  created_by: z.uuid(),
  created_at: z.string(),
  updated_at: z.string(),
  primary_assignee_id: z.uuid().nullable(),
  primary_assignee_name: z.string().nullable(),
});
const taskDetailSchema = z.object({
  task: taskOverviewSchema,
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
  capabilities: z.object({
    can_edit: z.boolean(),
    can_manage_assignees: z.boolean(),
  }),
});

export const taskKeys = {
  all: (workspaceId: string) => ['tasks', workspaceId] as const,
  detail: (taskId: string) => ['task', taskId] as const,
};

export function useTasks(workspaceId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: taskKeys.all(workspaceId),
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('v_task_overview')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return taskOverviewSchema
        .array()
        .parse(data ?? []) satisfies TaskOverview[];
    },
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`tasks:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () =>
          queryClient.invalidateQueries({
            queryKey: taskKeys.all(workspaceId),
          }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, workspaceId]);

  return query;
}

export function useTaskDetail(taskId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: taskKeys.detail(taskId),
    queryFn: async () => {
      const { data, error } = await createClient().rpc('get_task_detail', {
        p_task_id: taskId,
      });
      if (error) throw error;
      return taskDetailSchema.parse(data) satisfies TaskDetailPayload;
    },
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`task:${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `id=eq.${taskId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: taskKeys.detail(taskId),
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, taskId]);

  return query;
}
