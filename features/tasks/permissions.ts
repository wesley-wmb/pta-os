import type { WorkspaceRole } from '@/features/workspace/types';

import type { TaskOverview } from './types';

export function canEditTaskOverview(
  role: WorkspaceRole,
  currentUserId: string,
  task: TaskOverview,
) {
  if (role === 'owner' || role === 'admin' || role === 'manager') return true;
  if (role === 'viewer') return false;
  return (
    task.created_by === currentUserId ||
    task.primary_assignee_id === currentUserId
  );
}
