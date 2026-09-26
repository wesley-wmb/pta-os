type TimelineMutationError = {
  code?: string | null;
  message?: string | null;
};

export function getPhaseCreationErrorMessage(
  error: TimelineMutationError,
): string {
  const code = error.code ?? '';
  const message = error.message ?? '';

  if (
    code === 'PGRST202' ||
    code === '42883' ||
    /create_event_phase|schema cache|function .* does not exist/i.test(message)
  ) {
    return 'A atualização do banco do cronograma ainda não foi publicada.';
  }

  if (code === '42501' || message.includes('PTA_FORBIDDEN')) {
    return 'Seu perfil não tem permissão para criar fases neste projeto.';
  }

  if (
    code === '23514' ||
    code === '22023' ||
    message.includes('PTA_EVENT_NOT_FOUND')
  ) {
    return 'Revise o nome e o período da fase e tente novamente.';
  }

  return 'Não foi possível criar a fase. Tente novamente.';
}

function isTimelineBackendUnavailable(
  error: TimelineMutationError,
  rpcName: string,
) {
  const code = error.code ?? '';
  const message = error.message ?? '';
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    new RegExp(`${rpcName}|schema cache|function .* does not exist`, 'i').test(
      message,
    )
  );
}

function isVersionConflict(error: TimelineMutationError) {
  return (
    error.code === '40001' ||
    (error.message ?? '').includes('PTA_VERSION_CONFLICT')
  );
}

function isForbidden(error: TimelineMutationError) {
  return (
    error.code === '42501' || (error.message ?? '').includes('PTA_FORBIDDEN')
  );
}

export function getPhaseUpdateErrorMessage(
  error: TimelineMutationError,
): string {
  if (isTimelineBackendUnavailable(error, 'update_event_phase')) {
    return 'A atualização do banco do cronograma ainda não foi publicada.';
  }
  if (isVersionConflict(error)) {
    return 'A fase mudou em outra sessão. Reabra-a e tente novamente.';
  }
  if (isForbidden(error)) {
    return 'Seu perfil não tem permissão para editar fases neste projeto.';
  }
  return 'Não foi possível atualizar a fase. Tente novamente.';
}

export function getPhaseArchiveErrorMessage(
  error: TimelineMutationError,
): string {
  if (isTimelineBackendUnavailable(error, 'archive_event_phase')) {
    return 'A atualização do banco do cronograma ainda não foi publicada.';
  }
  if (isVersionConflict(error)) {
    return 'A fase mudou em outra sessão. Reabra-a antes de excluir.';
  }
  if (isForbidden(error)) {
    return 'Seu perfil não tem permissão para excluir fases deste projeto.';
  }
  return 'Não foi possível excluir a fase. Tente novamente.';
}
