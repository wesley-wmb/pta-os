'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useEffect } from 'react';

import { createClient } from '@/lib/supabase/client';

import { taskKeys } from './queries';
import type { TaskStatus, TaskWeekLane } from './types';

const taskStatusCategorySchema = z.enum([
  'backlog',
  'todo',
  'in_progress',
  'review',
  'blocked',
  'done',
  'cancelled',
]);
const taskWeekLaneSchema = z.enum([
  'backlog',
  'emergency',
  'important',
  'scheduled',
  'delivered',
  'revision',
  'ideas',
  'discarded',
]);
const boardLinkDirectionSchema = z.enum([
  'both',
  'status_to_week',
  'week_to_status',
]);
const statusColumnSchema = z.object({
  id: z.uuid(),
  key: z.string().min(1),
  name: z.string().min(1),
  category: taskStatusCategorySchema,
  color: z.string().min(1),
  icon_key: z.string().min(1),
  cover_url: z.string().nullable().optional(),
  position: z.number().finite(),
  is_active: z.boolean(),
  version: z.number().int().positive(),
});
const weekColumnSchema = z.object({
  key: taskWeekLaneSchema,
  name: z.string().min(1),
  color: z.string().min(1),
  icon_key: z.string().min(1),
  cover_url: z.string().nullable().optional(),
  position: z.number().finite(),
  is_active: z.boolean(),
  is_system: z.boolean(),
  version: z.number().int().positive(),
});
const boardConfigurationPayloadSchema = z.object({
  schema_version: z.literal(1),
  workspace_id: z.uuid(),
  permissions: z.object({ can_manage_columns: z.boolean() }),
  status_board: z.object({
    version: z.number().int().nonnegative(),
    columns: z.array(statusColumnSchema),
  }),
  week_board: z.object({
    version: z.number().int().nonnegative(),
    columns: z.array(weekColumnSchema),
  }),
  links: z.array(
    z.object({
      status_id: z.uuid(),
      week_lane_key: taskWeekLaneSchema,
      direction: boardLinkDirectionSchema,
      version: z.number().int().positive(),
    }),
  ),
});

export type TaskBoardKind = 'status' | 'week';
export type TaskBoardLinkDirection = z.infer<typeof boardLinkDirectionSchema>;
export type TaskBoardStatusColumn = z.infer<typeof statusColumnSchema>;
export type TaskBoardWeekColumn = z.infer<typeof weekColumnSchema>;
export type TaskBoardLaneLink = z.infer<
  typeof boardConfigurationPayloadSchema
>['links'][number];
export type TaskBoardConfigurationPayload = z.infer<
  typeof boardConfigurationPayloadSchema
>;
export type TaskBoardConfiguration = TaskBoardConfigurationPayload & {
  source: 'remote' | 'fallback';
};

export type UpdateTaskBoardColumnInput = {
  boardKind: TaskBoardKind;
  columnKey: string;
  name: string;
  color: string;
  iconKey: string;
  coverUrl?: string | null;
  expectedBoardVersion: number;
  expectedColumnVersion: number;
};

export type ReorderTaskBoardColumnsInput = {
  boardKind: TaskBoardKind;
  orderedKeys: string[];
  expectedBoardVersion: number;
};

export type SetTaskBoardLaneLinkInput = {
  statusId: string;
  weekLaneKey: TaskWeekLane;
  direction: TaskBoardLinkDirection;
  enabled: boolean;
  expectedBoardVersion: number;
};

export const TASK_BOARD_CONFIGURATION_UNAVAILABLE =
  'PTA_TASK_BOARD_CONFIGURATION_UNAVAILABLE';

export const taskBoardConfigurationKeys = {
  all: (workspaceId: string) =>
    ['task-board-configuration', workspaceId] as const,
};

const FALLBACK_WEEK_COLUMNS: ReadonlyArray<
  Omit<TaskBoardWeekColumn, 'position' | 'version'>
> = [
  {
    key: 'emergency',
    name: 'Emergência',
    color: 'red',
    icon_key: 'zap',
    is_active: true,
    is_system: true,
  },
  {
    key: 'important',
    name: 'Links importantes',
    color: 'blue',
    icon_key: 'link-2',
    is_active: true,
    is_system: true,
  },
  {
    key: 'backlog',
    name: 'Para planejar',
    color: 'stone',
    icon_key: 'inbox',
    is_active: true,
    is_system: true,
  },
  {
    key: 'scheduled',
    name: 'Planejado',
    color: 'blue',
    icon_key: 'calendar-days',
    is_active: true,
    is_system: true,
  },
  {
    key: 'delivered',
    name: 'Concluídos',
    color: 'green',
    icon_key: 'circle-check',
    is_active: true,
    is_system: true,
  },
  {
    key: 'revision',
    name: 'Alterações',
    color: 'amber',
    icon_key: 'rotate-ccw',
    is_active: true,
    is_system: true,
  },
  {
    key: 'ideas',
    name: 'Ideias criativas',
    color: 'purple',
    icon_key: 'lightbulb',
    is_active: true,
    is_system: true,
  },
  {
    key: 'discarded',
    name: 'Arquivados',
    color: 'stone',
    icon_key: 'archive',
    is_active: true,
    is_system: true,
  },
];

