import { describe, expect, it } from 'vitest';

import {
  isReferenceInCurrentPeriod,
  parsePipelineView,
  serializePipelineView,
  type PipelineView,
  type PipelineViewQuery,
} from './pipeline-state';

const viewPairs: Array<[PipelineView, PipelineViewQuery]> = [
  ['kanban', 'kanban'],
  ['day', 'dia'],
  ['week', 'semana'],
  ['month', 'mes'],
  ['table', 'tabela'],
];

describe('pipeline URL state', () => {
  it.each(viewPairs)('serializes %s as %s', (view, queryValue) => {
    expect(serializePipelineView(view)).toBe(queryValue);
  });

  it.each(viewPairs)('parses %s back to %s', (view, queryValue) => {
    expect(parsePipelineView(queryValue)).toBe(view);
  });

  it('round-trips every supported view', () => {
    for (const [view] of viewPairs)
      expect(parsePipelineView(serializePipelineView(view))).toBe(view);
  });

  it('uses a safe fallback for unsupported or ambiguous values', () => {
    expect(parsePipelineView(null)).toBe('kanban');
    expect(parsePipelineView('day')).toBe('kanban');
    expect(parsePipelineView('SEMANA')).toBe('kanban');
    expect(parsePipelineView(['semana'])).toBe('kanban');
    expect(parsePipelineView('desconhecida', 'table')).toBe('table');
    expect(parsePipelineView('  mes  ')).toBe('month');
  });
});

describe('pipeline current period', () => {
  it('matches only the current day in the day view', () => {
    expect(isReferenceInCurrentPeriod('day', '2026-08-22', '2026-08-22')).toBe(
      true,
    );
    expect(isReferenceInCurrentPeriod('day', '2026-08-21', '2026-08-22')).toBe(
      false,
    );
  });

  it('matches dates in the same Monday-to-Sunday week', () => {
    expect(isReferenceInCurrentPeriod('week', '2026-08-17', '2026-08-23')).toBe(
      true,
    );
    expect(isReferenceInCurrentPeriod('week', '2025-12-29', '2026-01-04')).toBe(
      true,
    );
    expect(isReferenceInCurrentPeriod('week', '2026-08-16', '2026-08-17')).toBe(
      false,
    );
  });

  it('matches dates only in the same month and year', () => {
    expect(
      isReferenceInCurrentPeriod('month', '2026-08-01', '2026-08-31'),
    ).toBe(true);
    expect(
      isReferenceInCurrentPeriod('month', '2025-08-22', '2026-08-22'),
    ).toBe(false);
    expect(
      isReferenceInCurrentPeriod('month', '2026-09-01', '2026-08-31'),
    ).toBe(false);
  });

  it('returns false for invalid date keys', () => {
    expect(isReferenceInCurrentPeriod('week', '2026-02-29', '2026-02-23')).toBe(
      false,
    );
    expect(isReferenceInCurrentPeriod('month', '2026-08-22', 'inválida')).toBe(
      false,
    );
  });
});
