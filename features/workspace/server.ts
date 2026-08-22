import 'server-only';

import { createClient } from '@/lib/supabase/server';

import type { WorkspaceContext, WorkspaceRole } from './types';

type MembershipRow = { workspace_id: string; role: WorkspaceRole };
type ProfileRow = { id: string; full_name: string };

export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const [profileResult, membershipResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('workspace_members')
      .select('workspace_id, role, created_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error || membershipResult.error) {
    throw new Error('PTA_WORKSPACE_CONTEXT_UNAVAILABLE');
  }

  const profile = profileResult.data as ProfileRow | null;
  const membership = membershipResult.data as MembershipRow | null;
  const baseUser = {
    id: user.id,
    fullName:
      profile?.full_name ??
      user.user_metadata.full_name ??
      user.email?.split('@')[0] ??
      'Usuário',
  };

  if (!membership) {
    return { user: baseUser, workspace: null, members: [] };
  }

  const [workspaceResult, membersResult] = await Promise.all([
    supabase
      .from('workspaces')
      .select('id, name, task_prefix, timezone')
      .eq('id', membership.workspace_id)
      .single(),
    supabase
      .from('workspace_members')
      .select('user_id, role')
      .eq('workspace_id', membership.workspace_id)
      .eq('status', 'active'),
  ]);

  if (workspaceResult.error || membersResult.error) {
    throw new Error('PTA_WORKSPACE_CONTEXT_UNAVAILABLE');
  }

  const workspace = workspaceResult.data as {
    id: string;
    name: string;
    task_prefix: string;
    timezone: string;
  } | null;
  if (!workspace) throw new Error('PTA_WORKSPACE_CONTEXT_UNAVAILABLE');

  const memberships = (membersResult.data ?? []) as Array<{
    user_id: string;
    role: WorkspaceRole;
  }>;
  const memberIds = memberships.map((item) => item.user_id);
  const profilesResult = memberIds.length
    ? await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', memberIds)
        .eq('is_active', true)
    : { data: [] as ProfileRow[], error: null };
  if (profilesResult.error)
    throw new Error('PTA_WORKSPACE_CONTEXT_UNAVAILABLE');
  const profilesData = profilesResult.data;
  const profiles = (profilesData ?? []) as ProfileRow[];
  const profileById = new Map(profiles.map((item) => [item.id, item]));
  const members = memberships.flatMap((item) => {
    if (item.role === 'viewer') return [];
    const memberProfile = profileById.get(item.user_id);
    return memberProfile
      ? [{ id: item.user_id, fullName: memberProfile.full_name }]
      : [];
  });

  return {
    user: baseUser,
    workspace: workspace
      ? {
          id: workspace.id,
          name: workspace.name,
          taskPrefix: workspace.task_prefix,
          timezone: workspace.timezone,
          role: membership.role,
        }
      : null,
    members,
  };
}
