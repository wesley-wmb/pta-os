import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { ProjectWorkspace } from '@/features/operations/project-workspace';
import {
  getEventsPageData,
  getProjectDetail,
  getProductsPageData,
} from '@/features/operations/server';
import { getTaskPageContext } from '@/features/tasks/server';
import { getOperatingDirectory } from '@/features/team/directory-server';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Projeto' };

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = await params;
  const [projects, products, taskContext, project] = await Promise.all([
    getEventsPageData(),
    getProductsPageData(),
    getTaskPageContext(),
    getProjectDetail(projectId),
  ]);

  if (!projects.events.some((project) => project.id === projectId)) notFound();

  const [{ directory }, client] = await Promise.all([
    getOperatingDirectory(),
    createClient(),
  ]);
  const { data: assignment } = await client
    .from('events')
    .select('primary_team_id')
    .eq('workspace_id', taskContext.context.workspace.id)
    .eq('id', projectId)
    .single();
  const primaryTeam = directory.teams.find(
    (team) => team.id === assignment?.primary_team_id,
  );
  if (primaryTeam?.workspace_event_id === projectId) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
      if (typeof value === 'string') query.set(key, value);
    }
    redirect(`/equipes/${primaryTeam.id}${query.size ? `?${query}` : ''}`);
  }

  return (
    <ProjectWorkspace
      projectId={projectId}
      parentTeam={
        primaryTeam ? { id: primaryTeam.id, name: primaryTeam.name } : null
      }
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
