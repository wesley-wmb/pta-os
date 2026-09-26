'use client';

import { useQuery } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';

import { searchWorkspacePayloadSchema } from './schemas';
import type { SearchWorkspacePayload } from './types';

export const searchKeys = {
  workspace: (workspaceId: string, query: string, limit: number) =>
    ['workspace-search', workspaceId, query, limit] as const,
};

export function useWorkspaceSearch(
  workspaceId: string,
  query: string,
  limitPerGroup = 8,
) {
  const normalizedQuery = query.trim().slice(0, 100);

  return useQuery<SearchWorkspacePayload>({
    queryKey: searchKeys.workspace(workspaceId, normalizedQuery, limitPerGroup),
    queryFn: async () => {
      const { data, error } = await createClient().rpc('search_workspace', {
        p_workspace_id: workspaceId,
        p_query: normalizedQuery,
        p_limit_per_group: limitPerGroup,
      });

      if (error) throw error;
      return searchWorkspacePayloadSchema.parse(
        data,
      ) satisfies SearchWorkspacePayload;
    },
    enabled: normalizedQuery.length >= 2,
    staleTime: 20_000,
    retry: 1,
  });
}
