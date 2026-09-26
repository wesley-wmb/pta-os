import { describe, expect, it } from 'vitest';

import { safeTaskReturnPath, taskHrefWithReturn } from './task-return-path';

const projectId = '0cbbeb33-dfa5-48e2-a71a-28dd154b6264';

describe('safeTaskReturnPath', () => {
  it('preserves the project timeline that opened the task', () => {
    expect(safeTaskReturnPath(`/projetos/${projectId}?visao=timeline`)).toBe(
      `/projetos/${projectId}?visao=timeline`,
    );
  });

  it('keeps supported task origins and their query', () => {
    expect(safeTaskReturnPath('/demandas?visao=semana&data=2026-09-26')).toBe(
      '/demandas?visao=semana&data=2026-09-26',
    );
    expect(safeTaskReturnPath('/inicio')).toBe('/inicio');
  });

  it.each([
    'https://example.com',
    '//example.com',
    '/\\example.com',
    '/admin',
    '/projetos/identificador-invalido?visao=timeline',
    null,
  ])('uses the task list for an unsafe origin: %s', (value) => {
    expect(safeTaskReturnPath(value)).toBe('/demandas');
  });
});

describe('taskHrefWithReturn', () => {
  it('encodes the project timeline as task return context', () => {
    expect(
      taskHrefWithReturn('task-1', `/projetos/${projectId}?visao=timeline`),
    ).toBe(
      `/tarefa/task-1?retorno=${encodeURIComponent(`/projetos/${projectId}?visao=timeline`)}`,
    );
  });

  it('does not put an external URL in a task link', () => {
    expect(taskHrefWithReturn('task-1', 'https://example.com')).toBe(
      '/tarefa/task-1?retorno=%2Fdemandas',
    );
  });
});
