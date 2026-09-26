'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { createClient } from '@/lib/supabase/client';

import {
  eventDetailSchema,
  productDetailSchema,
  projectTimelineSchema,
} from './portfolio-schemas';
import type { EventDetail } from './types';

export const portfolioKeys = {
  event: (workspaceId: string, id: string) =>
    ['portfolio', workspaceId, 'event', id] as const,
  timeline: (workspaceId: string, id: string) =>
    ['portfolio', workspaceId, 'timeline', id] as const,
  product: (workspaceId: string, id: string) =>
    ['portfolio', workspaceId, 'product', id] as const,
};

export function useProjectTimeline(workspaceId: string, projectId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: portfolioKeys.timeline(workspaceId, projectId),
    queryFn: async () => {
      const result = await createClient().rpc('get_project_timeline', {
        p_workspace_id: workspaceId,
        p_event_id: projectId,
      });
      if (result.error) throw result.error;
      return projectTimelineSchema.parse(result.data);
    },
  });

  useEffect(() => {
    const supabase = createClient();
    const invalidate = () =>
      queryClient.invalidateQueries({
        queryKey: portfolioKeys.timeline(workspaceId, projectId),
      });
    const channel = supabase
      .channel(
        `project-timeline:${workspaceId}:${projectId}:${crypto.randomUUID()}`,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        invalidate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_milestones',
          filter: `event_id=eq.${projectId}`,
        },
        invalidate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_phases',
          filter: `event_id=eq.${projectId}`,
        },
        invalidate,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId, queryClient, workspaceId]);

  return query;
}

export function useEventDetail(
  workspaceId: string,
  id: string | null,
  initialData?: EventDetail,
) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: portfolioKeys.event(workspaceId, id ?? 'closed'),
    enabled: Boolean(id),
    initialData,
    queryFn: async () => {
      if (!id) throw new Error('PTA_EVENT_REQUIRED');
      const result = await createClient().rpc('get_event_operational', {
        p_event_id: id,
      });
      if (result.error) throw result.error;
      const detail = eventDetailSchema.parse(result.data);
      if (detail.event.id !== id) throw new Error('PTA_EVENT_ID_MISMATCH');
      return detail;
    },
  });
  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    const invalidate = () =>
      queryClient.invalidateQueries({
        queryKey: portfolioKeys.event(workspaceId, id),
      });
    const channel = supabase
      .channel(`project:${workspaceId}:${id}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `id=eq.${id}`,
        },
        invalidate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        invalidate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_milestones',
          filter: `event_id=eq.${id}`,
        },
        invalidate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_members',
          filter: `event_id=eq.${id}`,
        },
        invalidate,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, queryClient, workspaceId]);
  return query;
}

export function useProductDetail(workspaceId: string, id: string | null) {
  return useQuery({
    queryKey: portfolioKeys.product(workspaceId, id ?? 'closed'),
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) throw new Error('PTA_PRODUCT_REQUIRED');
      const result = await createClient().rpc('get_product_operational', {
        p_product_id: id,
      });
      if (result.error) throw result.error;
      return productDetailSchema.parse(result.data);
    },
  });
}
