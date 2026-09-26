import {
  addDays,
  addHours,
  addMinutes,
  addMonths,
  addYears,
  differenceInCalendarDays,
  differenceInMinutes,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const TIMELINE_SCALES = [
  'hours',
  'days',
  'weeks',
  'months',
  'quarters',
  'semesters',
  'years',
] as const;

export type TimelineScale = (typeof TIMELINE_SCALES)[number];

export const TIMELINE_SCALE_LABELS: Record<TimelineScale, string> = {
  hours: 'Horas',
  days: 'Dias',
  weeks: 'Semanas',
  months: 'Meses',
  quarters: 'Trimestres',
  semesters: 'Semestres',
  years: 'Anos',
};

export type TimelineScaleRange = {
  start: Date;
  end: Date;
  totalDays: number;
};

export type TimelineScaleCell = {
  key: string;
  start: Date;
  end: Date;
  label: string;
  secondaryLabel: string | null;
  majorLabel: string;
  ariaLabel: string;
};

const scaleMetrics: Record<
  TimelineScale,
  {
    visibleUnits: number;
    unitsBeforeToday: number;
    navigationUnits: number;
    pixelsPerDay: number;
  }
> = {
  hours: {
    visibleUnits: 72,
    unitsBeforeToday: 24,
    navigationUnits: 48,
    pixelsPerDay: 24 * 28,
  },
  days: {
    visibleUnits: 70,
    unitsBeforeToday: 5,
    navigationUnits: 28,
    pixelsPerDay: 32,
  },
  weeks: {
    visibleUnits: 20,
    unitsBeforeToday: 2,
    navigationUnits: 8,
    pixelsPerDay: 14,
  },
  months: {
    visibleUnits: 18,
    unitsBeforeToday: 2,
    navigationUnits: 6,
    pixelsPerDay: 4,
  },
  quarters: {
    visibleUnits: 12,
    unitsBeforeToday: 1,
    navigationUnits: 4,
    pixelsPerDay: 1.8,
  },
  semesters: {
    visibleUnits: 8,
    unitsBeforeToday: 1,
    navigationUnits: 2,
    pixelsPerDay: 1,
  },
  years: {
    visibleUnits: 8,
    unitsBeforeToday: 1,
    navigationUnits: 2,
    pixelsPerDay: 0.65,
  },
};

function localDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, month! - 1, day!, 12);
}

function semesterStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() < 6 ? 0 : 6, 1, 12);
}

function quarterStart(value: Date) {
  return new Date(
    value.getFullYear(),
    Math.floor(value.getMonth() / 3) * 3,
    1,
    12,
  );
}

function addScaleUnits(value: Date, scale: TimelineScale, amount: number) {
  if (scale === 'hours') return addHours(value, amount);
  if (scale === 'days') return addDays(value, amount);
  if (scale === 'weeks') return addDays(value, amount * 7);
  if (scale === 'months') return addMonths(value, amount);
  if (scale === 'quarters') return addMonths(value, amount * 3);
  if (scale === 'semesters') return addMonths(value, amount * 6);
  return addYears(value, amount);
}

function alignToScale(value: Date, scale: TimelineScale) {
  if (scale === 'hours') return startOfDay(value);
  if (scale === 'days') return value;
  if (scale === 'weeks') return startOfWeek(value, { weekStartsOn: 1 });
  if (scale === 'months') return startOfMonth(value);
  if (scale === 'quarters') return quarterStart(value);
  if (scale === 'semesters') return semesterStart(value);
  return startOfYear(value);
}

export function buildTimelineScaleRange({
  today,
  scale,
  windowOffset = 0,
}: {
  today: string;
  scale: TimelineScale;
  windowOffset?: number;
}): TimelineScaleRange {
  const metrics = scaleMetrics[scale];
  const alignedToday = alignToScale(localDate(today), scale);
  const start = addScaleUnits(
    alignedToday,
    scale,
    -metrics.unitsBeforeToday + windowOffset * metrics.navigationUnits,
  );
  const endExclusive = addScaleUnits(start, scale, metrics.visibleUnits);
  const end = addDays(endExclusive, -1);
  const totalDays = Math.max(1, differenceInCalendarDays(endExclusive, start));
  return { start, end, totalDays };
}

function monthName(value: Date, pattern: 'MMM' | 'MMMM' = 'MMM') {
  return format(value, pattern, { locale: ptBR }).replace('.', '');
}

