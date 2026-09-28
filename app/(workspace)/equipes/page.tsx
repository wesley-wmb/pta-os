import type { Metadata } from 'next';

import Link from 'next/link';

import { UsersRound } from 'lucide-react';

import { getOperatingDirectory } from '@/features/team/directory-server';

import { TeamEditorButton } from '@/features/team/operating-team-controls';

import { TeamDirectory } from '@/features/team/team-directory';

export const metadata: Metadata = { title: 'Equipes' };

export default async function TeamsPage() {
  const { context, directory } = await getOperatingDirectory();

  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 py-8 sm:px-8 sm:py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Equipes</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Escolha uma equipe para acompanhar e organizar o trabalho.
          </p>
        </div>

        {directory.can_manage && (
          <TeamEditorButton workspaceId={context.workspace.id} />
        )}
      </header>

      <TeamDirectory teams={directory.teams} />

      <nav
        aria-label="Outras visões"
        className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 border-t pt-5 text-sm text-muted-foreground"
      >
        {context.workspace.role !== 'viewer' && (
          <Link
            href="/pessoas"
            className="inline-flex min-h-10 items-center gap-2 sm:ml-auto hover:text-foreground"
          >
            <UsersRound className="size-4" aria-hidden />
            Gerenciar pessoas
          </Link>
        )}
      </nav>
    </div>
  );
}
