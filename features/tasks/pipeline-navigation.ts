import {
  serializeWeeklyPresentationFormat,
  type WeeklyPresentationFormat,
} from './pipeline-presentation-state';
import { serializePipelineView, type PipelineView } from './pipeline-state';

export function buildPipelineViewLocation({
  pathname,
  currentSearch,
  view,
  referenceDate,
}: {
  pathname: string;
  currentSearch: string;
  view: PipelineView;
  referenceDate: string;
}) {
  const params = new URLSearchParams(currentSearch);
  params.set('visao', serializePipelineView(view));

  if (view === 'kanban' || view === 'table') {
    params.delete('data');
    params.delete('formato');
  } else {
    params.set('data', referenceDate);
  }

  return locationWithSearchParams(pathname, params);
}

export function buildWeeklyPresentationLocation({
  pathname,
  currentSearch,
  format,
  referenceDate,
}: {
  pathname: string;
  currentSearch: string;
  format: WeeklyPresentationFormat;
  referenceDate: string;
}) {
  const params = new URLSearchParams(currentSearch);
  params.set('visao', 'semana');
  params.set('formato', serializeWeeklyPresentationFormat(format));
  params.set('data', referenceDate);

  return locationWithSearchParams(pathname, params);
}

function locationWithSearchParams(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
