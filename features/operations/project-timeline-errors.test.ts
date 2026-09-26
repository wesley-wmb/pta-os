import { describe, expect, it } from 'vitest';

import {
  getPhaseArchiveErrorMessage,
  getPhaseCreationErrorMessage,
  getPhaseUpdateErrorMessage,
} from './project-timeline-errors';

describe('getPhaseCreationErrorMessage', () => {
  it('explica quando a RPC do cronograma ainda não foi publicada', () => {
    expect(
      getPhaseCreationErrorMessage({
        code: 'PGRST202',
        message:
          'Could not find the function public.create_event_phase in the schema cache',
      }),
    ).toBe('A atualização do banco do cronograma ainda não foi publicada.');
  });

  it('distingue falta de permissão de falha genérica', () => {
    expect(
      getPhaseCreationErrorMessage({ code: '42501', message: 'PTA_FORBIDDEN' }),
    ).toBe('Seu perfil não tem permissão para criar fases neste projeto.');
  });

  it('mantém uma mensagem acionável para erros inesperados', () => {
    expect(getPhaseCreationErrorMessage({ message: 'network error' })).toBe(
      'Não foi possível criar a fase. Tente novamente.',
    );
  });
});

describe('mensagens de edição e exclusão de fase', () => {
  it('orienta recarregar quando a versão mudou', () => {
    expect(
      getPhaseUpdateErrorMessage({
        code: '40001',
        message: 'PTA_VERSION_CONFLICT',
      }),
    ).toBe('A fase mudou em outra sessão. Reabra-a e tente novamente.');
    expect(
      getPhaseArchiveErrorMessage({ message: 'PTA_VERSION_CONFLICT' }),
    ).toBe('A fase mudou em outra sessão. Reabra-a antes de excluir.');
  });

  it('distingue permissão de edição e exclusão', () => {
    expect(
      getPhaseUpdateErrorMessage({ code: '42501', message: 'PTA_FORBIDDEN' }),
    ).toBe('Seu perfil não tem permissão para editar fases neste projeto.');
    expect(
      getPhaseArchiveErrorMessage({
        code: '42501',
        message: 'PTA_FORBIDDEN',
      }),
    ).toBe('Seu perfil não tem permissão para excluir fases deste projeto.');
  });
});
