import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getOperatingDirectory,
  getOperatingMembers,
} from '@/features/team/directory-server';
import {
  TeamEditorButton,
  TeamMembersPanel,
} from '@/features/team/operating-team-controls';
import { ProjectWorkspace } from '@/features/operations/project-workspace';
import {
  getProjectDetail,
  getProductsPageData,
} from '@/features/operations/server';
import { getTaskPageContext } from '@/features/tasks/server';

export const metadata: Metadata = { title: 'Equipe' };
export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const [{ teamId }, { context, directory }] = await Promise.all([
    params,
    getOperatingDirectory(),
  ]);
  const team = directory.teams.find((item) => item.id === teamId);
  if (!team) notFound();
  if (!team.workspace_event_id)
    return (
      <p className="p-8 text-sm text-muted-foreground">
        Esta equipe precisa ter sua área de trabalho vinculada antes de
        continuar.
      </p>
    );
  const [detail, products, taskContext, membership] = await Promise.all([
    getProjectDetail(team.workspace_event_id),
    getProductsPageData(),
    getTaskPageContext(),
    context.workspace.role === 'viewer'
      ? null
      : getOperatingMembers(context.workspace.id, team.id),
  ]);
  return (
    <ProjectWorkspace
      projectId={team.workspace_event_id}
      teamName={team.name}
      memberCount={team.member_count}
      parentTeam={{ id: team.id, name: team.name }}
      initialData={detail}
      workspaceId={context.workspace.id}
      members={
        membership
          ? membership.members.map((member) => ({
              id: member.user_id,
              fullName: member.full_name,
            }))
          : []
      }
      products={products.products}
      statuses={taskContext.statuses}
      currentUserId={context.user.id}
      workspaceRole={context.workspace.role}
      timezone={context.workspace.timezone}
      taskPrefix={context.workspace.taskPrefix}
      teamSettings={
        directory.can_manage ? (
          <div className="flex items-center justify-between border-b py-5">
            <div>
              <h2 className="font-semibold">Identidade da equipe</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Nome, descrição e cor.
              </p>
            </div>
            <TeamEditorButton
              workspaceId={context.workspace.id}
              team={team}
              compact
            />
          </div>
        ) : undefined
      }
      teamMembers={
        membership ? (
          <TeamMembersPanel
            workspaceId={context.workspace.id}
            teamId={team.id}
            members={context.members}
            currentMembers={membership.members}
            canManage={membership.can_manage_members}
          />
        ) : undefined
      }
    />
  );
}
