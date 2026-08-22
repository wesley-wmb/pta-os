import { redirect } from 'next/navigation';

import { AppShell } from '@/components/navigation/app-shell';
import { LocalSetup } from '@/components/system/local-setup';
import { getWorkspaceContext } from '@/features/workspace/server';
import { WorkspaceBootstrap } from '@/features/workspace/workspace-bootstrap';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export default async function WorkspaceLayout({
  children,
  peek,
}: {
  children: React.ReactNode;
  peek: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) return <LocalSetup />;

  const context = await getWorkspaceContext();
  if (!context) redirect('/login');
  if (!context.workspace)
    return <WorkspaceBootstrap fullName={context.user.fullName} />;

  return (
    <AppShell
      context={{ ...context, workspace: context.workspace }}
      peek={peek}
    >
      {children}
    </AppShell>
  );
}
