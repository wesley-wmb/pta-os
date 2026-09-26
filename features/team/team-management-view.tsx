'use client';

import {
  AlertTriangle,
  Clock3,
  LoaderCircle,
  Mail,
  RotateCw,
  Search,
  UserCheck,
  UserRoundX,
  UsersRound,
  XCircle,
} from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  InitialsMark,
  OperationEmptyState,
} from '@/features/operations/shared';
import { cn } from '@/lib/utils';

import { cancelWorkspaceInvitation, createWorkspaceInvitation } from './api';
import { teamMutationErrorMessage } from './errors';
import {
  createInvitationUrl,
  InvitationLinkDialog,
} from './invitation-link-dialog';
import {
  formatCapacity,
  formatTeamDate,
  INVITATION_STATUS_LABEL,
  MEMBERSHIP_STATE_LABEL,
  TEAM_ROLE_LABEL,
} from './labels';
import { MemberActionsMenu } from './member-actions-menu';
import type {
  InvitationStatus,
  MembershipState,
  TeamInvitation,
  TeamRole,
} from './schemas';
import type { ManagedTeamMember, TeamRouteData } from './types';

type ManagementData = Extract<TeamRouteData, { mode: 'management' }>;
type GeneratedInvite = { email: string; url: string };

export function TeamManagementView({ data }: { data: ManagementData }) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<'all' | TeamRole>('all');
  const [membershipState, setMembershipState] = useState<
    'all' | MembershipState
  >('all');
  const deferredQuery = useDeferredValue(
    query.trim().toLocaleLowerCase('pt-BR'),
  );

  const members = useMemo(
    () =>
      data.members.filter((member) => {
        if (role !== 'all' && member.role !== role) return false;
        if (
          membershipState !== 'all' &&
          member.membershipState !== membershipState
        ) {
          return false;
        }
        if (!deferredQuery) return true;
        return `${member.fullName} ${member.email}`
          .toLocaleLowerCase('pt-BR')
          .includes(deferredQuery);
      }),
    [data.members, deferredQuery, membershipState, role],
  );

  const activeCount = data.members.filter(
    (member) => member.membershipState === 'active',
  ).length;
  const suspendedCount = data.members.filter(
    (member) => member.membershipState === 'suspended',
  ).length;
  const pendingCount = data.invitations.filter(
    (invitation) => invitation.status === 'pending',
  ).length;
  const currentOwnerVersion =
    data.members.find((member) => member.role === 'owner')?.version ?? null;
  const activeMembers = data.members.filter(
    (member) => member.membershipState === 'active',
  );
  const totalCapacity = activeMembers.reduce(
    (total, member) => total + (member.weeklyCapacityMinutes ?? 0),
    0,
  );
  const membersWithCapacity = activeMembers.filter(
    (member) => member.weeklyCapacityMinutes,
  ).length;
  const totalPlannedMinutes = activeMembers.reduce(
    (total, member) => total + member.plannedWeekMinutes,
    0,
  );
  const completedLast28Days = activeMembers.reduce(
    (total, member) => total + member.completedLast28Days,
    0,
  );
  const onTimeCompletedLast28Days = activeMembers.reduce(
    (total, member) => total + member.onTimeCompletedLast28Days,
    0,
  );

  return (
    <div>
      <ManagementOverview
        members={activeMembers}
        activeCount={activeCount}
        pendingCount={pendingCount}
        suspendedCount={suspendedCount}
        totalCapacity={totalCapacity}
        totalPlannedMinutes={totalPlannedMinutes}
        membersWithCapacity={membersWithCapacity}
        completedLast28Days={completedLast28Days}
        onTimeCompletedLast28Days={onTimeCompletedLast28Days}
      />

      <section className="mt-5" aria-labelledby="member-list-title">
        <div className="flex flex-col gap-4 px-1 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="pta-eyebrow">Acesso e capacidade</p>
            <h2
              id="member-list-title"
              className="mt-1 text-xl font-semibold tracking-[-0.03em]"
            >
              Pessoas do workspace
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {members.length}{' '}
              {members.length === 1
                ? 'pessoa encontrada'
                : 'pessoas encontradas'}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_150px_150px]">
            <div className="relative min-w-0">
              <Search
                aria-hidden="true"
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Buscar pessoa"
                placeholder="Buscar pessoa"
                className="w-full rounded-xl bg-card pl-9 hover:border-pta-blue/30"
              />
            </div>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as 'all' | TeamRole)}
            >
              <SelectTrigger
                className="w-full rounded-xl bg-card hover:border-pta-blue/30"
                aria-label="Filtrar por papel"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os papéis</SelectItem>
                {Object.entries(TEAM_ROLE_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={membershipState}
              onValueChange={(value) =>
                setMembershipState(value as 'all' | MembershipState)
              }
            >
              <SelectTrigger
                className="w-full rounded-xl bg-card hover:border-pta-blue/30"
                aria-label="Filtrar por acesso"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os acessos</SelectItem>
                {Object.entries(MEMBERSHIP_STATE_LABEL).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!members.length ? (
          <OperationEmptyState
            icon={UsersRound}
            title="Nenhuma pessoa corresponde aos filtros"
            description="Ajuste a busca ou remova um dos filtros."
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {members.map((member) => (
              <li key={member.id}>
                <ManagedMemberCard
                  member={member}
                  workspaceId={data.workspaceId}
                  currentOwnerVersion={currentOwnerVersion}
                  canManageMembers={data.permissions.canManageMembers}
                  canTransferOwnership={data.permissions.canTransferOwnership}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <InvitationList
        workspaceId={data.workspaceId}
        invitations={data.invitations}
        canInvite={data.permissions.canInvite}
      />
    </div>
  );
}

function ManagementOverview({
  members,
  activeCount,
  pendingCount,
  suspendedCount,
  totalCapacity,
  totalPlannedMinutes,
  membersWithCapacity,
  completedLast28Days,
  onTimeCompletedLast28Days,
}: {
  members: ManagedTeamMember[];
  activeCount: number;
  pendingCount: number;
  suspendedCount: number;
  totalCapacity: number;
  totalPlannedMinutes: number;
  membersWithCapacity: number;
  completedLast28Days: number;
  onTimeCompletedLast28Days: number;
}) {
  const rankedMembers = [...members]
    .sort((a, b) => b.plannedWeekMinutes - a.plannedWeekMinutes)
    .slice(0, 6);
  const teamLoad = totalCapacity
    ? Math.round((totalPlannedMinutes / totalCapacity) * 100)
    : null;
  const predictabilityRate = completedLast28Days
    ? Math.round((onTimeCompletedLast28Days / completedLast28Days) * 100)
    : null;

  return (
    <section
      className="grid gap-4 lg:grid-cols-5"
      aria-label="Resumo da equipe"
    >
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
              {teamLoad === null
                ? 'Cadastre as horas semanais da equipe'
                : `${formatCapacity(totalPlannedMinutes)} de ${formatCapacity(totalCapacity)} planejadas`}
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
                    className="size-7 rounded-full bg-pta-blue/10 text-[9px] text-pta-blue"
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
          {membersWithCapacity} de {activeCount}{' '}
          {activeCount === 1 ? 'pessoa tem' : 'pessoas têm'} capacidade semanal
          cadastrada. As barras usam demandas desta semana com esforço estimado.
        </p>
      </article>

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

        <div className="mt-7 flex flex-col items-center gap-6 sm:flex-row">
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

        <dl className="mt-7 grid grid-cols-3 gap-2">
          <OverviewMetric
            icon={UsersRound}
            label="Ativas"
            value={activeCount}
          />
          <OverviewMetric icon={Mail} label="Convites" value={pendingCount} />
          <OverviewMetric
            icon={UserRoundX}
            label="Suspensas"
            value={suspendedCount}
            danger={suspendedCount > 0}
          />
        </dl>
      </article>
    </section>
  );
}

function OverviewMetric({
  icon: Icon,
  label,
  value,
  danger = false,
}: {
  icon: typeof UsersRound;
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-muted/55 px-3 py-3">
      <dt className="flex items-center gap-1.5 truncate text-[10px] text-muted-foreground">
        <Icon aria-hidden="true" className="size-3 shrink-0 text-pta-blue" />
        {label}
      </dt>
      <dd
        className={cn(
          'mt-1 text-xl font-semibold tracking-[-0.035em]',
          danger && 'text-destructive',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function ManagedMemberCard({
  member,
  workspaceId,
  currentOwnerVersion,
  canManageMembers,
  canTransferOwnership,
}: {
  member: ManagedTeamMember;
  workspaceId: string;
  currentOwnerVersion: number | null;
  canManageMembers: boolean;
  canTransferOwnership: boolean;
}) {
  return (
    <article className="flex min-h-[240px] flex-col rounded-2xl border bg-card p-5  transition-[border-color,box-shadow,transform]  hover:border-pta-blue/35 ">
      <div className="flex items-start gap-3">
        <MemberIdentity member={member} compact />
        <MemberActionsMenu
          workspaceId={workspaceId}
          member={member}
          currentOwnerVersion={currentOwnerVersion}
          canManageMembers={canManageMembers}
          canTransferOwnership={canTransferOwnership}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-pta-blue/10 px-2.5 py-1 text-xs font-medium text-pta-blue">
          {TEAM_ROLE_LABEL[member.role]}
        </span>
        <MembershipBadge state={member.membershipState} />
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2">
        <MemberCardMetric label="Abertas" value={member.openTasks} />
        <MemberCardMetric
          label="Atrasadas"
          value={member.overdueTasks}
          danger={member.overdueTasks > 0}
        />
        <MemberCardMetric
          label="Atribuídas"
          value={member.totalAssignedTasks}
        />
      </dl>

      <div className="mt-auto rounded-2xl bg-muted/45 px-4 py-3 text-xs leading-5 text-muted-foreground">
        <p>{formatCapacity(member.weeklyCapacityMinutes)} por semana</p>
        <p>Na equipe desde {formatTeamDate(member.joinedAt)}</p>
      </div>
    </article>
  );
}

function MemberCardMetric({
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
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'mt-1 text-xl font-semibold tracking-[-0.035em]',
          danger && 'text-destructive',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function MemberIdentity({
  member,
  compact = false,
}: {
  member: ManagedTeamMember;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', compact && 'flex-1')}>
      <InitialsMark
        initials={member.initials}
        className={cn(member.isSelf && 'ring-2 ring-primary/25')}
      />
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span className="truncate">{member.fullName}</span>
          {member.isSelf ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
              Você
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
          {member.email}
        </p>
        {!compact ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Desde {formatTeamDate(member.joinedAt)},{' '}
            {member.weeklyCapacityMinutes
              ? `${formatCapacity(member.weeklyCapacityMinutes)} por semana`
              : 'Capacidade não informada'}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MembershipBadge({ state }: { state: MembershipState }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-medium',
        state === 'active' && 'bg-pta-blue/10 text-pta-blue',
        state === 'suspended' && 'bg-amber-600/10 text-amber-800',
        state === 'removed' && 'bg-muted text-muted-foreground',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full bg-current',
          state === 'removed' && 'opacity-50',
        )}
      />
      {MEMBERSHIP_STATE_LABEL[state]}
    </span>
  );
}

function InvitationList({
  workspaceId,
  invitations,
  canInvite,
}: {
  workspaceId: string;
  invitations: TeamInvitation[];
  canInvite: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string>();
  const [cancelTarget, setCancelTarget] = useState<TeamInvitation | null>(null);
  const [generatedInvite, setGeneratedInvite] =
    useState<GeneratedInvite | null>(null);

  async function rotate(invitation: TeamInvitation) {
    setBusyId(invitation.id);
    try {
      const result = await createWorkspaceInvitation({
        workspaceId,
        email: invitation.email,
        role: invitation.role,
      });
      setGeneratedInvite({
        email: result.invitation.email,
        url: createInvitationUrl(result.rawToken),
      });
      router.refresh();
    } catch (error) {
      toast.error(
        teamMutationErrorMessage(error, 'Não foi possível gerar um novo link.'),
      );
    } finally {
      setBusyId(undefined);
    }
  }

  async function cancelInvitation() {
    if (!cancelTarget) return;
    setBusyId(cancelTarget.id);
    try {
      await cancelWorkspaceInvitation(cancelTarget.id);
      toast.success('Convite cancelado.');
      setCancelTarget(null);
      router.refresh();
    } catch (error) {
      toast.error(
        teamMutationErrorMessage(error, 'Não foi possível cancelar o convite.'),
      );
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <section
      className="mt-5 rounded-2xl border bg-card p-6  sm:p-7"
      aria-labelledby="invitation-list-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="pta-eyebrow">Entrada na equipe</p>
          <h2
            id="invitation-list-title"
            className="mt-1 text-xl font-semibold tracking-[-0.03em]"
          >
            Convites
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O link aparece somente quando é criado ou renovado.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {invitations.length}{' '}
          {invitations.length === 1
            ? 'convite registrado'
            : 'convites registrados'}
        </p>
      </div>

      {!invitations.length ? (
        <div className="mt-5 rounded-2xl bg-muted/45 px-5 py-9 text-center">
          <Mail aria-hidden="true" className="mx-auto size-5 text-pta-blue" />
          <h3 className="mt-3 text-sm font-semibold">Nenhum convite enviado</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Use a ação Convidar pessoa no topo da página para liberar um acesso.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-2">
          {invitations.map((invitation) => (
            <li
              key={invitation.id}
              className="flex flex-col gap-3 rounded-2xl bg-muted/35 px-4 py-4 transition-colors hover:bg-pta-blue/[0.055] sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-pta-blue/10 text-pta-blue">
                  <Mail aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {invitation.email}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {TEAM_ROLE_LABEL[invitation.role]}, expira em{' '}
                    {formatTeamDate(invitation.expiresAt)}
                  </p>
                </div>
              </div>

              <InvitationStatusBadge status={invitation.status} />

              {canInvite &&
              (invitation.status === 'pending' ||
                invitation.status === 'expired') ? (
                <div className="flex gap-2 sm:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => rotate(invitation)}
                    disabled={busyId === invitation.id}
                  >
                    {busyId === invitation.id ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="animate-spin"
                      />
                    ) : (
                      <RotateCw aria-hidden="true" />
                    )}
                    Gerar novo link
                  </Button>
                  {invitation.status === 'pending' ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setCancelTarget(invitation)}
                      aria-label={`Cancelar convite de ${invitation.email}`}
                      disabled={busyId === invitation.id}
                    >
                      <XCircle aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !busyId) setCancelTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar este convite?</AlertDialogTitle>
            <AlertDialogDescription>
              O link enviado para {cancelTarget?.email ?? 'esta pessoa'} deixa
              de funcionar imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(busyId)}>
              Manter convite
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={cancelInvitation}
              disabled={Boolean(busyId)}
            >
              {busyId ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {busyId ? 'Cancelando…' : 'Cancelar convite'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {generatedInvite ? (
        <InvitationLinkDialog
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setGeneratedInvite(null);
          }}
          inviteUrl={generatedInvite.url}
          email={generatedInvite.email}
        />
      ) : null}
    </section>
  );
}

function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  const Icon =
    status === 'pending'
      ? Clock3
      : status === 'accepted'
        ? UserCheck
        : status === 'expired'
          ? AlertTriangle
          : XCircle;
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
        status === 'pending' && 'bg-pta-blue/10 text-pta-blue',
        status === 'accepted' && 'bg-pta-success/10 text-pta-success',
        status === 'expired' && 'bg-pta-warning/10 text-pta-warning',
        status === 'cancelled' && 'bg-muted text-muted-foreground',
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {INVITATION_STATUS_LABEL[status]}
    </span>
  );
}
