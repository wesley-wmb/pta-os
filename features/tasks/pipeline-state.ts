import { calendarWeekRange, isDateKey } from './date-utils';

export type PipelineView = 'kanban' | 'day' | 'week' | 'month' | 'table';
export type PeriodPipelineView = Extract<
  PipelineView,
  'day' | 'week' | 'month'
>;
export type PipelineViewQuery = 'kanban' | 'dia' | 'semana' | 'mes' | 'tabela';

const QUERY_BY_VIEW: Record<PipelineView, PipelineViewQuery> = {
  kanban: 'kanban',
  day: 'dia',
  week: 'semana',
  month: 'mes',
  table: 'tabela',
};

const VIEW_BY_QUERY: Record<PipelineViewQuery, PipelineView> = {
  kanban: 'kanban',
  dia: 'day',
  semana: 'week',
  mes: 'month',
  tabela: 'table',
};

export function parsePipelineView(
  value: unknown,
  fallback: PipelineView = 'kanban',
): PipelineView {
  if (typeof value !== 'string') return fallback;
  const queryValue = value.trim() as PipelineViewQuery;
  return VIEW_BY_QUERY[queryValue] ?? fallback;
}

export function serializePipelineView(view: PipelineView): PipelineViewQuery {
  return QUERY_BY_VIEW[view];
}

export function isReferenceInCurrentPeriod(
  view: PeriodPipelineView,
  referenceDateKey: string,
  currentDateKey: string,
) {
  if (!isDateKey(referenceDateKey) || !isDateKey(currentDateKey)) return false;

  if (view === 'day') return referenceDateKey === currentDateKey;
  if (view === 'month')
    return referenceDateKey.slice(0, 7) === currentDateKey.slice(0, 7);

  const referenceRange = calendarWeekRange(referenceDateKey);
  const currentRange = calendarWeekRange(currentDateKey);
  return (
    referenceRange.start === currentRange.start &&
    referenceRange.end === currentRange.end
  );
}
