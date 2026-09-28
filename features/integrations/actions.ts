'use server';

import { revalidatePath } from 'next/cache';

import { getWorkspaceContext } from '@/features/workspace/server';
import { createClient } from '@/lib/supabase/server';

import {
  automationSettingsInputSchema,
  createApiKeyInputSchema,
  createdApiKeySchema,
  integrationInputSchema,
} from './schemas';

type RpcResult = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}>;
type RpcInvoker = (name: string, args: Record<string, unknown>) => RpcResult;

export type ApiKeyActionState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  token?: string;
};

export async function createApiKeyAction(
  _previous: ApiKeyActionState,
  formData: FormData,
): Promise<ApiKeyActionState> {
  const input = createApiKeyInputSchema.safeParse({
    name: formData.get('name'),
    scopes: formData.getAll('scopes'),
    expiresAt: normalizeExpiration(formData.get('expiresAt')),
  });
  if (!input.success) {
    return {
      status: 'error',
      message: 'Revise o nome, os escopos e a validade.',
    };
  }

  try {
    const { workspaceId, rpc } = await administrationRpc();
    const result = await rpc('create_workspace_api_key', {
      p_workspace_id: workspaceId,
      p_name: input.data.name,
      p_scopes: input.data.scopes,
      p_expires_at: input.data.expiresAt,
    });
    if (result.error) throw new Error(result.error.message);
    const created = createdApiKeySchema.parse(result.data);
    revalidatePath('/configuracoes/api');
    return {
      status: 'success',
      message: 'Chave criada. Copie o valor agora.',
      token: created.token,
    };
  } catch {
    return {
      status: 'error',
      message:
        'Não foi possível criar a chave. Atualize a página e tente novamente.',
    };
  }
}

export async function revokeApiKeyAction(formData: FormData) {
  const keyId = String(formData.get('keyId') ?? '');
  const version = Number(formData.get('version'));
  if (!keyId || !Number.isInteger(version)) return;

  const { workspaceId, rpc } = await administrationRpc();
  const result = await rpc('revoke_workspace_api_key', {
    p_workspace_id: workspaceId,
    p_key_id: keyId,
    p_expected_version: version,
  });
  if (result.error) throw new Error('PTA_API_KEY_REVOKE_FAILED');
  revalidatePath('/configuracoes/api');
}

export async function updateAutomationSettingsAction(formData: FormData) {
  const parsed = automationSettingsInputSchema.safeParse({
    version: Number(formData.get('version')),
    slackEnabled: formData.get('slackEnabled') === 'on',
    emailEnabled: formData.get('emailEnabled') === 'on',
    webhookEnabled: formData.get('webhookEnabled') === 'on',
    corporateEmailDomain: normalizeDomain(formData.get('corporateEmailDomain')),
    notifyOnAssignment: formData.get('notifyOnAssignment') === 'on',
    notifyOnStatusChange: formData.get('notifyOnStatusChange') === 'on',
    notifyOnDueChange: formData.get('notifyOnDueChange') === 'on',
    notifyOnPriorityChange: formData.get('notifyOnPriorityChange') === 'on',
    notifyOnContentChange: formData.get('notifyOnContentChange') === 'on',
    notifyOnComment: formData.get('notifyOnComment') === 'on',
    collapseWindowSeconds: Number(formData.get('collapseWindowSeconds')),
  });
  if (!parsed.success) throw new Error('PTA_AUTOMATION_SETTINGS_INVALID');

  const { workspaceId, rpc } = await administrationRpc();
  const value = parsed.data;
  const result = await rpc('update_workspace_automation_settings', {
    p_workspace_id: workspaceId,
    p_expected_version: value.version,
    p_slack_enabled: value.slackEnabled,
    p_email_enabled: value.emailEnabled,
    p_webhook_enabled: value.webhookEnabled,
    p_corporate_email_domain: value.corporateEmailDomain,
    p_notify_on_assignment: value.notifyOnAssignment,
    p_notify_on_status_change: value.notifyOnStatusChange,
    p_notify_on_due_change: value.notifyOnDueChange,
    p_notify_on_priority_change: value.notifyOnPriorityChange,
    p_notify_on_content_change: value.notifyOnContentChange,
    p_notify_on_comment: value.notifyOnComment,
    p_collapse_window_seconds: value.collapseWindowSeconds,
  });
  if (result.error) throw new Error('PTA_AUTOMATION_SETTINGS_UPDATE_FAILED');
  revalidatePath('/configuracoes/api');
}

export async function configureIntegrationAction(formData: FormData) {
  const provider = String(formData.get('provider') ?? '');
  const parsed = integrationInputSchema.safeParse({
    provider,
    credential: formData.get('credential'),
    version: Number(formData.get('version') ?? 0),
    ...(provider === 'slack'
      ? { teamName: formData.get('teamName') }
      : { fromAddress: formData.get('fromAddress') }),
  });
  if (!parsed.success) {
    throw new Error('PTA_INTEGRATION_INPUT_INVALID');
  }

  const publicConfig =
    parsed.data.provider === 'slack'
      ? { team_name: parsed.data.teamName }
      : { from: parsed.data.fromAddress };
  const { workspaceId, rpc } = await administrationRpc();
  const result = await rpc('configure_workspace_integration', {
    p_workspace_id: workspaceId,
    p_provider: parsed.data.provider,
    p_credential: parsed.data.credential,
    p_public_config: publicConfig,
    p_expected_version: parsed.data.version,
  });
  if (result.error) throw new Error('PTA_INTEGRATION_CONFIGURE_FAILED');
  revalidatePath('/configuracoes/api');
}

async function administrationRpc() {
  const context = await getWorkspaceContext();
  if (!context?.workspace) throw new Error('PTA_WORKSPACE_REQUIRED');
  if (!['owner', 'admin'].includes(context.workspace.role)) {
    throw new Error('PTA_FORBIDDEN');
  }
  const supabase = await createClient();
  return {
    workspaceId: context.workspace.id,
    rpc: supabase.rpc.bind(supabase) as unknown as RpcInvoker,
  };
}

function normalizeExpiration(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(`${value}T23:59:59-03:00`);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function normalizeDomain(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/^@/u, '');
  return normalized || null;
}
