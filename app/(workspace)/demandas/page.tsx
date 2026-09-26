import type { Metadata } from 'next';

import { TaskPipeline } from '@/features/tasks/task-pipeline';
import { getTaskPageContext } from '@/features/tasks/server';

export const metadata: Metadata = { title: 'Tarefas' };

export default async function DemandsPage() {
  const { context, statuses } = await getTaskPageContext();

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TaskPipeline
        workspaceId={context.workspace.id}
        currentUserId={context.user.id}
        timezone={context.workspace.timezone}
        role={context.workspace.role}
        statuses={statuses}
        taskPrefix={context.workspace.taskPrefix}
        members={context.members}
      />
    </div>
  );
}