export function parseTaskBoardConfiguration(
  payload: unknown,
): TaskBoardConfiguration {
  return {
    ...boardConfigurationPayloadSchema.parse(payload),
    source: 'remote',
  };
}

export function createTaskBoardConfigurationFallback(
  workspaceId: string,
  statuses: readonly TaskStatus[],
): TaskBoardConfiguration {
  return {
    schema_version: 1,
    workspace_id: workspaceId,
    permissions: { can_manage_columns: false },
    status_board: {
      version: 0,
      columns: statuses
        .toSorted((left, right) => left.position - right.position)
        .map((status) => ({
          id: status.id,
          key: status.id,
          name: status.name,
          category: status.category,
          color: status.color,
          icon_key: defaultStatusIcon(status.category),
          position: status.position,
          is_active: true,
          version: 1,
        })),
    },
    week_board: {
      version: 0,
      columns: FALLBACK_WEEK_COLUMNS.map((column, index) => ({
        ...column,
        position: (index + 1) * 10,
        version: 1,
      })),
    },
    links: [],
    source: 'fallback',
  };
}

export function isTaskBoardConfigurationUnavailable(error: unknown) {
  const code = errorProperty(error, 'code');
  const message = errorProperty(error, 'message') ?? String(error);
  return (
    code === 'PGRST202' ||
    code === '42P01' ||
    message.includes('PGRST202') ||
    message.includes('42P01') ||
    message.includes(TASK_BOARD_CONFIGURATION_UNAVAILABLE)
  );
}

export function useTaskBoardConfiguration(
  workspaceId: string,
  statuses: readonly TaskStatus[],
) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: taskBoardConfigurationKeys.all(workspaceId),
    queryFn: async () => {
      const { data, error } = await createClient().rpc(
        'get_task_board_configuration',
        { p_workspace_id: workspaceId },
      );
      if (error) {
        if (isTaskBoardConfigurationUnavailable(error)) {
          return createTaskBoardConfigurationFallback(workspaceId, statuses);
        }
        throw error;
      }
      return parseTaskBoardConfiguration(data);
    },
  });
  useEffect(() => {
    const client = createClient();
    const channel = client.channel(`task-board-configuration:${workspaceId}`);
    const invalidate = () => {
      void queryClient.invalidateQueries({
        queryKey: taskBoardConfigurationKeys.all(workspaceId),
      });
    };
    for (const table of [
      'task_statuses',
      'task_board_settings',
      'task_week_lanes',
      'task_status_week_lane_links',
    ]) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `workspace_id=eq.${workspaceId}`,
        },
        invalidate,
      );
    }
    channel.subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [queryClient, workspaceId]);
  return query;
}

export function useUpdateTaskBoardColumn(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateTaskBoardColumnInput) => {
      assertConfigurationIsWritable(queryClient, workspaceId);
      const { data, error } = await createClient().rpc(
        'update_task_board_column',
        {
          p_workspace_id: workspaceId,
          p_board_kind: input.boardKind,
          p_column_key: input.columnKey,
          p_name: input.name,
          p_color: input.color,
          p_icon_key: input.iconKey,
          p_cover_url: input.coverUrl ?? undefined,
          p_expected_board_version: input.expectedBoardVersion,
          p_expected_column_version: input.expectedColumnVersion,
        },
      );
      if (error) throw normalizeMutationError(error);
      return parseTaskBoardConfiguration(data);
    },
    onSuccess: (configuration) =>
      applyConfigurationMutation(queryClient, workspaceId, configuration),
  });
}

export function useManageTaskBoardColumn(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      version: number;
      action: 'create' | 'delete';
      name?: string;
      columnId?: string;
      destinationId?: string;
    }) => {
      const { data, error } = await createClient().rpc(
        'manage_task_board_column',
        {
          p_workspace_id: workspaceId,
          p_expected_board_version: input.version,
          p_action: input.action,
          p_name: input.name,
          p_column_id: input.columnId,
          p_destination_id: input.destinationId,
        },
      );
      if (error) throw error;
      return parseTaskBoardConfiguration(data);
    },
    onSuccess: async (configuration) => {
      await applyConfigurationMutation(queryClient, workspaceId, configuration);
      await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey.includes(workspaceId),
      });
    },
  });
}

