import 'server-only';

import { notFound, redirect } from 'next/navigation';

import { getTeamPageData as getOperationalTeamPageData } from '@/features/operations/server';
import { getWorkspaceContext } from '@/features/workspace/server';
import { createClient } from '@/lib/supabase/server';

import { invitationInspectionSchema, teamManagementSchema } from './schemas';
import type { InvitationRouteState, TeamRouteData } from './types';

const INVITATION_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

export async function getTeamRouteData(): Promise<TeamRouteData> {
  const context = await getWorkspaceContext();
  if (!context?.workspace) redirect('/login');
  if (context.workspace.role === 'viewer') notFound();

  if (!['owner', 'admin'].includes(context.workspace.role)) {
    return {
      mode: 'workload',
      workload: await getOperationalTeamPageData(),
    };
  }

  const supabase = await createClient();
  const [managementResult, workload] = await Promise.all([
    supabase.rpc('list_workspace_team_management', {
      p_workspace_id: context.workspace.id,
    }),
    getOperationalTeamPageData(),
  ]);

  if (managementResult.error) throw new Error('PTA_TEAM_UNAVAILABLE');
  const parsed = teamManagementSchema.safeParse(managementResult.data);
  if (!parsed.success || parsed.data.workspaceId !== context.workspace.id) {
    throw new Error('PTA_TEAM_INVALID_RESPONSE');
  }

  const workloadById = new Map(
    workload.members.map((member) => [member.id, member]),
  );

  return {
    mode: 'management',
    workspaceId: parsed.data.workspaceId,
    workspaceName: context.workspace.name,
    members: parsed.data.members.map((member) => {
      const memberWorkload = workloadById.get(member.id);
      return {
        ...member,
        totalAssignedTasks: memberWorkload?.totalAssignedTasks ?? 0,
        openTasks: memberWorkload?.openTasks ?? 0,
        overdueTasks: memberWorkload?.overdueTasks ?? 0,
        plannedWeekMinutes: memberWorkload?.plannedWeekMinutes ?? 0,
        estimatedWeekTasks: memberWorkload?.estimatedWeekTasks ?? 0,
        completedThisWeek: memberWorkload?.completedThisWeek ?? 0,
        completedLast28Days: memberWorkload?.completedLast28Days ?? 0,
        onTimeCompletedLast28Days:
          memberWorkload?.onTimeCompletedLast28Days ?? 0,
      };
    }),
    invitations: parsed.data.invitations,
    permissions: parsed.data.permissions,
  };
}

export async function getInvitationRouteState(
  token: string,
): Promise<InvitationRouteState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { authStatus: 'anonymous' };
  if (!INVITATION_TOKEN_PATTERN.test(token)) {
    return {
      authStatus: 'authenticated',
      currentEmail: user.email ?? null,
      invitation: { status: 'invalid' },
    };
  }

  const result = await supabase.rpc('inspect_workspace_invitation', {
    p_token: token,
  });
  if (result.error) throw new Error('PTA_INVITATION_UNAVAILABLE');
  const parsed = invitationInspectionSchema.safeParse(result.data);
  if (!parsed.success) throw new Error('PTA_INVITATION_INVALID_RESPONSE');

  return {
    authStatus: 'authenticated',
    currentEmail: user.email ?? null,
    invitation: parsed.data,
  };
}
