import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Metadata } from 'next';

import {
  getEventsPageData,
  getHistoryPageData,
} from '@/features/operations/server';
import { HomeView } from '@/features/tasks/home-view';
import {
  currentDateInTimeZone,
  dateFromKey,
} from '@/features/tasks/date-utils';
import { getTaskPageContext } from '@/features/tasks/server';

export const metadata: Metadata = { title: 'Início' };

export default async function StartPage() {
  const { context, statuses } = await getTaskPageContext();
  const [eventsData, historyData] = await Promise.all([
    getEventsPageData().catch(() => null),
    getHistoryPageData().catch(() => null),
  ]);
  const firstName = context.user.fullName.split(/\s+/)[0];
  const todayKey = currentDateInTimeZone(context.workspace.timezone);
  const today = dateFromKey(todayKey);
  const hour = Number(
    new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      hour12: false,
      timeZone: context.workspace.timezone,
    }).format(new Date()),
  );
  const greeting =
    hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="min-h-full">
      <HomeView
        workspaceId={context.workspace.id}
        statuses={statuses}
        role={context.workspace.role}
        currentUserId={context.user.id}
        timezone={context.workspace.timezone}
        events={eventsData?.events ?? []}
        activity={historyData?.activity.slice(0, 6) ?? []}
        greeting={greeting}
        firstName={firstName}
        todayKey={todayKey}
        weekdayLabel={format(today, 'EEEE', { locale: ptBR })}
        dateLabel={format(today, "dd 'de' MMMM", { locale: ptBR })}
      />
    </div>
  );
}
