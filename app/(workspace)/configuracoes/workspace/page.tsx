import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { WorkspaceSettingsForm } from '@/features/workspace/workspace-settings-form';
import { getWorkspaceSettings } from '@/features/workspace/workspace-settings-server';

export const metadata: Metadata = { title: 'Workspace' };

export default async function WorkspaceSettingsPage() {
  const settings = await getWorkspaceSettings();

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-10">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-5">
        <Link href="/configuracoes">
          <ChevronLeft aria-hidden="true" />
          Configurações
        </Link>
      </Button>

      <header className="mb-9 max-w-2xl">
        <p className="pta-eyebrow mb-2">Administração</p>
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[34px]">
          Workspace
        </h1>
        <p className="mt-2 text-base leading-6 text-muted-foreground">
          Defina a identidade, o calendário e os padrões compartilhados da sua
          operação.
        </p>
      </header>

      <WorkspaceSettingsForm initialSettings={settings} />
    </div>
  );
}
