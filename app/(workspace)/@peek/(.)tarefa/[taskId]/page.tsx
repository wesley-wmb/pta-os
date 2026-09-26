import { getTaskPageContext } from '@/features/tasks/server';
import { TaskDetail } from '@/features/tasks/task-detail';

export default async function TaskPeekPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const { context, statuses } = await getTaskPageContext();
  return (
    <TaskDetail
      workspaceId={context.workspace.id}
      taskId={taskId}
      statuses={statuses}
      members={context.members}
      workspaceRole={context.workspace.role}
      currentUserId={context.user.id}
      taskPrefix={context.workspace.taskPrefix}
      mode="peek"
    />
  );
}
