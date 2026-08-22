import { describe, expect, it } from 'vitest';

import { isClosed, priorityLabels, statusTone } from './formatters';

describe('task formatters', () => {
  it('maps all task priorities to Portuguese', () => {
    expect(priorityLabels).toEqual({
      low: 'Baixa',
      medium: 'Média',
      high: 'Alta',
      urgent: 'Urgente',
    });
  });

  it('treats only done and cancelled as closed', () => {
    expect(isClosed('done')).toBe(true);
    expect(isClosed('cancelled')).toBe(true);
    expect(isClosed('review')).toBe(false);
  });

  it('keeps a visible tone for every status category', () => {
    for (const category of [
      'backlog',
      'todo',
      'in_progress',
      'review',
      'blocked',
      'done',
      'cancelled',
    ] as const) {
      expect(statusTone(category)).toContain('text-');
    }
  });
});
