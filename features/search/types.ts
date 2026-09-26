export const SEARCH_ENTITY_TYPES = [
  'task',
  'event',
  'product',
  'resource',
  'person',
] as const;

export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[number];

export type SearchResultItem = {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  score: number;
};

export type SearchResultGroup = {
  entity_type: SearchEntityType;
  label: string;
  items: SearchResultItem[];
};

export type SearchWorkspacePayload = {
  query: string;
  groups: SearchResultGroup[];
  total: number;
};
