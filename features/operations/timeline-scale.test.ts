import { format } from 'date-fns';
import { describe, expect, it } from 'vitest';

import {
  buildTimelineScaleCells,
  buildTimelineScaleRange,
  timelineKeyboardDelta,
  shiftTimelineValue,
  timelineSnapDelta,
} from './timeline-scale';

describe('timeline scales', () => {
  it.each([
    ['hours', 72],
    ['days', 70],
    ['weeks', 20],
    ['months', 18],
    ['quarters', 12],
    ['semesters', 8],
    ['years', 8],
  ] as const)('builds calendar cells for %s', (scale, expectedCells) => {
    const range = buildTimelineScaleRange({
      today: '2026-09-26',
      scale,
    });

    expect(buildTimelineScaleCells(range, scale)).toHaveLength(expectedCells);
    expect(range.totalDays).toBeGreaterThan(0);
  });

  it('aligns weeks to Monday and preserves local date values', () => {
    const range = buildTimelineScaleRange({
      today: '2026-09-26',
      scale: 'weeks',
    });

    expect(format(range.start, 'yyyy-MM-dd')).toBe('2026-09-07');
    expect(range.start.getDay()).toBe(1);
  });

  it('builds readable major and minor labels for every planning scale', () => {
    const expected = {
      hours: ['sexta-feira, 25 de setembro', '00h', null],
      days: ['setembro 2026', '21', 'seg'],
      weeks: ['setembro · 3º tri 2026', '7–13 set', 'semana 37'],
      months: ['2026', 'julho', null],
      quarters: ['2026', '2º tri', 'abr–jun'],
      semesters: ['2026', '1º semestre', 'jan–jun'],
      years: ['Década de 2020', '2025', null],
    } as const;

    for (const scale of Object.keys(expected) as Array<keyof typeof expected>) {
      const range = buildTimelineScaleRange({ today: '2026-09-26', scale });
      const first = buildTimelineScaleCells(range, scale)[0]!;
      expect([first.majorLabel, first.label, first.secondaryLabel]).toEqual(
        expected[scale],
      );
      expect(first.ariaLabel.length).toBeGreaterThan(4);
    }
  });

  it('navigates by the visible scale range', () => {
    const current = buildTimelineScaleRange({
      today: '2026-09-26',
      scale: 'months',
    });
    const next = buildTimelineScaleRange({
      today: '2026-09-26',
      scale: 'months',
      windowOffset: 1,
    });

    expect(format(current.start, 'yyyy-MM-dd')).toBe('2026-07-01');
    expect(format(next.start, 'yyyy-MM-dd')).toBe('2027-01-01');
  });

  it('snaps date-only work to a full day in the hour scale', () => {
    expect(
      timelineSnapDelta({
        date: '2026-09-26',
        time: null,
        deltaPixels: 670,
        scale: 'hours',
      }),
    ).toEqual({ deltaDays: 1, deltaMinutes: 1440 });
  });

  it('snaps timed work to hours without crossing through UTC', () => {
    expect(
      timelineSnapDelta({
        date: '2026-09-26',
        time: '23:30:00',
        deltaPixels: 28,
        scale: 'hours',
      }),
    ).toEqual({ deltaDays: 1, deltaMinutes: 60 });
  });

  it('moves existing times while leaving date-only values date-only', () => {
    expect(
      shiftTimelineValue({
        date: '2026-09-26',
        time: '23:30:00',
        deltaDays: 1,
        deltaMinutes: 60,
      }),
    ).toEqual({ date: '2026-09-27', time: '00:30:00' });
    expect(
      shiftTimelineValue({
        date: '2026-09-26',
        time: null,
        deltaDays: 1,
        deltaMinutes: 60,
      }),
    ).toEqual({ date: '2026-09-27', time: null });
  });

  it('snaps month, quarter, semester and year steps to calendar boundaries', () => {
    expect(
      timelineKeyboardDelta({
        date: '2024-02-29',
        scale: 'months',
        direction: 1,
      }).deltaDays,
    ).toBe(29);
    expect(
      timelineKeyboardDelta({
        date: '2026-01-31',
        scale: 'quarters',
        direction: 1,
      }).deltaDays,
    ).toBe(89);
    expect(
      timelineKeyboardDelta({
        date: '2026-01-31',
        scale: 'semesters',
        direction: 1,
      }).deltaDays,
    ).toBe(181);
    expect(
      timelineKeyboardDelta({
        date: '2024-02-29',
        scale: 'years',
        direction: 1,
      }).deltaDays,
    ).toBe(365);
  });
});
