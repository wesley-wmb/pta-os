import { TaskPeek } from '@/features/tasks/task-peek';

export default async function PeekLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return <TaskPeek taskId={taskId}>{children}</TaskPeek>;
}
