import 'server-only';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { getWorkspaceContext } from './server';
import {
  workspaceSettingsResponseSchema,
  type WorkspaceSettings,
} from './workspace-settings-schema';

export async function getWorkspaceSettings(): Promise<WorkspaceSettings> {
  const context = await getWorkspaceContext();
  if (!context) redirect('/login');
  if (!context.workspace) redirect('/inicio');

  const supabase = await createClient();
  const result = await supabase.rpc('get_workspace_settings', {
    p_workspace_id: context.workspace.id,
  });

  if (result.error) {
    if (
      result.error.code === 'PGRST202' ||
      result.error.message.includes('get_workspace_settings')
    ) {
      return getLegacyWorkspaceSettings(context.workspace);
    }
    throw new Error('PTA_WORKSPACE_SETTINGS_UNAVAILABLE');
  }
  const parsed = workspaceSettingsResponseSchema.safeParse(result.data);
  if (!parsed.success || parsed.data.workspaceId !== context.workspace.id) {
    throw new Error('PTA_WORKSPACE_SETTINGS_INVALID_RESPONSE');
  }

  return parsed.data;
}

async function getLegacyWorkspaceSettings(workspace: {
  id: string;
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
}) {
  const supabase = await createClient();
  const [workspaceResult, preferencesResult, membersResult] = await Promise.all(
    [
      supabase
        .from('workspaces')
        .select(
          'id, name, task_prefix, accent_color, timezone, locale, week_starts_on, working_days, default_due_time',
        )
        .eq('id', workspace.id)
        .is('archived_at', null)
        .maybeSingle(),
      supabase
        .from('workspace_preferences')
        .select('notification_digest')
        .eq('workspace_id', workspace.id)
        .maybeSingle(),
      supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspace.id)
        .eq('status', 'active'),
    ],
  );

  if (workspaceResult.error || !workspaceResult.data || membersResult.error) {
    throw new Error('PTA_WORKSPACE_SETTINGS_UNAVAILABLE');
  }

  const roleCounts = {
    owner: 0,
    admin: 0,
    manager: 0,
    member: 0,
    viewer: 0,
  };
  for (const member of membersResult.data ?? []) roleCounts[member.role] += 1;
  const canEdit = workspace.role === 'owner' || workspace.role === 'admin';
  const legacy = workspaceResult.data;
  const parsed = workspaceSettingsResponseSchema.safeParse({
    workspace_id: legacy.id,
    name: legacy.name,
    task_prefix: legacy.task_prefix,
    accent_color: legacy.accent_color,
    timezone: legacy.timezone,
    locale: legacy.locale,
    week_starts_on: legacy.week_starts_on,
    working_days: legacy.working_days,
    default_due_time: String(legacy.default_due_time).slice(0, 5),
    notification_digest: preferencesResult.data?.notification_digest ?? true,
    version: 1,
    role: workspace.role,
    role_counts: roleCounts,
    permissions: {
      can_edit: canEdit,
      can_manage_members: canEdit,
      can_transfer_ownership: workspace.role === 'owner',
    },
    backend_available: false,
  });

  if (!parsed.success)
    throw new Error('PTA_WORKSPACE_SETTINGS_INVALID_RESPONSE');
  return parsed.data;
}
