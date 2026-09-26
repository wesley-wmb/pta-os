import { describe, expect, it } from 'vitest';

import {
  isPlanningPipelineView,
  parseWeeklyPresentationFormat,
  serializeWeeklyPresentationFormat,
  type WeeklyPresentationFormat,
  type WeeklyPresentationFormatQuery,
} from './pipeline-presentation-state';
import type { PipelineView } from './pipeline-state';

const weeklyFormatPairs: Array<
  [WeeklyPresentationFormat, WeeklyPresentationFormatQuery]
> = [
  ['week', 'semana'],
  ['list', 'lista'],
  ['calendar', 'calendario'],
];

describe('weekly pipeline presentation state', () => {
  it.each(weeklyFormatPairs)('serializes %s as %s', (format, queryValue) => {
    expect(serializeWeeklyPresentationFormat(format)).toBe(queryValue);
  });

  it.each(weeklyFormatPairs)('parses %s as %s', (format, queryValue) => {
    expect(parseWeeklyPresentationFormat(queryValue)).toBe(format);
  });

  it('round-trips every supported weekly format', () => {
    for (const [format] of weeklyFormatPairs) {
      expect(
        parseWeeklyPresentationFormat(
          serializeWeeklyPresentationFormat(format),
        ),
      ).toBe(format);
    }
  });

  it('uses the weekly board as the safe default', () => {
    expect(parseWeeklyPresentationFormat(undefined)).toBe('week');
    expect(parseWeeklyPresentationFormat(null)).toBe('week');
    expect(parseWeeklyPresentationFormat(['semana'])).toBe('week');
    expect(parseWeeklyPresentationFormat('desconhecido')).toBe('week');
    expect(parseWeeklyPresentationFormat('SEMANA')).toBe('week');
  });

  it('accepts a valid explicit fallback and rejects an invalid runtime fallback', () => {
    expect(parseWeeklyPresentationFormat('', 'list')).toBe('list');
    expect(parseWeeklyPresentationFormat('  calendario  ', 'list')).toBe(
      'calendar',
    );
    expect(
      parseWeeklyPresentationFormat('desconhecido', 'invalid' as never),
    ).toBe('week');
  });
});

describe('pipeline presentation area', () => {
  it.each<PipelineView>(['day', 'week', 'month'])(
    'classifies %s as planning',
    (view) => {
      expect(isPlanningPipelineView(view)).toBe(true);
    },
  );

  it.each<PipelineView>(['kanban', 'table'])(
    'keeps %s in the execution center',
    (view) => {
      expect(isPlanningPipelineView(view)).toBe(false);
    },
  );
});
