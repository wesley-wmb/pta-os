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
      taskId={taskId}
      statuses={statuses}
      members={context.members}
      mode="peek"
    />
  );
}
