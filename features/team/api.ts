'use client';

import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/database.types';

import {
  acceptInvitationResultSchema,
  cancelInvitationResultSchema,
  createInvitationResultSchema,
  memberMutationResultSchema,
  transferOwnershipResultSchema,
  type InviteRole,
  type TeamRole,
} from './schemas';

export class TeamApiError extends Error {
  constructor(
    readonly code: string,
    options?: { cause?: unknown },
  ) {
    super(code, options);
    this.name = 'TeamApiError';
  }
}

export async function createWorkspaceInvitation(input: {
  workspaceId: string;
  email: string;
  role: InviteRole;
}) {
  const data = await callRpc('create_workspace_invitation', {
    p_workspace_id: input.workspaceId,
    p_email: input.email,
    p_role: input.role,
    p_expires_in_days: 7,
  });
  const parsed = createInvitationResultSchema.safeParse(data);
  if (!parsed.success) throw new TeamApiError('PTA_TEAM_INVALID_RESPONSE');
  return {
    invitation: parsed.data.invitation,
    rawToken: parsed.data.raw_token,
  };
}

export async function cancelWorkspaceInvitation(invitationId: string) {
  const data = await callRpc('cancel_workspace_invitation', {
    p_invitation_id: invitationId,
  });
  const parsed = cancelInvitationResultSchema.safeParse(data);
  if (!parsed.success) throw new TeamApiError('PTA_TEAM_INVALID_RESPONSE');
  return parsed.data;
}

export async function changeWorkspaceMemberRole(input: {
  workspaceId: string;
  userId: string;
  role: TeamRole;
  expectedVersion: number;
}) {
  return parseMemberMutation(
    await callRpc('change_workspace_member_role', {
      p_workspace_id: input.workspaceId,
      p_user_id: input.userId,
      p_role: input.role,
      p_expected_version: input.expectedVersion,
    }),
  );
}

export async function suspendWorkspaceMember(input: {
  workspaceId: string;
  userId: string;
  expectedVersion: number;
}) {
  return parseMemberMutation(
    await callRpc('suspend_workspace_member', {
      p_workspace_id: input.workspaceId,
      p_user_id: input.userId,
      p_expected_version: input.expectedVersion,
    }),
  );
}

export async function reactivateWorkspaceMember(input: {
  workspaceId: string;
  userId: string;
  expectedVersion: number;
}) {
  return parseMemberMutation(
    await callRpc('reactivate_workspace_member', {
      p_workspace_id: input.workspaceId,
      p_user_id: input.userId,
      p_expected_version: input.expectedVersion,
    }),
  );
}

export async function removeWorkspaceMember(input: {
  workspaceId: string;
  userId: string;
  expectedVersion: number;
}) {
  return parseMemberMutation(
    await callRpc('remove_workspace_member', {
      p_workspace_id: input.workspaceId,
      p_user_id: input.userId,
      p_expected_version: input.expectedVersion,
    }),
  );
}

export async function transferWorkspaceOwnership(input: {
  workspaceId: string;
  newOwnerId: string;
  expectedOwnerVersion: number;
  expectedNewOwnerVersion: number;
}) {
  const data = await callRpc('transfer_workspace_ownership', {
    p_workspace_id: input.workspaceId,
    p_new_owner_id: input.newOwnerId,
    p_expected_owner_version: input.expectedOwnerVersion,
    p_expected_new_owner_version: input.expectedNewOwnerVersion,
  });
  const parsed = transferOwnershipResultSchema.safeParse(data);
  if (!parsed.success) throw new TeamApiError('PTA_TEAM_INVALID_RESPONSE');
  return parsed.data;
}

export async function acceptWorkspaceInvitation(token: string) {
  const data = await callRpc('accept_workspace_invitation', {
    p_token: token,
  });
  const parsed = acceptInvitationResultSchema.safeParse(data);
  if (!parsed.success) throw new TeamApiError('PTA_TEAM_INVALID_RESPONSE');
  return parsed.data;
}

function parseMemberMutation(data: unknown) {
  const parsed = memberMutationResultSchema.safeParse(data);
  if (!parsed.success) throw new TeamApiError('PTA_TEAM_INVALID_RESPONSE');
  return parsed.data;
}

async function callRpc<Name extends TeamRpcName>(
  name: Name,
  args: TeamRpcArgs<Name>,
) {
  const supabase = createClient();
  const result = await supabase.rpc(name, args);
  if (result.error) {
    throw new TeamApiError(result.error.message || 'PTA_TEAM_MUTATION_FAILED', {
      cause: result.error,
    });
  }
  return result.data as unknown;
}

type TeamRpcName =
  | 'accept_workspace_invitation'
  | 'cancel_workspace_invitation'
  | 'change_workspace_member_role'
  | 'create_workspace_invitation'
  | 'reactivate_workspace_member'
  | 'remove_workspace_member'
  | 'suspend_workspace_member'
  | 'transfer_workspace_ownership';

type TeamRpcArgs<Name extends TeamRpcName> =
  Database['public']['Functions'][Name]['Args'];
