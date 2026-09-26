import 'server-only';

import { createClient } from '@/lib/supabase/server';

import { searchWorkspacePayloadSchema } from './schemas';
import type { SearchWorkspacePayload } from './types';

export async function searchWorkspaceOnServer(
  workspaceId: string,
  query: string,
  limitPerGroup = 20,
): Promise<SearchWorkspacePayload> {
  const normalizedQuery = query.trim().slice(0, 100);
  if (normalizedQuery.length < 2) {
    throw new Error('PTA_INVALID_SEARCH_QUERY');
  }

  const { data, error } = await (
    await createClient()
  ).rpc('search_workspace', {
    p_workspace_id: workspaceId,
    p_query: normalizedQuery,
    p_limit_per_group: limitPerGroup,
  });

  if (error) throw new Error('PTA_SEARCH_UNAVAILABLE');
  return searchWorkspacePayloadSchema.parse(
    data,
  ) satisfies SearchWorkspacePayload;
}
