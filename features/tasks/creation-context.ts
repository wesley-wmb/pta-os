'use client';

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/client';

const taskTypeSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  icon: z.string().nullable(),
  color: z.string(),
  position: z.number().int(),
});

const productSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  status: z.enum(['planning', 'active', 'paused', 'completed']),
});

const eventSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  product_id: z.uuid().nullable(),
  status: z.enum(['planning', 'active', 'completed', 'cancelled']),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
});

export type TaskTypeOption = z.infer<typeof taskTypeSchema>;
export type TaskProductOption = z.infer<typeof productSchema>;
export type TaskEventOption = z.infer<typeof eventSchema>;

const creationContextKeys = {
  all: (workspaceId: string) =>
    ['tasks', workspaceId, 'creation-context'] as const,
};

export function useTaskCreationContext(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: creationContextKeys.all(workspaceId),
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const [typesResult, productsResult, eventsResult] = await Promise.all([
        supabase
          .from('task_types')
          .select('id, name, icon, color, position')
          .eq('workspace_id', workspaceId)
          .eq('is_active', true)
          .order('position')
          .order('name'),
        supabase
          .from('products')
          .select('id, name, status')
          .eq('workspace_id', workspaceId)
          .is('archived_at', null)
          .order('name'),
        supabase
          .from('events')
          .select('id, name, product_id, status, start_date, end_date')
          .eq('workspace_id', workspaceId)
          .is('archived_at', null)
          .order('start_date', { ascending: false, nullsFirst: false })
          .order('name'),
      ]);

      const error =
        typesResult.error ?? productsResult.error ?? eventsResult.error;
      if (error) throw error;

      return {
        taskTypes: taskTypeSchema.array().parse(typesResult.data ?? []),
        products: productSchema.array().parse(productsResult.data ?? []),
        events: eventSchema.array().parse(eventsResult.data ?? []),
      };
    },
  });
}
