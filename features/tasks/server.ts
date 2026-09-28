import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';

import { getWorkspaceContext } from '@/features/workspace/server';
import { createClient } from '@/lib/supabase/server';

import type { TaskStatus } from './types';

type StatusRow = {
  id: string;
  name: string;
  system_category: TaskStatus['category'];
  color: string;
  position: number;
};

export const getTaskPageContext = cache(async function getTaskPageContext() {
  const context = await getWorkspaceContext();
  if (!context?.workspace) redirect('/login');

  const { data, error } = await (
    await createClient()
  )
    .from('task_statuses')
    .select('id, name, system_category, color, position')
    .eq('workspace_id', context.workspace.id)
    .eq('is_active', true)
    .order('position');
  if (error) throw new Error('PTA_TASK_STATUSES_UNAVAILABLE');
  const rows = (data ?? []) as StatusRow[];

  return {
    context: { ...context, workspace: context.workspace },
    statuses: rows.map((status) => ({
      id: status.id,
      name: status.name,
      category: status.system_category,
      color: status.color,
      position: status.position,
    })),
  };
});
