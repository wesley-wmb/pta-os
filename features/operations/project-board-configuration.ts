'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/client';

const projectColumnSchema = z.object({
  key: z.enum(['planning', 'active', 'completed', 'cancelled']),
  name: z.string().min(1),
  color: z.string().min(1),
  icon_key: z.string().min(1),
  cover_url: z.string().nullable().optional(),
  position: z.number().finite(),
  version: z.number().int().positive(),
});

const payloadSchema = z.object({
  schema_version: z.literal(1),
  workspace_id: z.uuid(),
  version: z.number().int().nonnegative(),
  can_manage_columns: z.boolean(),
  columns: z.array(projectColumnSchema),
});

export type ProjectBoardColumn = z.infer<typeof projectColumnSchema>;
export type ProjectBoardConfiguration = z.infer<typeof payloadSchema> & {
  source: 'remote' | 'fallback';
};

const keys = {
  all: (workspaceId: string) =>
    ['project-board-configuration', workspaceId] as const,
};

const fallbackColumns: ProjectBoardColumn[] = [
  {
    key: 'planning',
    name: 'Planejamento',
    color: 'stone',
    icon_key: 'inbox',
    position: 1000,
    version: 1,
  },
  {
    key: 'active',
    name: 'Em andamento',
    color: 'blue',
    icon_key: 'clock',
    position: 2000,
    version: 1,
  },
  {
    key: 'completed',
    name: 'Concluídos',
    color: 'green',
    icon_key: 'check',
    position: 3000,
    version: 1,
  },
  {
    key: 'cancelled',
    name: 'Cancelados',
    color: 'red',
    icon_key: 'cancel',
    position: 4000,
    version: 1,
  },
];

export function createProjectBoardConfigurationFallback(
  workspaceId: string,
): ProjectBoardConfiguration {
  return {
    schema_version: 1,
    workspace_id: workspaceId,
    version: 0,
    can_manage_columns: false,
    columns: fallbackColumns,
    source: 'fallback',
  };
}

export function parseProjectBoardConfiguration(
  payload: unknown,
): ProjectBoardConfiguration {
  return { ...payloadSchema.parse(payload), source: 'remote' };
}

export function useProjectBoardConfiguration(workspaceId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: keys.all(workspaceId),
    placeholderData: createProjectBoardConfigurationFallback(workspaceId),
    queryFn: async (): Promise<ProjectBoardConfiguration> => {
      const { data, error } = await createClient().rpc(
        'get_project_board_configuration',
        { p_workspace_id: workspaceId },
      );
      if (error) {
        if (isUnavailable(error)) {
          return createProjectBoardConfigurationFallback(workspaceId);
        }
        throw error;
      }
      return parseProjectBoardConfiguration(data);
    },
  });

  useEffect(() => {
    const client = createClient();
    const channel = client
      .channel(`project-board-configuration:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_board_columns',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () =>
          void queryClient.invalidateQueries({
            queryKey: keys.all(workspaceId),
          }),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [queryClient, workspaceId]);

  return query;
}

export function useUpdateProjectBoardColumn(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      column: ProjectBoardColumn;
      name: string;
      color: string;
      iconKey: string;
      coverUrl?: string | null;
      boardVersion: number;
    }) => {
      const { data, error } = await createClient().rpc(
        'update_project_board_column',
        {
          p_workspace_id: workspaceId,
          p_column_key: input.column.key,
          p_name: input.name,
          p_color: input.color,
          p_icon_key: input.iconKey,
          p_cover_url: input.coverUrl ?? undefined,
          p_expected_board_version: input.boardVersion,
          p_expected_column_version: input.column.version,
        },
      );
      if (error) throw error;
      return parseProjectBoardConfiguration(data);
    },
    onSuccess: (data) => queryClient.setQueryData(keys.all(workspaceId), data),
  });
}

export function useReorderProjectBoardColumns(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      orderedKeys: string[];
      boardVersion: number;
    }) => {
      const { data, error } = await createClient().rpc(
        'reorder_project_board_columns',
        {
          p_workspace_id: workspaceId,
          p_ordered_keys: input.orderedKeys,
          p_expected_board_version: input.boardVersion,
        },
      );
      if (error) throw error;
      return parseProjectBoardConfiguration(data);
    },
    onSuccess: (data) => queryClient.setQueryData(keys.all(workspaceId), data),
  });
}

function isUnavailable(error: unknown) {
  const value = error as { code?: string; message?: string };
  return (
    value.code === 'PGRST202' ||
    Boolean(value.message?.includes('get_project_board_configuration'))
  );
}
