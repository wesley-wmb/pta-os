import { describe, expect, it } from 'vitest';

import {
  safeAuthReturnPath,
  safeRecoveryReturnPath,
  safeWorkspaceReturnPath,
} from './return-path';

describe('safeWorkspaceReturnPath', () => {
  it('keeps allowed internal destinations', () => {
    expect(safeWorkspaceReturnPath('/demandas?filtro=abertas')).toBe(
      '/demandas?filtro=abertas',
    );
    expect(
      safeWorkspaceReturnPath('/tarefa/55b9c7a7-11a8-45d4-9f75-fac6f2f6c4c4'),
    ).toBe('/tarefa/55b9c7a7-11a8-45d4-9f75-fac6f2f6c4c4');
    expect(safeWorkspaceReturnPath(`/convite/${'a'.repeat(64)}`)).toBe(
      `/convite/${'a'.repeat(64)}`,
    );
  });

  it.each([
    '/pessoas?membro=55b9c7a7-11a8-45d4-9f75-fac6f2f6c4c4',
    '/equipes',
    '/equipes/55b9c7a7-11a8-45d4-9f75-fac6f2f6c4c4?visao=timeline&filtro=minhas',
    '/projetos/55b9c7a7-11a8-45d4-9f75-fac6f2f6c4c4?visao=timeline',
    '/equipe?visao=modelo',
  ])('preserva o contexto de pessoas e equipes após autenticar: %s', (path) => {
    expect(safeWorkspaceReturnPath(path)).toBe(path);
  });

  it.each([
    'https://example.com',
    '//example.com',
    '/\\example.com',
    '/admin',
    '/convite/token-curto',
    null,
  ])('falls back for an unsafe destination: %s', (value) => {
    expect(safeWorkspaceReturnPath(value)).toBe('/inicio');
  });
});

describe('safeAuthReturnPath', () => {
  it('preserva confirmação de senha e convites válidos', () => {
    expect(safeAuthReturnPath('/nova-senha')).toBe('/nova-senha');
    expect(safeAuthReturnPath(`/convite/${'f'.repeat(64)}`)).toBe(
      `/convite/${'f'.repeat(64)}`,
    );
  });
});

describe('safeRecoveryReturnPath', () => {
  it('only accepts the password page', () => {
    expect(safeRecoveryReturnPath('/nova-senha')).toBe('/nova-senha');
    expect(safeRecoveryReturnPath('//example.com')).toBe('/nova-senha');
    expect(safeRecoveryReturnPath('/inicio')).toBe('/nova-senha');
  });
});
