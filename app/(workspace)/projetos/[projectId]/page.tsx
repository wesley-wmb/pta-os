import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ProjectWorkspace } from '@/features/operations/project-workspace';
import {
  getEventsPageData,
  getProjectDetail,
  getProductsPageData,
} from '@/features/operations/server';
import { getTaskPageContext } from '@/features/tasks/server';

export const metadata: Metadata = { title: 'Projeto' };

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [projects, products, taskContext, project] = await Promise.all([
    getEventsPageData(),
    getProductsPageData(),
    getTaskPageContext(),
    getProjectDetail(projectId),
  ]);

  if (!projects.events.some((project) => project.id === projectId)) notFound();

  return (
    <ProjectWorkspace
      projectId={projectId}
      initialData={project}
      workspaceId={taskContext.context.workspace.id}
      members={taskContext.context.members}
      products={products.products}
      statuses={taskContext.statuses}
      currentUserId={taskContext.context.user.id}
      workspaceRole={taskContext.context.workspace.role}
      timezone={taskContext.context.workspace.timezone}
      taskPrefix={taskContext.context.workspace.taskPrefix}
    />
  );
}
