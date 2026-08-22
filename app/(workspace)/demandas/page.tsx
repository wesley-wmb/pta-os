import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { TaskCenter } from '@/features/tasks/task-center';
import { getTaskPageContext } from '@/features/tasks/server';

export const metadata: Metadata = { title: 'Demandas' };

export default async function DemandsPage() {
  const { context } = await getTaskPageContext();

  return (
    <div>
      <PageHeader
        title="Demandas"
        description="A base oficial do trabalho da equipe. Encontre, priorize e atualize sem perder o contexto."
      />
      <TaskCenter
        workspaceId={context.workspace.id}
        currentUserId={context.user.id}
        timezone={context.workspace.timezone}
      />
    </div>
  );
}
