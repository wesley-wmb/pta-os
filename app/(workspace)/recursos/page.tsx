import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ResourcesView } from '@/features/resources/resources-view';
import type { ResourcePermissionMember } from '@/features/resources/types';
import { getWorkspaceContext } from '@/features/workspace/server';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Central de recursos' };

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{
    recurso?: string | string[];
    modo?: string | string[];
  }>;
}) {
  const context = await getWorkspaceContext();
  if (!context) redirect('/login');
  if (!context.workspace) redirect('/inicio');
  const resolvedSearchParams = await searchParams;
  const requestedResource = resolvedSearchParams.recurso;
  const initialResourceId =
    typeof requestedResource === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      requestedResource,
    )
      ? requestedResource
      : null;
  const initialMode =
    initialResourceId && resolvedSearchParams.modo === 'editar'
      ? 'edit'
      : 'detail';
  const canManagePermissions = ['owner', 'admin'].includes(
    context.workspace.role,
  );
  const permissionMembers = canManagePermissions
    ? await getPermissionMembers(context.workspace.id, context.user.id)
    : [];

  return (
    <ResourcesView
      key={`${initialResourceId ?? 'resource-center'}:${initialMode}`}
      workspaceId={context.workspace.id}
      canCreate={['owner', 'admin', 'manager'].includes(context.workspace.role)}
      canManageRestriction={['owner', 'admin'].includes(context.workspace.role)}
      permissionMembers={permissionMembers}
      initialResourceId={initialResourceId}
      initialMode={initialMode}
    />
  );
}

async function getPermissionMembers(
  workspaceId: string,
  currentUserId: string,
): Promise<ResourcePermissionMember[]> {
  const supabase = await createClient();
  const { data: memberships, error: membershipsError } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .neq('user_id', currentUserId);

  if (membershipsError) throw new Error('PTA_RESOURCE_MEMBERS_UNAVAILABLE');
  if (!memberships?.length) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in(
      'id',
      memberships.map((member) => member.user_id),
    )
    .eq('is_active', true);

  if (profilesError) throw new Error('PTA_RESOURCE_MEMBERS_UNAVAILABLE');
  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.full_name]),
  );

  return memberships
    .flatMap((member) => {
      if (member.role === 'owner' || member.role === 'admin') return [];
      const fullName = profileById.get(member.user_id);
      return fullName
        ? [{ id: member.user_id, fullName, role: member.role }]
        : [];
    })
    .sort((left, right) =>
      left.fullName.localeCompare(right.fullName, 'pt-BR'),
    );
}
