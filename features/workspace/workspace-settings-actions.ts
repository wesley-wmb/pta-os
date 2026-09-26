'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

import { getWorkspaceContext } from './server';
import {
  workspaceSettingsFormSchema,
  workspaceSettingsResponseSchema,
  type WorkspaceSettings,
  type WorkspaceSettingsFormInput,
} from './workspace-settings-schema';

export type UpdateWorkspaceSettingsResult =
  | { ok: true; settings: WorkspaceSettings }
  | { ok: false; code: string; message: string };

export async function updateWorkspaceSettings(
  input: WorkspaceSettingsFormInput,
): Promise<UpdateWorkspaceSettingsResult> {
  const parsed = workspaceSettingsFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'PTA_INVALID_WORKSPACE_SETTINGS',
      message:
        parsed.error.issues[0]?.message ?? 'Revise os campos informados.',
    };
  }

  const context = await getWorkspaceContext();
  if (!context?.workspace || context.workspace.id !== parsed.data.workspaceId) {
    return {
      ok: false,
      code: 'PTA_WORKSPACE_FORBIDDEN',
      message:
        'O workspace selecionado mudou. Atualize a página e tente novamente.',
    };
  }

  const supabase = await createClient();
  const result = await supabase.rpc('update_workspace_settings', {
    p_workspace_id: parsed.data.workspaceId,
    p_expected_version: parsed.data.expectedVersion,
    p_name: parsed.data.name,
    p_task_prefix: parsed.data.taskPrefix,
    p_accent_color: parsed.data.accentColor,
    p_timezone: parsed.data.timezone,
    p_week_starts_on: parsed.data.weekStartsOn,
    p_working_days: parsed.data.workingDays,
    p_default_due_time: parsed.data.defaultDueTime,
    p_notification_digest: parsed.data.notificationDigest,
  });

  if (result.error) {
    const code = workspaceSettingsErrorCode(
      `${result.error.code ?? ''} ${result.error.message}`,
    );
    return { ok: false, code, message: workspaceSettingsErrorMessage(code) };
  }

  const response = workspaceSettingsResponseSchema.safeParse(result.data);
  if (!response.success) {
    return {
      ok: false,
      code: 'PTA_WORKSPACE_SETTINGS_INVALID_RESPONSE',
      message:
        'As alterações foram enviadas, mas a confirmação falhou. Atualize a página.',
    };
  }

  revalidatePath('/configuracoes');
  revalidatePath('/configuracoes/workspace');
  revalidatePath('/inicio');
  return { ok: true, settings: response.data };
}

function workspaceSettingsErrorCode(message: string) {
  const knownCodes = [
    'PTA_VERSION_CONFLICT',
    'PTA_WORKSPACE_SETTINGS_FORBIDDEN',
    'PTA_INVALID_WORKSPACE_NAME',
    'PTA_INVALID_TASK_PREFIX',
    'PTA_INVALID_ACCENT_COLOR',
    'PTA_INVALID_TIMEZONE',
    'PTA_INVALID_WEEK_START',
    'PTA_INVALID_WORKING_DAYS',
    'PGRST202',
  ];
  return (
    knownCodes.find((code) => message.includes(code)) ??
    'PTA_WORKSPACE_SETTINGS_FAILED'
  );
}

function workspaceSettingsErrorMessage(code: string) {
  if (code === 'PTA_VERSION_CONFLICT') {
    return 'Outra pessoa alterou o workspace. Atualize a página antes de salvar novamente.';
  }
  if (code === 'PTA_WORKSPACE_SETTINGS_FORBIDDEN') {
    return 'Somente proprietários e administradores podem alterar estas configurações.';
  }
  if (code.startsWith('PTA_INVALID_')) {
    return 'Uma das configurações informadas não é válida.';
  }
  if (code === 'PGRST202') {
    return 'A edição do workspace será liberada após a atualização do backend.';
  }
  return 'Não foi possível salvar as configurações. Tente novamente.';
}
