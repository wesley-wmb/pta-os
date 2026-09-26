import { describe, expect, it } from 'vitest';

import { searchWorkspacePayloadSchema } from './schemas';

const validPayload = {
  query: 'campanha',
  total: 1,
  groups: [
    {
      entity_type: 'task',
      label: 'Demandas',
      items: [
        {
          id: '9d5fc58e-a923-4429-8519-cf0f57e9f13f',
          title: 'Campanha de agosto',
          subtitle: 'PTA-000012 · Em andamento',
          href: '/tarefa/9d5fc58e-a923-4429-8519-cf0f57e9f13f',
          score: 52.4,
        },
      ],
    },
  ],
};

describe('searchWorkspacePayloadSchema', () => {
  it('aceita o DTO sanitizado da busca', () => {
    expect(searchWorkspacePayloadSchema.parse(validPayload)).toEqual(
      validPayload,
    );
  });

  it.each([
    'https://exemplo.com',
    '//exemplo.com',
    '/\\servidor\\arquivo',
    '/resultado\u0000oculto',
  ])('rejeita destino inseguro: %s', (href) => {
    const payload = structuredClone(validPayload);
    payload.groups[0].items[0].href = href;

    expect(searchWorkspacePayloadSchema.safeParse(payload).success).toBe(false);
  });

  it('rejeita consultas curtas antes de chegar à interface', () => {
    expect(
      searchWorkspacePayloadSchema.safeParse({
        ...validPayload,
        query: 'a',
      }).success,
    ).toBe(false);
  });
});
