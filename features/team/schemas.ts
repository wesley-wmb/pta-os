import { z } from 'zod';

export const teamRoleSchema = z.enum([
  'owner',
  'admin',
  'manager',
  'member',
  'viewer',
]);

export const inviteRoleSchema = teamRoleSchema.exclude(['owner']);

export const membershipStateSchema = z.enum(['active', 'suspended', 'removed']);

export const invitationStatusSchema = z.enum([
  'pending',
  'expired',
  'accepted',
  'cancelled',
]);

const invitationSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    role: inviteRoleSchema,
    status: invitationStatusSchema,
    expires_at: z.iso.datetime({ offset: true }),
    created_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
    accepted_at: z.iso.datetime({ offset: true }).nullable(),
    cancelled_at: z.iso.datetime({ offset: true }).nullable(),
    version: z.number().int().positive(),
  })
  .transform((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expires_at,
    createdAt: invitation.created_at,
    updatedAt: invitation.updated_at,
    acceptedAt: invitation.accepted_at,
    cancelledAt: invitation.cancelled_at,
    version: invitation.version,
  }));

const memberSchema = z
  .object({
    user_id: z.uuid(),
    full_name: z.string().trim().min(1).max(160),
    email: z.email(),
    initials: z.string().trim().min(1).max(8),
    avatar_path: z.string().nullable(),
    role: teamRoleSchema,
    membership_state: membershipStateSchema,
    weekly_capacity_minutes: z.number().int().positive().nullable(),
    joined_at: z.iso.datetime({ offset: true }),
    suspended_at: z.iso.datetime({ offset: true }).nullable(),
    removed_at: z.iso.datetime({ offset: true }).nullable(),
    version: z.number().int().positive(),
    is_self: z.boolean(),
  })
  .transform((member) => ({
    id: member.user_id,
    fullName: member.full_name,
    email: member.email,
    initials: member.initials,
    avatarPath: member.avatar_path,
    role: member.role,
    membershipState: member.membership_state,
    weeklyCapacityMinutes: member.weekly_capacity_minutes,
    joinedAt: member.joined_at,
    suspendedAt: member.suspended_at,
    removedAt: member.removed_at,
    version: member.version,
    isSelf: member.is_self,
  }));

export const teamManagementSchema = z
  .object({
    workspace_id: z.uuid(),
    members: z.array(memberSchema),
    invitations: z.array(invitationSchema),
    permissions: z.object({
      can_invite: z.boolean(),
      can_manage_members: z.boolean(),
      can_transfer_ownership: z.boolean(),
    }),
  })
  .transform((data) => ({
    workspaceId: data.workspace_id,
    members: data.members,
    invitations: data.invitations,
    permissions: {
      canInvite: data.permissions.can_invite,
      canManageMembers: data.permissions.can_manage_members,
      canTransferOwnership: data.permissions.can_transfer_ownership,
    },
  }));

export const createInvitationResultSchema = z.object({
  invitation: invitationSchema,
  raw_token: z.string().regex(/^[0-9a-f]{64}$/i),
});

export const cancelInvitationResultSchema = z.object({
  invitation: invitationSchema,
});

const invitationTerminalStateSchema = z.object({
  status: z.enum([
    'invalid',
    'email_mismatch',
    'expired',
    'cancelled',
    'accepted',
  ]),
});

const pendingInvitationInspectionSchema = z
  .object({
    status: z.literal('pending'),
    workspace_id: z.uuid(),
    workspace_name: z.string().trim().min(1).max(160),
    role: inviteRoleSchema,
    expires_at: z.iso.datetime({ offset: true }),
  })
  .transform((invitation) => ({
    status: invitation.status,
    workspaceId: invitation.workspace_id,
    workspaceName: invitation.workspace_name,
    role: invitation.role,
    expiresAt: invitation.expires_at,
  }));

export const invitationInspectionSchema = z.union([
  pendingInvitationInspectionSchema,
  invitationTerminalStateSchema,
]);

export const acceptInvitationResultSchema = z
  .object({
    workspace_id: z.uuid(),
    workspace_name: z.string().trim().min(1).max(160),
    user_id: z.uuid(),
    role: teamRoleSchema,
    status: z.literal('active'),
    membership_state: z.literal('active'),
    version: z.number().int().positive(),
    already_accepted: z.boolean(),
  })
  .transform((result) => ({
    workspaceId: result.workspace_id,
    workspaceName: result.workspace_name,
    userId: result.user_id,
    role: result.role,
    membershipState: result.membership_state,
    version: result.version,
    alreadyAccepted: result.already_accepted,
  }));

const memberMutationMemberSchema = z.object({
  user_id: z.uuid(),
  role: teamRoleSchema,
  membership_state: membershipStateSchema,
  suspended_at: z.iso.datetime({ offset: true }).nullable(),
  removed_at: z.iso.datetime({ offset: true }).nullable(),
  version: z.number().int().positive(),
});

export const memberMutationResultSchema = z
  .object({ member: memberMutationMemberSchema })
  .transform((result) => ({
    member: {
      id: result.member.user_id,
      role: result.member.role,
      membershipState: result.member.membership_state,
      suspendedAt: result.member.suspended_at,
      removedAt: result.member.removed_at,
      version: result.member.version,
    },
  }));

export const transferOwnershipResultSchema = z.object({
  previous_owner: memberMutationMemberSchema,
  new_owner: memberMutationMemberSchema,
});

export const invitationFormSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(
      z.email('Informe um e-mail válido.').max(320, 'O e-mail é muito longo.'),
    ),
  role: inviteRoleSchema,
});

export type TeamRole = z.infer<typeof teamRoleSchema>;
export type InviteRole = z.infer<typeof inviteRoleSchema>;
export type MembershipState = z.infer<typeof membershipStateSchema>;
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;
export type TeamManagementData = z.infer<typeof teamManagementSchema>;
export type TeamManagementMember = TeamManagementData['members'][number];
export type TeamInvitation = TeamManagementData['invitations'][number];
export type InvitationInspection = z.infer<typeof invitationInspectionSchema>;
export type InvitationFormInput = z.input<typeof invitationFormSchema>;
