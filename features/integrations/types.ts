export const apiScopes = [
  'tasks:read',
  'tasks:write',
  'projects:read',
  'resources:read',
  'webhooks:manage',
] as const;

export type ApiScope = (typeof apiScopes)[number];

export type WorkspaceApiKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  version: number;
};

export type WorkspaceAutomationSettings = {
  slackEnabled: boolean;
  emailEnabled: boolean;
  webhookEnabled: boolean;
  corporateEmailDomain: string | null;
  notifyOnAssignment: boolean;
  notifyOnStatusChange: boolean;
  notifyOnDueChange: boolean;
  notifyOnPriorityChange: boolean;
  notifyOnContentChange: boolean;
  notifyOnComment: boolean;
  collapseWindowSeconds: number;
  version: number;
};

export type ApiPlatformState = {
  available: boolean;
  keys: WorkspaceApiKey[];
  settings: WorkspaceAutomationSettings;
  integrations: WorkspaceIntegration[];
};

export type WorkspaceIntegration = {
  provider: 'slack' | 'resend';
  status: 'active' | 'attention' | 'disconnected';
  publicConfig: Record<string, unknown>;
  updatedAt: string;
  version: number;
};

export const defaultAutomationSettings: WorkspaceAutomationSettings = {
  slackEnabled: false,
  emailEnabled: false,
  webhookEnabled: false,
  corporateEmailDomain: null,
  notifyOnAssignment: true,
  notifyOnStatusChange: true,
  notifyOnDueChange: true,
  notifyOnPriorityChange: true,
  notifyOnContentChange: true,
  notifyOnComment: true,
  collapseWindowSeconds: 60,
  version: 0,
};
