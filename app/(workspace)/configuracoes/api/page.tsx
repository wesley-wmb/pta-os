import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ApiSettingsView } from '@/features/integrations/api-settings-view';
import { getApiPlatformState } from '@/features/integrations/server';
import { getWorkspaceContext } from '@/features/workspace/server';

export const metadata: Metadata = { title: 'API e integrações' };

export default async function ApiSettingsPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect('/login');
  if (!context.workspace) redirect('/inicio');
  if (!['owner', 'admin'].includes(context.workspace.role)) {
    redirect('/configuracoes');
  }

  const state = await getApiPlatformState();

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-10">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-5">
        <Link href="/configuracoes">
          <ChevronLeft aria-hidden="true" />
          Configurações
        </Link>
      </Button>
      <header className="mb-10 max-w-3xl">
        <p className="pta-eyebrow mb-2">Administração</p>
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[34px]">
          API e integrações
        </h1>
        <p className="mt-2 text-base leading-6 text-muted-foreground">
          Conecte o PTA OS ao Slack, e-mail e outros sistemas sem duplicar
          tarefas nem expor credenciais no navegador.
        </p>
      </header>
      <ApiSettingsView workspaceName={context.workspace.name} state={state} />
    </div>
  );
}
