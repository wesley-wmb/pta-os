import type { Metadata } from 'next';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { getTeamPageData } from '@/features/operations/server';
import { TeamView } from '@/features/operations/team-view';
import { InviteMemberDialog } from '@/features/team/invite-member-dialog';
import { getTeamRouteData } from '@/features/team/server';
import { TeamManagementView } from '@/features/team/team-management-view';
import { TeamOperatingModelView } from '@/features/team/team-operating-model-view';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Equipe' };

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{
    membro?: string | string[];
    visao?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const requestedView = Array.isArray(params.visao)
    ? params.visao[0]
    : params.visao;
  const view = requestedView === 'modelo' ? 'modelo' : 'pessoas';
  const routeResult =
    view === 'pessoas' ? await getTeamRouteDataSafely() : null;
  const managementUnavailable = routeResult?.managementUnavailable ?? false;
  const data = routeResult?.data ?? null;
  const requestedId = Array.isArray(params.membro)
    ? params.membro[0]
    : params.membro;
  const selectedMemberId =
    data?.mode === 'workload' &&
    data.workload.members.some((member) => member.id === requestedId)
      ? (requestedId ?? null)
      : null;

  return (
    <div>
      <PageHeader
        eyebrow={
          view === 'modelo'
            ? 'Modelo operacional'
            : 'Capacidade e responsabilidade'
        }
        title="Equipe"
        description={
          view === 'modelo'
            ? 'Entenda como pessoas, equipes, funções e entregas vão trabalhar juntas.'
            : data?.mode === 'management'
              ? 'Gerencie acessos, papéis, convites e capacidade da equipe.'
              : data?.workload.scope === 'self'
                ? 'Veja suas tarefas atribuídas e os prazos que pedem atenção.'
                : 'Veja quem está fazendo o quê e como o trabalho está distribuído.'
        }
        width="wide"
        actions={
          view === 'pessoas' && data?.mode === 'management' ? (
            <InviteMemberDialog
              workspaceId={data.workspaceId}
              disabled={!data.permissions.canInvite}
            />
          ) : null
        }
      />
      <div className="mx-auto w-full max-w-[1500px] px-5 pb-14 sm:px-8">
        <nav
          className="mb-6 flex w-fit items-center gap-1 rounded-2xl bg-muted/65 p-1"
          aria-label="Visões da equipe"
        >
          <TeamViewLink href="/equipe" active={view === 'pessoas'}>
            Pessoas
          </TeamViewLink>
          <TeamViewLink href="/equipe?visao=modelo" active={view === 'modelo'}>
            Modelo de operação
          </TeamViewLink>
        </nav>

        {view === 'modelo' ? (
          <TeamOperatingModelView />
        ) : (
          <>
            {managementUnavailable ? (
              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-pta-warning/25 bg-pta-warning/[0.07] px-4 py-3 text-sm leading-6">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-1 size-4 shrink-0 text-pta-warning"
                />
                <p>
                  A carga real da equipe continua disponível. Convites e
                  controles de acesso serão liberados após a atualização do
                  backend deste workspace.
                </p>
              </div>
            ) : null}
            {data?.mode === 'management' ? (
              <TeamManagementView data={data} />
            ) : data?.mode === 'workload' ? (
              <TeamView
                data={data.workload}
                selectedMemberId={selectedMemberId}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

async function getTeamRouteDataSafely() {
  try {
    return {
      data: await getTeamRouteData(),
      managementUnavailable: false,
    };
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !['PTA_TEAM_UNAVAILABLE', 'PTA_TEAM_INVALID_RESPONSE'].includes(
        error.message,
      )
    ) {
      throw error;
    }

    return {
      data: {
        mode: 'workload' as const,
        workload: await getTeamPageData(),
      },
      managementUnavailable: true,
    };
  }
}

function TeamViewLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-10 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground transition-[background-color,color,box-shadow] hover:bg-pta-blue/[0.07] hover:text-pta-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active &&
          'bg-card text-pta-blue shadow-sm ring-1 ring-inset ring-pta-blue/15',
      )}
    >
      {children}
    </Link>
  );
}
