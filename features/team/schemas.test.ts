import { describe, expect, it } from 'vitest';

import {
  invitationFormSchema,
  invitationInspectionSchema,
  teamManagementSchema,
} from './schemas';

const member = {
  user_id: '55b9c7a7-11a8-45d4-9f75-fac6f2f6c4c4',
  full_name: 'Ana Martins',
  email: 'ana@pta.test',
  initials: 'AM',
  avatar_path: null,
  role: 'admin',
  membership_state: 'active',
  weekly_capacity_minutes: 2400,
  joined_at: '2026-08-20T12:00:00+00:00',
  suspended_at: null,
  removed_at: null,
  version: 2,
  is_self: true,
} as const;

describe('teamManagementSchema', () => {
  it('normaliza o contrato RPC para a interface', () => {
    const result = teamManagementSchema.parse({
      workspace_id: '3d2acb70-91c3-4b96-8eb4-aea1f856ff92',
      members: [member],
      invitations: [],
      permissions: {
        can_invite: true,
        can_manage_members: true,
        can_transfer_ownership: false,
      },
    });

    expect(result.members[0]).toMatchObject({
      id: member.user_id,
      fullName: 'Ana Martins',
      membershipState: 'active',
      version: 2,
    });
    expect(result.permissions.canInvite).toBe(true);
  });

  it('rejeita versão inválida', () => {
    expect(() =>
      teamManagementSchema.parse({
        workspace_id: '3d2acb70-91c3-4b96-8eb4-aea1f856ff92',
        members: [{ ...member, version: 0 }],
        invitations: [],
        permissions: {
          can_invite: true,
          can_manage_members: true,
          can_transfer_ownership: false,
        },
      }),
    ).toThrow();
  });
});

describe('invitationInspectionSchema', () => {
  it('preserva detalhes apenas no estado pendente', () => {
    expect(
      invitationInspectionSchema.parse({
        status: 'pending',
        workspace_id: '3d2acb70-91c3-4b96-8eb4-aea1f856ff92',
        workspace_name: 'PTA',
        role: 'member',
        expires_at: '2026-08-29T12:00:00+00:00',
      }),
    ).toMatchObject({ status: 'pending', workspaceName: 'PTA' });
    expect(
      invitationInspectionSchema.parse({ status: 'email_mismatch' }),
    ).toEqual({ status: 'email_mismatch' });
  });
});

describe('invitationFormSchema', () => {
  it('normaliza e-mail e impede convite como proprietário', () => {
    expect(
      invitationFormSchema.parse({
        email: ' Pessoa@PTA.com.br ',
        role: 'member',
      }),
    ).toEqual({ email: 'pessoa@pta.com.br', role: 'member' });
    expect(
      invitationFormSchema.safeParse({
        email: 'pessoa@pta.test',
        role: 'owner',
      }).success,
    ).toBe(false);
  });
});
