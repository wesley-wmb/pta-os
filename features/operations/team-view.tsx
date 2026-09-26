import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock3, ShieldCheck, UsersRound } from 'lucide-react';

import type { WorkspaceRole } from '@/features/workspace/types';
import { cn } from '@/lib/utils';

import { FocusedOperationItem } from './focused-operation-item';
import { InitialsMark, OperationEmptyState } from './shared';
import type { TeamMemberSummary, TeamPageData } from './types';

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gestor',
  member: 'Membro',
  viewer: 'Leitura',
};

export function TeamView({
  data,
  selectedMemberId = null,
}: {
  data: TeamPageData;
  selectedMemberId?: string | null;
}) {
  if (!data.members.length) {
    return (
      <OperationEmptyState
        icon={UsersRound}
        title="Nenhum membro ativo encontrado"
      />
    );
  }

  const openTasks = data.members.reduce(
    (total, member) => total + member.openTasks,
    0,
  );
  const overdueTasks = data.members.reduce(
    (total, member) => total + member.overdueTasks,
    0,
  );
  const totalCapacity = data.members.reduce(
    (total, member) => total + (member.weeklyCapacityMinutes ?? 0),
    0,
  );
  const membersWithCapacity = data.members.filter(
    (member) => member.weeklyCapacityMinutes,
  ).length;
  const totalPlannedMinutes = data.members.reduce(
    (total, member) => total + member.plannedWeekMinutes,
    0,
  );
  const completedLast28Days = data.members.reduce(
    (total, member) => total + member.completedLast28Days,
    0,
  );
  const onTimeCompletedLast28Days = data.members.reduce(
    (total, member) => total + member.onTimeCompletedLast28Days,
    0,
  );
  const predictabilityRate = completedLast28Days
    ? Math.round((onTimeCompletedLast28Days / completedLast28Days) * 100)
    : null;

  return (
    <>
      <section
        className="grid gap-4 lg:grid-cols-5"
        aria-label="Capacidade da equipe"
      >
        <TeamLoadOverview
          members={data.members}
          totalCapacity={totalCapacity}
          totalPlannedMinutes={totalPlannedMinutes}
          membersWithCapacity={membersWithCapacity}
        />
        <DeliveryPredictability
          openTasks={openTasks}
          overdueTasks={overdueTasks}
          completedLast28Days={completedLast28Days}
          onTimeCompletedLast28Days={onTimeCompletedLast28Days}
          predictabilityRate={predictabilityRate}
        />
      </section>

      <section className="mt-5" aria-labelledby="team-list-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <p className="pta-eyebrow">Pessoas</p>
            <h2
              id="team-list-title"
              className="mt-1 text-xl font-semibold tracking-[-0.025em]"
            >
              Carga por pessoa
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {data.members.length}{' '}
            {data.members.length === 1 ? 'pessoa ativa' : 'pessoas ativas'}
          </p>
        </div>
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {data.members.map((member) => (
            <FocusedOperationItem
              key={member.id}
              id={`membro-${member.id}`}
              active={member.id === selectedMemberId}
              className="rounded-2xl"
            >
              <TeamMemberCard member={member} />
            </FocusedOperationItem>
          ))}
        </ul>
      </section>
    </>
  );
}