function weekInterval(value: Date) {
  const end = endOfWeek(value, { weekStartsOn: 1 });
  if (value.getMonth() === end.getMonth()) {
    return `${format(value, 'd')}–${format(end, 'd')} ${monthName(end)}`;
  }
  return `${format(value, 'd')} ${monthName(value)}–${format(end, 'd')} ${monthName(end)}`;
}

const WEEKDAY_LABELS = [
  'dom',
  'seg',
  'ter',
  'qua',
  'qui',
  'sex',
  'sáb',
] as const;

function cellLabels(value: Date, scale: TimelineScale) {
  if (scale === 'hours') {
    return {
      label: `${format(value, 'HH')}h`,
      secondaryLabel: null,
      ariaLabel: format(value, "EEEE, d 'de' MMMM, HH:mm", { locale: ptBR }),
    };
  }
  if (scale === 'days') {
    return {
      label: format(value, 'd'),
      secondaryLabel: WEEKDAY_LABELS[value.getDay()]!,
      ariaLabel: format(value, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }),
    };
  }
  if (scale === 'weeks') {
    const interval = weekInterval(value);
    return {
      label: interval,
      secondaryLabel: `semana ${format(value, 'II')}`,
      ariaLabel: `Semana ${format(value, 'II')}, ${interval}`,
    };
  }
  if (scale === 'months') {
    const label = monthName(value, 'MMMM');
    return {
      label,
      secondaryLabel: null,
      ariaLabel: `${label} de ${format(value, 'yyyy')}`,
    };
  }
  if (scale === 'quarters') {
    const quarter = Math.floor(value.getMonth() / 3) + 1;
    const end = addMonths(value, 2);
    return {
      label: `${quarter}º tri`,
      secondaryLabel: `${monthName(value)}–${monthName(end)}`,
      ariaLabel: `${quarter}º trimestre de ${format(value, 'yyyy')}`,
    };
  }
  if (scale === 'semesters') {
    const semester = value.getMonth() < 6 ? 1 : 2;
    const end = addMonths(value, 5);
    return {
      label: `${semester}º semestre`,
      secondaryLabel: `${monthName(value)}–${monthName(end)}`,
      ariaLabel: `${semester}º semestre de ${format(value, 'yyyy')}`,
    };
  }
  const label = format(value, 'yyyy');
  return { label, secondaryLabel: null, ariaLabel: `Ano ${label}` };
}

function majorLabel(value: Date, scale: TimelineScale) {
  if (scale === 'hours')
    return format(value, "EEEE, d 'de' MMMM", { locale: ptBR });
  if (scale === 'days') return format(value, 'MMMM yyyy', { locale: ptBR });
  if (scale === 'weeks') {
    const quarter = Math.floor(value.getMonth() / 3) + 1;
    return `${monthName(value, 'MMMM')} · ${quarter}º tri ${format(value, 'yyyy')}`;
  }
  if (scale === 'years') {
    const decade = Math.floor(value.getFullYear() / 10) * 10;
    return `Década de ${decade}`;
  }
  return format(value, 'yyyy');
}

export function buildTimelineScaleCells(
  range: TimelineScaleRange,
  scale: TimelineScale,
) {
  const cells: TimelineScaleCell[] = [];
  let cursor = range.start;
  const endExclusive = addDays(range.end, 1);
  while (cursor < endExclusive) {
    const next = addScaleUnits(cursor, scale, 1);
    const labels = cellLabels(cursor, scale);
    cells.push({
      key: `${scale}-${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}-${cursor.getHours()}`,
      start: cursor,
      end: next > endExclusive ? endExclusive : next,
      ...labels,
      majorLabel: majorLabel(cursor, scale),
    });
    cursor = next;
  }
  return cells;
}

export function timelineCanvasWidth(
  range: TimelineScaleRange,
  scale: TimelineScale,
) {
  return range.totalDays * scaleMetrics[scale].pixelsPerDay;
}

function timeMinutes(value?: string | null) {
  if (!value) return 0;
  const [hours, minutes, seconds = 0] = value.split(':').map(Number);
  return hours! * 60 + minutes! + seconds! / 60;
}

