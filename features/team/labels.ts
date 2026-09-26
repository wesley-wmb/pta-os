import type {
  InvitationStatus,
  InviteRole,
  MembershipState,
  TeamRole,
} from './schemas';

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Coordenador',
  member: 'Colaborador',
  viewer: 'Observador',
};

export const INVITE_ROLE_OPTIONS: Array<{
  value: InviteRole;
  label: string;
  description: string;
}> = [
  {
    value: 'member',
    label: 'Colaborador',
    description: 'Cria e atualiza demandas autorizadas.',
  },
  {
    value: 'manager',
    label: 'Coordenador',
    description: 'Coordena a operação e os catálogos.',
  },
  {
    value: 'admin',
    label: 'Administrador',
    description: 'Gerencia o workspace e a equipe.',
  },
  {
    value: 'viewer',
    label: 'Observador',
    description: 'Consulta o conteúdo sem editar.',
  },
];

export const MEMBERSHIP_STATE_LABEL: Record<MembershipState, string> = {
  active: 'Ativo',
  suspended: 'Suspenso',
  removed: 'Removido',
};

export const INVITATION_STATUS_LABEL: Record<InvitationStatus, string> = {
  pending: 'Pendente',
  expired: 'Expirado',
  accepted: 'Aceito',
  cancelled: 'Cancelado',
};

export function formatTeamDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}

export function formatCapacity(minutes: number | null) {
  if (!minutes) return 'Não informada';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  return remainder ? `${hours}h ${remainder}min` : `${hours}h`;
}
