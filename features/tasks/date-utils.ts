import { addDays, startOfMonth, startOfWeek } from 'date-fns';

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function currentDateInTimeZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function dateFromKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31)
    return false;

  const date = new Date(year, month - 1, day, 12);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function normalizeDateReference(
  value: unknown,
  fallbackDateKey: string,
) {
  if (!isDateKey(fallbackDateKey))
    throw new RangeError(
      'A data de fallback precisa usar o formato YYYY-MM-DD.',
    );

  const candidate = typeof value === 'string' ? value.trim() : '';
  return isDateKey(candidate) ? candidate : fallbackDateKey;
}

export function calendarWeekKeysFromDate(referenceDateKey: string) {
  const referenceDate = validatedDateFromKey(referenceDateKey);
  const monday = startOfWeek(referenceDate, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, index) =>
    toDateKey(addDays(monday, index)),
  );
}

export function calendarWeekRange(referenceDateKey: string) {
  const keys = calendarWeekKeysFromDate(referenceDateKey);
  return { start: keys[0], end: keys[6] } as const;
}

export function calendarMonthGridKeys(referenceDateKey: string) {
  const firstDay = startOfMonth(validatedDateFromKey(referenceDateKey));
  const gridStart = startOfWeek(firstDay, { weekStartsOn: 1 });
  return Array.from({ length: 42 }, (_, index) =>
    toDateKey(addDays(gridStart, index)),
  );
}

export function calendarWeekKeys(timeZone: string) {
  return calendarWeekKeysFromDate(currentDateInTimeZone(timeZone));
}

function validatedDateFromKey(value: string) {
  if (!isDateKey(value))
    throw new RangeError('A data precisa usar o formato YYYY-MM-DD.');
  return dateFromKey(value);
}
