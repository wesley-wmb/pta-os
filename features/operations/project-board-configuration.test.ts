import { describe, expect, it } from 'vitest';

import {
  createProjectBoardConfigurationFallback,
  parseProjectBoardConfiguration,
} from './project-board-configuration';

const workspaceId = '11111111-1111-4111-8111-111111111111';

describe('configuração do Kanban de Projetos', () => {
  it('mantém o fallback somente leitura e com as quatro chaves estáveis', () => {
    const fallback = createProjectBoardConfigurationFallback(workspaceId);

    expect(fallback.source).toBe('fallback');
    expect(fallback.can_manage_columns).toBe(false);
    expect(fallback.columns.map((column) => column.key)).toEqual([
      'planning',
      'active',
      'completed',
      'cancelled',
    ]);
  });

  it('aceita a configuração remota versionada', () => {
    const parsed = parseProjectBoardConfiguration({
      schema_version: 1,
      workspace_id: workspaceId,
      version: 3,
      can_manage_columns: true,
      columns: [
        {
          key: 'active',
          name: 'Em produção',
          color: 'blue',
          icon_key: 'clock',
          position: 1000,
          version: 2,
        },
      ],
    });

    expect(parsed.source).toBe('remote');
    expect(parsed.columns[0]?.name).toBe('Em produção');
  });

  it('rejeita uma chave que não pertence ao ciclo de Projetos', () => {
    expect(() =>
      parseProjectBoardConfiguration({
        schema_version: 1,
        workspace_id: workspaceId,
        version: 1,
        can_manage_columns: true,
        columns: [
          {
            key: 'review',
            name: 'Revisão',
            color: 'amber',
            icon_key: 'eye',
            position: 1000,
            version: 1,
          },
        ],
      }),
    ).toThrow();
  });
});
