import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { getTaskPageContext } from '@/features/tasks/server';
import { WeekView } from '@/features/tasks/week-view';
import { calendarWeekKeys, dateFromKey } from '@/features/tasks/date-utils';

export const metadata: Metadata = { title: 'Minha semana' };

export default async function WeekPage() {
  const { context } = await getTaskPageContext();
  const week = calendarWeekKeys(context.workspace.timezone);
  const start = dateFromKey(week[0]);
  const end = dateFromKey(week[6]);

  return (
    <div>
      <PageHeader
        eyebrow={`${format(start, 'd MMM', { locale: ptBR })} — ${format(end, 'd MMM', { locale: ptBR })}`}
        title="Minha semana"
        description="Distribua as demandas pelos dias e preserve a visão do todo."
      />
      <WeekView
        workspaceId={context.workspace.id}
        role={context.workspace.role}
        currentUserId={context.user.id}
        timezone={context.workspace.timezone}
      />
    </div>
  );
}
