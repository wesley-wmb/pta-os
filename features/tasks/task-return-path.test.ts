import { describe, expect, it } from 'vitest';

import {
  safeTaskReturnPath,
  taskHrefWithReturn,
  taskReturnContext,
} from './task-return-path';

const projectId = '0cbbeb33-dfa5-48e2-a71a-28dd154b6264';

describe('safeTaskReturnPath', () => {
  it('preserves the project timeline that opened the task', () => {
    expect(safeTaskReturnPath(`/projetos/${projectId}?visao=timeline`)).toBe(
      `/projetos/${projectId}?visao=timeline`,
    );
  });

  it.each(['timeline', 'board', 'list'])(
    'preserva a vis�o %s da equipe em tarefas e tarefas vinculadas',
    (view) => {
      const path = `/equipes/${projectId}?visao=${view}&filtro=minhas`;
      expect(safeTaskReturnPath(path)).toBe(path);
      expect(
        taskReturnContext(
          `/equipes/${projectId}`,
          `visao=${view}&filtro=minhas`,
        ),
      ).toBe(path);
      expect(
        taskReturnContext(
          '/tarefa/parent',
          `retorno=${encodeURIComponent(path)}`,
        ),
      ).toBe(path);
      expect(taskHrefWithReturn('task-1', path)).toBe(
        `/tarefa/task-1?retorno=${encodeURIComponent(path)}`,
      );
    },
  );

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
    '/equipes/identificador-invalido?visao=timeline',
    '/equipes/../admin',
    null,
  ])('uses the task list for an unsafe origin: %s', (value) => {
    expect(safeTaskReturnPath(value)).toBe('/demandas');
  });
});

describe('taskHrefWithReturn', () => {
  it('preserves the original timeline when opening a linked task', () => {
    expect(
      taskReturnContext(
        '/tarefa/parent',
        `retorno=${encodeURIComponent(`/projetos/${projectId}?visao=timeline`)}`,
      ),
    ).toBe(`/projetos/${projectId}?visao=timeline`);
  });

  it.each([
    '/busca?q=campanha',
    '/historico',
    '/produtos?produto=123',
    '/semana',
    '/projetos',
    '/equipes',
  ])('preserves a supported operational origin %s', (path) => {
    expect(
      taskReturnContext(path.split('?')[0], path.split('?')[1] ?? ''),
    ).toBe(path);
  });

  it('rejects an unsafe inherited return target', () => {
    expect(
      taskReturnContext('/tarefa/parent', 'retorno=https://example.com'),
    ).toBe('/demandas');
  });
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
