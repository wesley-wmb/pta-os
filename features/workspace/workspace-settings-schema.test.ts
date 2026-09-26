import { describe, expect, it } from 'vitest';

import {
  workspaceSettingsFormSchema,
  workspaceSettingsResponseSchema,
} from './workspace-settings-schema';

describe('workspace settings schemas', () => {
  it('normalizes identity and working days', () => {
    const result = workspaceSettingsFormSchema.parse({
      workspaceId: 'c2dfc7ec-a53d-4480-8c25-d4beb72770a1',
      expectedVersion: 2,
      name: '  Operação PTA  ',
      taskPrefix: ' pt2 ',
      accentColor: '#0066cc',
      timezone: 'America/Sao_Paulo',
      weekStartsOn: 1,
      workingDays: [5, 1, 1, 3],
      defaultDueTime: '18:00',
      notificationDigest: true,
    });

    expect(result.name).toBe('Operação PTA');
    expect(result.taskPrefix).toBe('PT2');
    expect(result.accentColor).toBe('#0066CC');
    expect(result.workingDays).toEqual([1, 3, 5]);
  });

  it('requires at least one valid working day', () => {
    const base = {
      workspaceId: 'c2dfc7ec-a53d-4480-8c25-d4beb72770a1',
      expectedVersion: 1,
      name: 'PTA',
      taskPrefix: 'PTA',
      accentColor: '#0066CC',
      timezone: 'America/Sao_Paulo',
      weekStartsOn: 1,
      defaultDueTime: '18:00',
      notificationDigest: true,
    };

    expect(
      workspaceSettingsFormSchema.safeParse({ ...base, workingDays: [] })
        .success,
    ).toBe(false);
    expect(
      workspaceSettingsFormSchema.safeParse({ ...base, workingDays: [7] })
        .success,
    ).toBe(false);
  });

  it('fills absent role counters without exposing member details', () => {
    const result = workspaceSettingsResponseSchema.parse({
      workspace_id: 'c2dfc7ec-a53d-4480-8c25-d4beb72770a1',
      name: 'PTA',
      task_prefix: 'PTA',
      accent_color: '#0066cc',
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
      week_starts_on: 1,
      working_days: [1, 2, 3, 4, 5],
      default_due_time: '18:00',
      notification_digest: true,
      version: 1,
      role: 'admin',
      role_counts: { owner: 1, member: 4 },
      permissions: {
        can_edit: true,
        can_manage_members: true,
        can_transfer_ownership: false,
      },
    });

    expect(result.roleCounts).toEqual({
      owner: 1,
      admin: 0,
      manager: 0,
      member: 4,
      viewer: 0,
    });
    expect(result.permissions.canTransferOwnership).toBe(false);
    expect(result.backendAvailable).toBe(true);
  });

  it('keeps legacy settings read-only while the backend RPC is unavailable', () => {
    const result = workspaceSettingsResponseSchema.parse({
      workspace_id: 'c2dfc7ec-a53d-4480-8c25-d4beb72770a1',
      name: 'PTA',
      task_prefix: 'PTA',
      accent_color: '#0066CC',
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
      week_starts_on: 1,
      working_days: [1, 2, 3, 4, 5],
      default_due_time: '18:00',
      notification_digest: true,
      version: 1,
      role: 'owner',
      role_counts: { owner: 1 },
      permissions: {
        can_edit: true,
        can_manage_members: true,
        can_transfer_ownership: true,
      },
      backend_available: false,
    });

    expect(result.permissions.canEdit).toBe(true);
    expect(result.backendAvailable).toBe(false);
  });
});
