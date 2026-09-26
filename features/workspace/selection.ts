import { z } from 'zod';

export const ACTIVE_WORKSPACE_COOKIE = 'pta-active-workspace';

export const workspaceIdSchema = z.uuid();

export const activeWorkspaceCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  priority: 'high' as const,
};

export function resolveSelectedWorkspaceId(
  membershipWorkspaceIds: readonly string[],
  availableWorkspaceIds: ReadonlySet<string>,
  requestedWorkspaceId: string | null,
) {
  if (
    requestedWorkspaceId &&
    availableWorkspaceIds.has(requestedWorkspaceId) &&
    membershipWorkspaceIds.includes(requestedWorkspaceId)
  ) {
    return requestedWorkspaceId;
  }

  return (
    membershipWorkspaceIds.find((workspaceId) =>
      availableWorkspaceIds.has(workspaceId),
    ) ?? null
  );
}