export function timelinePosition({
  date,
  time,
  range,
  scale,
}: {
  date: string | Date;
  time?: string | null;
  range: TimelineScaleRange;
  scale: TimelineScale;
}) {
  const value = typeof date === 'string' ? localDate(date) : date;
  const calendarDays = differenceInCalendarDays(value, range.start);
  const dayFraction = time ? timeMinutes(time) / (24 * 60) : 0;
  return (calendarDays + dayFraction) * scaleMetrics[scale].pixelsPerDay;
}

export function timelineCellWidth(
  start: Date,
  end: Date,
  scale: TimelineScale,
) {
  if (scale === 'hours') return scaleMetrics.hours.pixelsPerDay / 24;
  return (
    differenceInCalendarDays(end, start) * scaleMetrics[scale].pixelsPerDay
  );
}

export function timelineDayWidth(scale: TimelineScale) {
  return scaleMetrics[scale].pixelsPerDay;
}

function dateWithTime(date: string, time: string) {
  const value = localDate(date);
  const [hours, minutes, seconds = 0] = time.split(':').map(Number);
  value.setHours(hours!, minutes!, seconds!, 0);
  return value;
}

export type TimelineSnapDelta = {
  deltaDays: number;
  deltaMinutes: number;
};

export function shiftTimelineValue({
  date,
  time,
  deltaDays,
  deltaMinutes,
}: {
  date: string;
  time?: string | null;
  deltaDays: number;
  deltaMinutes: number;
}) {
  if (!time) {
    return {
      date: format(addDays(localDate(date), deltaDays), 'yyyy-MM-dd'),
      time: null,
    };
  }
  const shifted = addMinutes(dateWithTime(date, time), deltaMinutes);
  return {
    date: format(shifted, 'yyyy-MM-dd'),
    time: format(shifted, 'HH:mm:ss'),
  };
}

export function timelineSnapDelta({
  date,
  time,
  deltaPixels,
  scale,
}: {
  date: string;
  time?: string | null;
  deltaPixels: number;
  scale: TimelineScale;
}): TimelineSnapDelta {
  const timedHourScale = scale === 'hours' && Boolean(time);
  if (timedHourScale) {
    const hourWidth = scaleMetrics.hours.pixelsPerDay / 24;
    const hours = Math.round(deltaPixels / hourWidth);
    const source = dateWithTime(date, time!);
    const target = addHours(source, hours);
    return {
      deltaDays: differenceInCalendarDays(target, source),
      deltaMinutes: differenceInMinutes(target, source),
    };
  }

  const source = localDate(date);
  const nominalCellWidth =
    scale === 'hours'
      ? scaleMetrics.hours.pixelsPerDay
      : scale === 'days'
        ? scaleMetrics.days.pixelsPerDay
        : scale === 'weeks'
          ? scaleMetrics.weeks.pixelsPerDay * 7
          : scale === 'months'
            ? scaleMetrics.months.pixelsPerDay * 30.4375
            : scale === 'quarters'
              ? scaleMetrics.quarters.pixelsPerDay * 91.3125
              : scale === 'semesters'
                ? scaleMetrics.semesters.pixelsPerDay * 182.625
                : scaleMetrics.years.pixelsPerDay * 365.25;
  const units = Math.round(deltaPixels / nominalCellWidth);
  const target = addScaleUnits(
    source,
    scale === 'hours' ? 'days' : scale,
    units,
  );
  return {
    deltaDays: differenceInCalendarDays(target, source),
    deltaMinutes: differenceInCalendarDays(target, source) * 24 * 60,
  };
}

export function timelineKeyboardDelta({
  date,
  time,
  scale,
  direction,
}: {
  date: string;
  time?: string | null;
  scale: TimelineScale;
  direction: -1 | 1;
}) {
  const nominalPixels =
    scale === 'hours' && time
      ? scaleMetrics.hours.pixelsPerDay / 24
      : scale === 'hours'
        ? scaleMetrics.hours.pixelsPerDay
        : scale === 'days'
          ? scaleMetrics.days.pixelsPerDay
          : scale === 'weeks'
            ? scaleMetrics.weeks.pixelsPerDay * 7
            : scale === 'months'
              ? scaleMetrics.months.pixelsPerDay * 30.4375
              : scale === 'quarters'
                ? scaleMetrics.quarters.pixelsPerDay * 91.3125
                : scale === 'semesters'
                  ? scaleMetrics.semesters.pixelsPerDay * 182.625
                  : scaleMetrics.years.pixelsPerDay * 365.25;
  return timelineSnapDelta({
    date,
    time,
    scale,
    deltaPixels: nominalPixels * direction,
  });
}