function TeamLoadOverview({
  members,
  totalCapacity,
  totalPlannedMinutes,
  membersWithCapacity,
}: {
  members: TeamMemberSummary[];
  totalCapacity: number;
  totalPlannedMinutes: number;
  membersWithCapacity: number;
}) {
  const rankedMembers = [...members]
    .sort((a, b) => b.openTasks - a.openTasks)
    .slice(0, 6);
  const teamLoad = totalCapacity
    ? Math.round((totalPlannedMinutes / totalCapacity) * 100)
    : null;

  return (
    <article className="rounded-2xl border bg-card p-6  sm:p-7 lg:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="pta-eyebrow">Capacidade</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em]">
            Carga atual da equipe
          </h2>
        </div>
        <div className="text-right">
          <strong className="block text-3xl font-semibold tracking-[-0.04em]">
            {teamLoad === null ? 'Sem capacidade' : `${teamLoad}%`}
          </strong>
          <span className="text-xs text-muted-foreground">
            {formatMinutes(totalPlannedMinutes)} de{' '}
            {formatMinutes(totalCapacity)} planejadas
          </span>
        </div>
      </div>

      <div className="mt-7 space-y-4">
        {rankedMembers.map((member) => {
          const relativeLoad = member.weeklyCapacityMinutes
            ? Math.round(
                (member.plannedWeekMinutes / member.weeklyCapacityMinutes) *
                  100,
              )
            : null;
          return (
            <div
              key={member.id}
              className="grid grid-cols-[minmax(96px,0.45fr)_minmax(0,1fr)_auto] items-center gap-3"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <InitialsMark
                  initials={member.initials}
                  className="size-7 rounded-full bg-pta-blue/10 text-xs text-pta-blue"
                />
                <span className="truncate">{member.fullName}</span>
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn(
                    'block h-full rounded-full bg-pta-blue',
                    relativeLoad !== null &&
                      relativeLoad > 100 &&
                      'bg-pta-warning',
                  )}
                  style={{ width: `${Math.min(relativeLoad ?? 0, 100)}%` }}
                />
              </span>
              <span className="w-16 text-right text-xs font-semibold tabular-nums">
                {relativeLoad === null ? 'Sem dado' : `${relativeLoad}%`}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-6 rounded-2xl bg-pta-blue/[0.06] px-4 py-3 text-xs leading-5 text-muted-foreground">
        {membersWithCapacity} de {members.length}{' '}
        {members.length === 1 ? 'pessoa tem' : 'pessoas têm'} capacidade semanal
        cadastrada. As barras usam apenas demandas desta semana com esforço
        estimado.
      </p>
    </article>
  );
}

function DeliveryPredictability({
  openTasks,
  overdueTasks,
  completedLast28Days,
  onTimeCompletedLast28Days,
  predictabilityRate,
}: {
  openTasks: number;
  overdueTasks: number;
  completedLast28Days: number;
  onTimeCompletedLast28Days: number;
  predictabilityRate: number | null;
}) {
  return (
    <article className="rounded-2xl border bg-card p-6  sm:p-7 lg:col-span-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="pta-eyebrow">Entregas</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em]">
            Previsibilidade
          </h2>
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-semibold',
            predictabilityRate !== null && predictabilityRate < 80
              ? 'bg-pta-warning/10 text-pta-warning'
              : 'bg-pta-blue/10 text-pta-blue',
          )}
        >
          {predictabilityRate === null
            ? 'Sem amostra'
            : predictabilityRate >= 80
              ? 'Saudável'
              : 'Pede atenção'}
        </span>
      </div>

      <div className="mt-8 flex flex-col items-center gap-6 sm:flex-row">
        <div
          className="grid size-32 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(var(--pta-blue) ${(predictabilityRate ?? 0) * 3.6}deg, var(--muted) 0deg)`,
          }}
          role="img"
          aria-label={
            predictabilityRate === null
              ? 'Sem entregas suficientes para calcular previsibilidade'
              : `${predictabilityRate}% das entregas foram concluídas no prazo`
          }
        >
          <div className="grid size-24 place-items-center rounded-full bg-card">
            <strong className="text-3xl font-semibold tracking-[-0.04em]">
              {predictabilityRate === null ? '--' : `${predictabilityRate}%`}
            </strong>
          </div>
        </div>
        <div>
          <p className="font-semibold">Entregas no prazo</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {onTimeCompletedLast28Days} de {completedLast28Days} demandas com
            prazo foram concluídas no tempo previsto nos últimos 28 dias.
          </p>
        </div>
      </div>

      <dl className="mt-7 grid grid-cols-2 gap-3">
        <QueueMetric label="Abertas agora" value={openTasks} />
        <QueueMetric label="Atrasadas" value={overdueTasks} danger />
      </dl>
    </article>
  );
}

function QueueMetric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-muted/55 px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'mt-1 text-2xl font-semibold tracking-[-0.035em]',
          danger && value > 0 && 'text-destructive',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function TeamMemberCard({ member }: { member: TeamMemberSummary }) {
  return (
    <article className="flex min-h-[240px] flex-col rounded-2xl border bg-card p-5  transition-[border-color,box-shadow,transform]  hover:border-pta-blue/35 ">
      <div className="flex min-w-0 items-start gap-3">
        <InitialsMark
          initials={member.initials}
          className={cn(
            'size-11 rounded-full bg-pta-blue/10 text-pta-blue',
            member.isCurrentUser && 'ring-2 ring-pta-blue/25',
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold">
              {member.fullName}
            </h3>
            {member.isCurrentUser ? (
              <span className="rounded-full bg-pta-blue/10 px-2 py-0.5 text-xs font-semibold text-pta-blue">
                Você
              </span>
            ) : null}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            {ROLE_LABEL[member.role]}
          </p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-2">
        <MemberMetric label="Abertas" value={member.openTasks} />
        <MemberMetric label="Concluídas" value={member.completedThisWeek} />
        <MemberMetric
          label="Atrasadas"
          value={member.overdueTasks}
          danger={member.overdueTasks > 0}
        />
      </dl>

      <div className="mt-auto rounded-2xl bg-muted/45 px-4 py-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-2">
          <Clock3 aria-hidden="true" className="size-3.5 text-pta-blue" />
          {member.weeklyCapacityMinutes
            ? `${formatMinutes(member.plannedWeekMinutes)} de ${formatMinutes(member.weeklyCapacityMinutes)} planejadas`
            : 'Capacidade semanal não informada'}
        </p>
        <p className="mt-2">
          {member.estimatedWeekTasks}{' '}
          {member.estimatedWeekTasks === 1
            ? 'demanda estimada nesta semana'
            : 'demandas estimadas nesta semana'}
        </p>
        <p className="mt-2">
          No workspace desde{' '}
          {format(new Date(member.joinedAt), "MMM 'de' yyyy", {
            locale: ptBR,
          })}
        </p>
      </div>
    </article>
  );
}

function MemberMetric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl bg-muted/45 px-3 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'mt-1 text-xl font-semibold tracking-[-0.04em]',
          danger && 'text-destructive',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  return remainder ? `${hours}h ${remainder}min` : `${hours}h`;
}
