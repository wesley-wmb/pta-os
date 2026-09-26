import { TeamApiError } from './api';

export function teamMutationErrorMessage(
  error: unknown,
  fallback = 'Não foi possível concluir esta ação.',
) {
  if (!(error instanceof TeamApiError)) return fallback;
  const code = error.code.toUpperCase();
  if (code.includes('VERSION') || code.includes('CONFLICT')) {
    return 'Esta informação mudou em outra sessão. A lista será atualizada.';
  }
  if (
    code.includes('EMAIL_ACTIVE') ||
    code.includes('ALREADY_MEMBER') ||
    code.includes('MEMBER_ALREADY_ACTIVE')
  ) {
    return 'Este e-mail já pertence à equipe.';
  }
  if (code.includes('INVITATION_EMAIL') || code.includes('INVITE_EXISTS')) {
    return 'Já existe um convite aberto para este e-mail.';
  }
  if (code.includes('LAST_OWNER')) {
    return 'O workspace precisa manter um proprietário ativo.';
  }
  if (code.includes('FORBIDDEN') || code.includes('PERMISSION')) {
    return 'Você não tem permissão para realizar esta ação.';
  }
  if (code.includes('EXPIRED')) return 'Este convite expirou.';
  if (code.includes('CANCELLED')) return 'Este convite foi cancelado.';
  if (code.includes('ALREADY_USED')) return 'Este convite já foi usado.';
  if (code.includes('INVITATION_INVALID')) return 'Este convite não é válido.';
  if (code.includes('EMAIL_MISMATCH')) {
    return 'Entre com o mesmo e-mail que recebeu o convite.';
  }
  return fallback;
}
