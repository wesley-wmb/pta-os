import { redirect } from 'next/navigation';

import { SettingsView } from '@/features/settings/settings-view';
import { getWorkspaceContext } from '@/features/workspace/server';

export default async function SettingsPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect('/login');
  if (!context.workspace) redirect('/inicio');

  return (
    <SettingsView
      user={context.user}
      workspace={context.workspace}
      workspaceCount={context.availableWorkspaces.length}
    />
  );
}
