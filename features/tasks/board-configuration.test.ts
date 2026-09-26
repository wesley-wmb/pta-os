import { describe, expect, it } from 'vitest';

import {
  createTaskBoardConfigurationFallback,
  isTaskBoardConfigurationUnavailable,
  parseTaskBoardConfiguration,
} from './board-configuration';
import type { TaskStatus } from './types';

const workspaceId = '00000000-0000-4000-8000-000000000099';
const todoId = '00000000-0000-4000-8000-000000000010';

describe('configuração compartilhada dos quadros', () => {
  it('valida e normaliza a resposta da RPC', () => {
    const configuration = parseTaskBoardConfiguration({
      schema_version: 1,
      workspace_id: workspaceId,
      permissions: { can_manage_columns: true },
      status_board: {
        version: 3,
        columns: [
          {
            id: todoId,
            key: todoId,
            name: 'A fazer',
            category: 'todo',
            color: 'blue',
            icon_key: 'circle',
            position: 10,
            is_active: true,
            version: 2,
          },
        ],
      },
      week_board: {
        version: 4,
        columns: [
          {
            key: 'emergency',
            name: 'Emergência',
            color: 'red',
            icon_key: 'zap',
            position: 10,
            is_active: true,
            is_system: true,
            version: 1,
          },
        ],
      },
      links: [
        {
          status_id: todoId,
          week_lane_key: 'emergency',
          direction: 'both',
          version: 1,
        },
      ],
    });

    expect(configuration.source).toBe('remote');
    expect(configuration.status_board.columns[0]?.category).toBe('todo');
    expect(configuration.links[0]?.direction).toBe('both');
  });

  it('rejeita uma configuração incompleta ou com enum desconhecido', () => {
    expect(() =>
      parseTaskBoardConfiguration({
        schema_version: 1,
        workspace_id: workspaceId,
        permissions: { can_manage_columns: true },
        status_board: { version: 1, columns: [] },
        week_board: {
          version: 1,
          columns: [
            {
              key: 'amanha',
              name: 'Amanhã',
              color: 'blue',
              icon_key: 'calendar',
              position: 10,
              is_active: true,
              is_system: true,
              version: 1,
            },
          ],
        },
        links: [],
      }),
    ).toThrow();
  });

  it('mantém os status atuais e as raias semanais no fallback somente leitura', () => {
    const statuses: TaskStatus[] = [
      {
        id: todoId,
        name: 'A fazer',
        category: 'todo',
        color: 'blue',
        position: 20,
      },
      {
        id: '00000000-0000-4000-8000-000000000020',
        name: 'Backlog',
        category: 'backlog',
        color: 'stone',
        position: 10,
      },
    ];

    const fallback = createTaskBoardConfigurationFallback(
      workspaceId,
      statuses,
    );

    expect(fallback.source).toBe('fallback');
    expect(fallback.permissions.can_manage_columns).toBe(false);
    expect(fallback.status_board.columns.map((column) => column.name)).toEqual([
      'Backlog',
      'A fazer',
    ]);
    expect(fallback.week_board.columns.map((column) => column.key)).toEqual([
      'emergency',
      'important',
      'backlog',
      'scheduled',
      'delivered',
      'revision',
      'ideas',
      'discarded',
    ]);
  });

  it('reconhece indisponibilidade da RPC ou das tabelas da configuração', () => {
    expect(isTaskBoardConfigurationUnavailable({ code: 'PGRST202' })).toBe(
      true,
    );
    expect(isTaskBoardConfigurationUnavailable({ code: '42P01' })).toBe(true);
    expect(
      isTaskBoardConfigurationUnavailable({
        code: '42501',
        message: 'permission denied',
      }),
    ).toBe(false);
  });
});
