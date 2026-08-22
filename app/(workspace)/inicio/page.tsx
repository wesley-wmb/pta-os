import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { HomeView } from '@/features/tasks/home-view';
import {
  currentDateInTimeZone,
  dateFromKey,
} from '@/features/tasks/date-utils';
import { getTaskPageContext } from '@/features/tasks/server';

export const metadata: Metadata = { title: 'Início' };

export default async function StartPage() {
  const { context, statuses } = await getTaskPageContext();
  const firstName = context.user.fullName.split(/\s+/)[0];

  return (
    <div>
      <PageHeader
        eyebrow={format(
          dateFromKey(currentDateInTimeZone(context.workspace.timezone)),
          "EEEE, d 'de' MMMM",
          { locale: ptBR },
        )}
        title={`Bom dia, ${firstName}.`}
        description="O que pede sua atenção agora, sem ruído."
      />
      <HomeView
        workspaceId={context.workspace.id}
        statuses={statuses}
        role={context.workspace.role}
        currentUserId={context.user.id}
        timezone={context.workspace.timezone}
      />
    </div>
  );
}
