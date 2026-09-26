import 'server-only';

import type { PostgrestError } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import {
  ACTIVE_WORKSPACE_COOKIE,
  resolveSelectedWorkspaceId,
  workspaceIdSchema,
} from './selection';
import type {
  AvailableWorkspace,
  WorkspaceContext,
  WorkspaceRole,
} from './types';

type MembershipRow = {
  workspace_id: string;
  role: WorkspaceRole;
  created_at: string;
};
type ProfileRow = { id: string; full_name: string; avatar_path: string | null };
type WorkspaceRow = {
  id: string;
  name: string;
  task_prefix: string;
  timezone: string;
};

export const getWorkspaceContext = cache(
  async (): Promise<WorkspaceContext | null> => {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return null;

    const [profileResult, membershipsResult, cookieStore] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, avatar_path')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('workspace_members')
        .select('workspace_id, role, created_at')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: true }),
      cookies(),
    ]);

    if (profileResult.error || membershipsResult.error) {
      throwWorkspaceContextUnavailable('identity', [
        profileResult.error,
        membershipsResult.error,
      ]);
    }

    const profile = profileResult.data as ProfileRow | null;
    const memberships = (membershipsResult.data ?? []) as MembershipRow[];
    const baseUser = {
      id: user.id,
      fullName:
        profile?.full_name ??
        user.user_metadata.full_name ??
        user.email?.split('@')[0] ??
        'Usuário',
      avatarUrl: profile?.avatar_path ?? null,
    };

    if (!memberships.length) {
      return emptyWorkspaceContext(baseUser);
    }

    const membershipWorkspaceIds = memberships.map(
      (membership) => membership.workspace_id,
    );
    const workspacesResult = await supabase
      .from('workspaces')
      .select('id, name, task_prefix, timezone')
      .in('id', membershipWorkspaceIds)
      .is('archived_at', null);

    if (workspacesResult.error) {
      throwWorkspaceContextUnavailable('workspaces', [workspacesResult.error]);
    }

    const workspaceRows = (workspacesResult.data ?? []) as WorkspaceRow[];
    const workspaceById = new Map(
      workspaceRows.map((workspace) => [workspace.id, workspace]),
    );
    const availableWorkspaces = memberships.flatMap<AvailableWorkspace>(
      (membership) => {
        const workspace = workspaceById.get(membership.workspace_id);
        return workspace
          ? [{ id: workspace.id, name: workspace.name, role: membership.role }]
          : [];
      },
    );
    const requestedWorkspaceIdResult = workspaceIdSchema.safeParse(
      cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value,
    );
    const selectedWorkspaceId = resolveSelectedWorkspaceId(
      membershipWorkspaceIds,
      new Set(workspaceRows.map((workspace) => workspace.id)),
      requestedWorkspaceIdResult.success
        ? requestedWorkspaceIdResult.data
        : null,
    );

    if (!selectedWorkspaceId) {
      return emptyWorkspaceContext(baseUser);
    }

    const membership = memberships.find(
      (candidate) => candidate.workspace_id === selectedWorkspaceId,
    );
    const workspace = workspaceById.get(selectedWorkspaceId);
    if (!membership || !workspace) {
      throwWorkspaceContextUnavailable('selection');
    }

    const membersResult = await supabase
      .from('workspace_members')
      .select('user_id, role')
      .eq('workspace_id', selectedWorkspaceId)
      .eq('status', 'active');

    if (membersResult.error) {
      throwWorkspaceContextUnavailable('members', [membersResult.error]);
    }

    const selectedMemberships = (membersResult.data ?? []) as Array<{
      user_id: string;
      role: WorkspaceRole;
    }>;
    const memberIds = selectedMemberships.map((item) => item.user_id);
    const profilesResult = memberIds.length
      ? await supabase
          .from('profiles')
          .select('id, full_name, avatar_path')
          .in('id', memberIds)
          .eq('is_active', true)
      : { data: [] as ProfileRow[], error: null };
    if (profilesResult.error) {
      throwWorkspaceContextUnavailable('member-profiles', [
        profilesResult.error,
      ]);
    }

    const profiles = (profilesResult.data ?? []) as ProfileRow[];
    const profileById = new Map(profiles.map((item) => [item.id, item]));
    const members = selectedMemberships.flatMap((item) => {
      if (item.role === 'viewer') return [];
      const memberProfile = profileById.get(item.user_id);
      return memberProfile
        ? [{ id: item.user_id, fullName: memberProfile.full_name }]
        : [];
    });

    return {
      user: baseUser,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        taskPrefix: workspace.task_prefix,
        timezone: workspace.timezone,
        role: membership.role,
      },
      availableWorkspaces,
      members,
    };
  },
);

function throwWorkspaceContextUnavailable(
  stage: string,
  errors: Array<PostgrestError | null> = [],
): never {
  console.error('PTA_WORKSPACE_CONTEXT_UNAVAILABLE', {
    stage,
    errors: errors.filter(Boolean).map((error) => ({
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    })),
  });

  throw new Error('PTA_WORKSPACE_CONTEXT_UNAVAILABLE');
}

function emptyWorkspaceContext(
  user: WorkspaceContext['user'],
): WorkspaceContext {
  return {
    user,
    workspace: null,
    availableWorkspaces: [],
    members: [],
  };
}
