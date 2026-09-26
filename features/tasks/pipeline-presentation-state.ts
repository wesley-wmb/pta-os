import type { PipelineView } from './pipeline-state';

export type WeeklyPresentationFormat = 'week' | 'list' | 'calendar';
export type WeeklyPresentationFormatQuery = 'semana' | 'lista' | 'calendario';
export type PlanningPipelineView = Extract<
  PipelineView,
  'day' | 'week' | 'month'
>;

const DEFAULT_WEEKLY_PRESENTATION_FORMAT: WeeklyPresentationFormat = 'week';

const QUERY_BY_WEEKLY_FORMAT: Record<
  WeeklyPresentationFormat,
  WeeklyPresentationFormatQuery
> = {
  week: 'semana',
  list: 'lista',
  calendar: 'calendario',
};

const WEEKLY_FORMAT_BY_QUERY: Record<
  WeeklyPresentationFormatQuery,
  WeeklyPresentationFormat
> = {
  semana: 'week',
  lista: 'list',
  calendario: 'calendar',
};

const PLANNING_VIEWS = new Set<PipelineView>(['day', 'week', 'month']);

export function parseWeeklyPresentationFormat(
  value: unknown,
  fallback: WeeklyPresentationFormat = DEFAULT_WEEKLY_PRESENTATION_FORMAT,
): WeeklyPresentationFormat {
  const safeFallback = isWeeklyPresentationFormat(fallback)
    ? fallback
    : DEFAULT_WEEKLY_PRESENTATION_FORMAT;

  if (typeof value !== 'string') return safeFallback;

  const queryValue = value.trim() as WeeklyPresentationFormatQuery;
  return WEEKLY_FORMAT_BY_QUERY[queryValue] ?? safeFallback;
}

export function serializeWeeklyPresentationFormat(
  format: WeeklyPresentationFormat,
): WeeklyPresentationFormatQuery {
  return QUERY_BY_WEEKLY_FORMAT[format];
}

export function isPlanningPipelineView(
  view: PipelineView,
): view is PlanningPipelineView {
  return PLANNING_VIEWS.has(view);
}

function isWeeklyPresentationFormat(
  value: unknown,
): value is WeeklyPresentationFormat {
  return (
    typeof value === 'string' && Object.hasOwn(QUERY_BY_WEEKLY_FORMAT, value)
  );
}
