import type {
  InvitationInspection,
  TeamManagementData,
  TeamManagementMember,
} from './schemas';
import type { TeamPageData } from '@/features/operations/types';

export type ManagedTeamMember = TeamManagementMember & {
  totalAssignedTasks: number;
  openTasks: number;
  overdueTasks: number;
  plannedWeekMinutes: number;
  estimatedWeekTasks: number;
  completedThisWeek: number;
  completedLast28Days: number;
  onTimeCompletedLast28Days: number;
};

export type TeamRouteData =
  | {
      mode: 'workload';
      workload: TeamPageData;
    }
  | {
      mode: 'management';
      workspaceId: string;
      workspaceName: string;
      members: ManagedTeamMember[];
      invitations: TeamManagementData['invitations'];
      permissions: TeamManagementData['permissions'];
    };

export type InvitationRouteState =
  | { authStatus: 'anonymous' }
  | {
      authStatus: 'authenticated';
      currentEmail: string | null;
      invitation: InvitationInspection;
    };
