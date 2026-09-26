import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ProjectsView } from '@/features/operations/projects-view';
import {
  getEventsPageData,
  getProductsPageData,
} from '@/features/operations/server';
import { getTaskPageContext } from '@/features/tasks/server';

export const metadata: Metadata = { title: 'Projetos' };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    evento?: string | string[];
    modo?: string | string[];
  }>;
}) {
  const [data, products, taskContext] = await Promise.all([
    getEventsPageData(),
    getProductsPageData(),
    getTaskPageContext(),
  ]);
  const { context } = taskContext;
  const params = await searchParams;
  const requestedId = Array.isArray(params.evento)
    ? params.evento[0]
    : params.evento;
  const selectedEventId = data.events.some(
    (project) => project.id === requestedId,
  )
    ? (requestedId ?? null)
    : null;
  const requestedMode = Array.isArray(params.modo)
    ? params.modo[0]
    : params.modo;

  if (selectedEventId) {
    redirect(
      `/projetos/${selectedEventId}${requestedMode === 'editar' ? '?editar=1' : ''}`,
    );
  }

  return (
    <ProjectsView
      data={data}
      products={products.products}
      workspaceId={context.workspace.id}
      members={context.members}
      canManage={['owner', 'admin', 'manager'].includes(context.workspace.role)}
    />
  );
}
