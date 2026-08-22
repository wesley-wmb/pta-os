import { getDay } from 'date-fns';
import { describe, expect, it } from 'vitest';

import { calendarWeekKeys, dateFromKey, toDateKey } from './date-utils';

describe('workspace calendar helpers', () => {
  it('round-trips a date key without UTC shifting', () => {
    expect(toDateKey(dateFromKey('2026-08-22'))).toBe('2026-08-22');
  });

  it('returns a complete Monday-to-Sunday week', () => {
    const week = calendarWeekKeys('America/Sao_Paulo');
    expect(week).toHaveLength(7);
    expect(getDay(dateFromKey(week[0]))).toBe(1);
    expect(getDay(dateFromKey(week[6]))).toBe(0);
    expect(new Set(week).size).toBe(7);
  });
});
