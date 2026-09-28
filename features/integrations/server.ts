import 'server-only';

import { getWorkspaceContext } from '@/features/workspace/server';
import { createClient } from '@/lib/supabase/server';

import {
  apiKeyListSchema,
  automationSettingsSchema,
  integrationListSchema,
} from './schemas';
import {
  defaultAutomationSettings,
  type ApiPlatformState,
  type WorkspaceApiKey,
  type WorkspaceAutomationSettings,
} from './types';

type RpcResult = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}>;
type RpcInvoker = (name: string, args: Record<string, unknown>) => RpcResult;

export async function getApiPlatformState(): Promise<ApiPlatformState> {
  const context = await getWorkspaceContext();
  if (!context?.workspace) throw new Error('PTA_WORKSPACE_REQUIRED');

  const supabase = await createClient();
  const rpc = supabase.rpc.bind(supabase) as unknown as RpcInvoker;
  const [keysResult, settingsResult, integrationsResult] = await Promise.all([
    rpc('list_workspace_api_keys', { p_workspace_id: context.workspace.id }),
    rpc('get_workspace_automation_settings', {
      p_workspace_id: context.workspace.id,
    }),
    rpc('list_workspace_integrations', {
      p_workspace_id: context.workspace.id,
    }),
  ]);

  if (keysResult.error || settingsResult.error || integrationsResult.error) {
    return {
      available: false,
      keys: [],
      settings: defaultAutomationSettings,
      integrations: [],
    };
  }

  return {
    available: true,
    keys: apiKeyListSchema.parse(keysResult.data).map(mapApiKey),
    settings: mapAutomationSettings(
      automationSettingsSchema.parse(settingsResult.data),
    ),
    integrations: integrationListSchema
      .parse(integrationsResult.data)
      .map((integration) => ({
        provider: integration.provider,
        status: integration.status,
        publicConfig: integration.public_config,
        updatedAt: integration.updated_at,
        version: integration.version,
      })),
  };
}

export function mapApiKey(
  value: ReturnType<typeof apiKeyListSchema.parse>[number],
): WorkspaceApiKey {
  return {
    id: value.id,
    name: value.name,
    prefix: value.prefix,
    scopes: value.scopes,
    createdAt: value.created_at,
    lastUsedAt: value.last_used_at,
    expiresAt: value.expires_at,
    revokedAt: value.revoked_at,
    version: value.version,
  };
}

export function mapAutomationSettings(
  value: ReturnType<typeof automationSettingsSchema.parse>,
): WorkspaceAutomationSettings {
  return {
    slackEnabled: value.slack_enabled,
    emailEnabled: value.email_enabled,
    webhookEnabled: value.webhook_enabled,
    corporateEmailDomain: value.corporate_email_domain,
    notifyOnAssignment: value.notify_on_assignment,
    notifyOnStatusChange: value.notify_on_status_change,
    notifyOnDueChange: value.notify_on_due_change,
    notifyOnPriorityChange: value.notify_on_priority_change,
    notifyOnContentChange: value.notify_on_content_change,
    notifyOnComment: value.notify_on_comment,
    collapseWindowSeconds: value.collapse_window_seconds,
    version: value.version,
  };
}