export function useReorderTaskBoardColumns(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReorderTaskBoardColumnsInput) => {
      assertConfigurationIsWritable(queryClient, workspaceId);
      const { data, error } = await createClient().rpc(
        'reorder_task_board_columns',
        {
          p_workspace_id: workspaceId,
          p_board_kind: input.boardKind,
          p_ordered_keys: input.orderedKeys,
          p_expected_board_version: input.expectedBoardVersion,
        },
      );
      if (error) throw normalizeMutationError(error);
      return parseTaskBoardConfiguration(data);
    },
    onSuccess: (configuration) =>
      applyConfigurationMutation(queryClient, workspaceId, configuration),
  });
}

export function useSetTaskBoardLaneLink(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SetTaskBoardLaneLinkInput) => {
      assertConfigurationIsWritable(queryClient, workspaceId);
      const { data, error } = await createClient().rpc(
        'set_task_board_lane_link',
        {
          p_workspace_id: workspaceId,
          p_status_id: input.statusId,
          p_week_lane_key: input.weekLaneKey,
          p_direction: input.direction,
          p_enabled: input.enabled,
          p_expected_board_version: input.expectedBoardVersion,
        },
      );
      if (error) throw normalizeMutationError(error);
      return parseTaskBoardConfiguration(data);
    },
    onSuccess: (configuration) =>
      applyConfigurationMutation(queryClient, workspaceId, configuration),
  });
}

export function useDeleteWeekBoardColumn(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      lane: TaskWeekLane;
      destination: TaskWeekLane;
      version: number;
    }) => {
      assertConfigurationIsWritable(queryClient, workspaceId);
      const { data, error } = await createClient().rpc(
        'delete_week_board_column',
        {
          p_workspace_id: workspaceId,
          p_lane_key: input.lane,
          p_destination_key: input.destination,
          p_expected_board_version: input.version,
        },
      );
      if (error) throw error;
      return parseTaskBoardConfiguration(data);
    },
    onSuccess: (configuration) =>
      applyConfigurationMutation(queryClient, workspaceId, configuration),
  });
}

export function useConnectWeekBoardColumn(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      lane: TaskWeekLane;
      statusId: string | null;
      version: number;
    }) => {
      const { data, error } = await createClient().rpc(
        'connect_week_board_column',
        {
          p_workspace_id: workspaceId,
          p_week_lane_key: input.lane,
          p_status_id: input.statusId,
          p_expected_board_version: input.version,
        },
      );
      if (error) throw error;
      return parseTaskBoardConfiguration(data);
    },
    onSuccess: (configuration) =>
      applyConfigurationMutation(queryClient, workspaceId, configuration),
  });
}

async function applyConfigurationMutation(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  configuration: TaskBoardConfiguration,
) {
  queryClient.setQueryData(
    taskBoardConfigurationKeys.all(workspaceId),
    configuration,
  );
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: taskBoardConfigurationKeys.all(workspaceId),
    }),
    queryClient.invalidateQueries({ queryKey: taskKeys.all(workspaceId) }),
  ]);
}

function assertConfigurationIsWritable(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
) {
  const configuration = queryClient.getQueryData<TaskBoardConfiguration>(
    taskBoardConfigurationKeys.all(workspaceId),
  );
  if (configuration?.source === 'fallback') {
    throw new Error(TASK_BOARD_CONFIGURATION_UNAVAILABLE);
  }
}

function normalizeMutationError(error: unknown) {
  if (!isTaskBoardConfigurationUnavailable(error)) return error;
  return new Error(TASK_BOARD_CONFIGURATION_UNAVAILABLE, { cause: error });
}

function errorProperty(error: unknown, property: 'code' | 'message') {
  if (
    typeof error === 'object' &&
    error !== null &&
    property in error &&
    typeof (error as Record<string, unknown>)[property] === 'string'
  ) {
    return (error as Record<string, string>)[property];
  }
  return undefined;
}

function defaultStatusIcon(category: TaskStatus['category']) {
  const icons: Record<TaskStatus['category'], string> = {
    backlog: 'inbox',
    todo: 'circle',
    in_progress: 'circle-play',
    review: 'scan-eye',
    blocked: 'circle-alert',
    done: 'circle-check',
    cancelled: 'circle-x',
  };
  return icons[category];
}
