import { describe, expect, it } from 'vitest';

import {
  ACTIVE_WORKSPACE_COOKIE,
  activeWorkspaceCookieOptions,
  resolveSelectedWorkspaceId,
  workspaceIdSchema,
} from './selection';

const workspaceA = '11111111-1111-4111-8111-111111111111';
const workspaceB = '22222222-2222-4222-8222-222222222222';
const workspaceC = '33333333-3333-4333-8333-333333333333';

describe('workspace selection', () => {
  it('keeps a requested workspace only when membership and workspace are active', () => {
    expect(
      resolveSelectedWorkspaceId(
        [workspaceA, workspaceB],
        new Set([workspaceA, workspaceB]),
        workspaceB,
      ),
    ).toBe(workspaceB);
  });

  it('falls back to the first available active membership', () => {
    expect(
      resolveSelectedWorkspaceId(
        [workspaceA, workspaceB],
        new Set([workspaceA, workspaceB]),
        workspaceC,
      ),
    ).toBe(workspaceA);
  });

  it('skips an active membership whose workspace is unavailable', () => {
    expect(
      resolveSelectedWorkspaceId(
        [workspaceA, workspaceB],
        new Set([workspaceB]),
        workspaceA,
      ),
    ).toBe(workspaceB);
  });

  it('returns null without an available active membership', () => {
    expect(
      resolveSelectedWorkspaceId([workspaceA], new Set(), workspaceA),
    ).toBeNull();
  });

  it('accepts only canonical UUID values and uses a protected cookie', () => {
    expect(workspaceIdSchema.safeParse(workspaceA).success).toBe(true);
    expect(workspaceIdSchema.safeParse('workspace-a').success).toBe(false);
    expect(ACTIVE_WORKSPACE_COOKIE).toBe('pta-active-workspace');
    expect(activeWorkspaceCookieOptions).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      priority: 'high',
    });
  });
});
