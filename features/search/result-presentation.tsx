import {
  CalendarRange,
  Link2,
  ListTodo,
  Package,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

import type { SearchEntityType } from './types';

const entityIcons: Record<SearchEntityType, LucideIcon> = {
  task: ListTodo,
  event: CalendarRange,
  product: Package,
  resource: Link2,
  person: UserRound,
};

const resourceTypeLabels: Record<string, string> = {
  link: 'Link',
  document: 'Documento',
  folder: 'Pasta',
  system: 'Sistema',
  dashboard: 'Painel',
  page: 'Página',
  creative: 'Criativo',
  video: 'Vídeo',
};

const sensitiveSubtitlePattern =
  /(?:https?:\/\/|file:\/\/|[a-z]:\\|\b[^\s@]+@[^\s@]+\.[^\s@]+\b)/i;

export function SearchEntityIcon({
  entityType,
  className,
}: {
  entityType: SearchEntityType;
  className?: string;
}) {
  const Icon = entityIcons[entityType];
  return <Icon aria-hidden="true" className={className} strokeWidth={1.75} />;
}

export function displaySearchSubtitle(
  subtitle: string | null,
  entityType: SearchEntityType,
) {
  if (!subtitle || sensitiveSubtitlePattern.test(subtitle)) return null;
  if (entityType !== 'resource') return subtitle;

  const segments = subtitle.split(' · ');
  const lastSegment = segments.at(-1);
  if (!lastSegment || !resourceTypeLabels[lastSegment]) return subtitle;

  return [...segments.slice(0, -1), resourceTypeLabels[lastSegment]].join(
    ' · ',
  );
}
