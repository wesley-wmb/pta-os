import { differenceInCalendarDays, getDay } from 'date-fns';
import { describe, expect, it } from 'vitest';

import {
  calendarMonthGridKeys,
  calendarWeekKeys,
  calendarWeekKeysFromDate,
  calendarWeekRange,
  dateFromKey,
  isDateKey,
  normalizeDateReference,
  toDateKey,
} from './date-utils';

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

  it('validates date keys without accepting normalized calendar overflows', () => {
    expect(isDateKey('2024-02-29')).toBe(true);
    expect(isDateKey('2026-02-29')).toBe(false);
    expect(isDateKey('2026-13-01')).toBe(false);
    expect(isDateKey('22-08-2026')).toBe(false);
    expect(isDateKey(new Date())).toBe(false);
  });

  it('normalizes a safe reference and falls back for invalid input', () => {
    expect(normalizeDateReference(' 2026-08-22 ', '2026-08-01')).toBe(
      '2026-08-22',
    );
    expect(normalizeDateReference('2026-02-29', '2026-08-01')).toBe(
      '2026-08-01',
    );
    expect(normalizeDateReference(['2026-08-22'], '2026-08-01')).toBe(
      '2026-08-01',
    );
    expect(() => normalizeDateReference('2026-08-22', 'inválida')).toThrow(
      RangeError,
    );
  });

  it('returns the Monday-to-Sunday week for an arbitrary date', () => {
    expect(calendarWeekKeysFromDate('2026-08-22')).toEqual([
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
      '2026-08-23',
    ]);
    expect(calendarWeekRange('2026-08-22')).toEqual({
      start: '2026-08-17',
      end: '2026-08-23',
    });
  });

  it('returns a 42-day monthly grid aligned from Monday to Sunday', () => {
    const grid = calendarMonthGridKeys('2026-08-22');

    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-07-27');
    expect(grid[41]).toBe('2026-09-06');
    expect(getDay(dateFromKey(grid[0]))).toBe(1);
    expect(getDay(dateFromKey(grid[41]))).toBe(0);
    expect(new Set(grid).size).toBe(42);
    expect(
      grid.every(
        (dateKey, index) =>
          index === 0 ||
          differenceInCalendarDays(
            dateFromKey(dateKey),
            dateFromKey(grid[index - 1]),
          ) === 1,
      ),
    ).toBe(true);
  });

  it('keeps leap-month grids and cross-year weeks stable', () => {
    const leapGrid = calendarMonthGridKeys('2024-02-29');
    expect(leapGrid).toContain('2024-02-29');
    expect(leapGrid).toHaveLength(42);
    expect(calendarWeekKeysFromDate('2026-01-01')).toEqual([
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
    ]);
  });

  it('rejects invalid references before calculating ranges', () => {
    expect(() => calendarWeekKeysFromDate('2026-02-29')).toThrow(RangeError);
    expect(() => calendarMonthGridKeys('2026-00-10')).toThrow(RangeError);
  });
});
