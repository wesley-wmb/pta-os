export const RESOURCE_TYPES = [
  'link',
  'document',
  'folder',
  'system',
  'dashboard',
  'page',
  'creative',
  'video',
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export type ResourceCategory = {
  id: string;
  name: string;
  color: string;
};

export type ResourceCategoryAdmin = ResourceCategory & {
  position: number;
  updated_at: string;
  resource_count: number;
};

export type ResourceCategoryListPayload = {
  snapshot: string;
  categories: ResourceCategoryAdmin[];
  can_manage: boolean;
};

export type ResourceRelationKind = 'task' | 'product' | 'event' | 'tag';

export type ResourceRelationOption = {
  id: string;
  label: string;
  meta: string | null;
  color: string | null;
};

export type ResourceRelationOptionsPayload = {
  items: ResourceRelationOption[];
};

export type ResourcePermissionMember = {
  id: string;
  fullName: string;
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
};

export type ResourceListItem = {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  resource_type: ResourceType;
  external_url: string;
  category: ResourceCategory | null;
  is_restricted: boolean;
  is_favorite: boolean;
  last_visited_at: string | null;
  version: number;
  updated_at: string;
  archived_at: string | null;
  can_edit: boolean;
};

export type ResourceListPayload = {
  items: ResourceListItem[];
  total: number;
  limit: number;
  offset: number;
  facets: {
    categories: ResourceCategory[];
    resource_types: ResourceType[];
  };
};

export type ResourceDetailPayload = {
  resource: {
    id: string;
    workspace_id: string;
    title: string;
    description: string | null;
    resource_type: ResourceType;
    external_url: string;
    category: ResourceCategory | null;
    is_restricted: boolean;
    is_favorite: boolean;
    last_visited_at: string | null;
    version: number;
    created_by: string;
    created_at: string;
    updated_at: string;
    archived_at: string | null;
  };
  relations: {
    tasks: Array<{ id: string; task_key: string; title: string }>;
    products: Array<{ id: string; name: string }>;
    events: Array<{ id: string; name: string }>;
    tags: Array<{ id: string; name: string; color: string }>;
  };
  permissions: Array<{
    user_id: string;
    full_name: string;
    permission: 'view' | 'edit';
  }>;
  capabilities: {
    can_edit: boolean;
    can_manage_permissions: boolean;
    can_archive: boolean;
  };
};

export type ResourceViewMode = 'all' | 'favorites' | 'recent';

export type ResourceFilters = {
  query: string;
  view: ResourceViewMode;
  categoryId: string;
  resourceType: ResourceType | 'all';
};

export type ResourceFormInput = {
  title: string;
  externalUrl: string;
  resourceType: ResourceType;
  description: string;
  categoryId: string;
  taskIds: string[];
  productIds: string[];
  eventIds: string[];
  tagIds: string[];
  isRestricted: boolean;
  permissions: Array<{
    userId: string;
    permission: 'view' | 'edit';
  }>;
};
