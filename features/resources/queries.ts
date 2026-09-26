'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';

import {
  resourceCategoryListPayloadSchema,
  resourceDetailPayloadSchema,
  resourceListPayloadSchema,
  resourceRelationOptionsPayloadSchema,
} from './schemas';
import type {
  ResourceCategoryListPayload,
  ResourceDetailPayload,
  ResourceFilters,
  ResourceListPayload,
  ResourceRelationKind,
  ResourceRelationOptionsPayload,
} from './types';

export const resourceKeys = {
  all: (workspaceId: string) => ['resources', workspaceId] as const,
  list: (workspaceId: string, filters: ResourceFilters) =>
    [...resourceKeys.all(workspaceId), 'list', filters] as const,
  detail: (workspaceId: string, resourceId: string) =>
    ['resource', workspaceId, resourceId] as const,
  categories: (workspaceId: string) =>
    [...resourceKeys.all(workspaceId), 'categories'] as const,
  relationOptions: (
    workspaceId: string,
    kind: ResourceRelationKind,
    query: string,
  ) =>
    [
      ...resourceKeys.all(workspaceId),
      'relation-options',
      kind,
      query,
    ] as const,
};

export function useResources(workspaceId: string, filters: ResourceFilters) {
  return useInfiniteQuery({
    queryKey: resourceKeys.list(workspaceId, filters),
    queryFn: async ({ pageParam }) => {
      const trimmedQuery = filters.query.trim();
      const { data, error } = await createClient().rpc('list_resources', {
        p_workspace_id: workspaceId,
        p_query: trimmedQuery.length >= 2 ? trimmedQuery : undefined,
        p_category_id:
          filters.categoryId === 'all' ? undefined : filters.categoryId,
        p_resource_type:
          filters.resourceType === 'all' ? undefined : filters.resourceType,
        p_only_favorites: filters.view === 'favorites',
        p_only_recent: filters.view === 'recent',
        p_include_archived: false,
        p_limit: 50,
        p_offset: pageParam,
      });

      if (error) throw error;
      return resourceListPayloadSchema.parse(
        data,
      ) satisfies ResourceListPayload;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    select: (data): ResourceListPayload => {
      const firstPage = data.pages[0];
      const itemsById = new Map(
        data.pages.flatMap((page) =>
          page.items.map((item) => [item.id, item] as const),
        ),
      );

      return {
        items: [...itemsById.values()],
        total: firstPage?.total ?? 0,
        limit: 50,
        offset: 0,
        facets: firstPage?.facets ?? {
          categories: [],
          resource_types: [],
        },
      };
    },
  });
}

export function useResourceDetail(
  workspaceId: string,
  resourceId: string | null,
) {
  return useQuery<ResourceDetailPayload>({
    queryKey: resourceKeys.detail(workspaceId, resourceId ?? 'none'),
    queryFn: async () => {
      if (!resourceId) throw new Error('PTA_RESOURCE_NOT_SELECTED');
      const { data, error } = await createClient().rpc('get_resource_detail', {
        p_resource_id: resourceId,
      });
      if (error) throw error;
      return resourceDetailPayloadSchema.parse(
        data,
      ) satisfies ResourceDetailPayload;
    },
    enabled: Boolean(resourceId),
  });
}

export function useResourceCategories(workspaceId: string, enabled = true) {
  return useQuery<ResourceCategoryListPayload>({
    queryKey: resourceKeys.categories(workspaceId),
    queryFn: async () => {
      const rpc = createClient().rpc as unknown as (
        name: 'list_resource_categories',
        args: { p_workspace_id: string },
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await rpc('list_resource_categories', {
        p_workspace_id: workspaceId,
      });
      if (error) throw error;
      return resourceCategoryListPayloadSchema.parse(data);
    },
    enabled,
  });
}

export function useResourceRelationOptions(
  workspaceId: string,
  kind: ResourceRelationKind,
  query: string,
  enabled: boolean,
) {
  const normalizedQuery = query.trim();
  return useQuery<ResourceRelationOptionsPayload>({
    queryKey: resourceKeys.relationOptions(workspaceId, kind, normalizedQuery),
    queryFn: async () => {
      const rpc = createClient().rpc as unknown as (
        name: 'search_resource_relation_options',
        args: {
          p_workspace_id: string;
          p_entity_type: ResourceRelationKind;
          p_query?: string;
          p_limit: number;
        },
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await rpc('search_resource_relation_options', {
        p_workspace_id: workspaceId,
        p_entity_type: kind,
        ...(normalizedQuery ? { p_query: normalizedQuery } : {}),
        p_limit: 30,
      });
      if (error) throw error;
      return resourceRelationOptionsPayloadSchema.parse(data);
    },
    enabled,
  });
}
