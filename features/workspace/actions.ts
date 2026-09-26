'use server';

import { cookies } from 'next/headers';

import { createClient } from '@/lib/supabase/server';

import {
  ACTIVE_WORKSPACE_COOKIE,
  activeWorkspaceCookieOptions,
  workspaceIdSchema,
} from './selection';

export type SelectWorkspaceResult =
  { ok: true } | { ok: false; message: string };

export async function selectActiveWorkspace(
  workspaceId: unknown,
): Promise<SelectWorkspaceResult> {
  const parsedWorkspaceId = workspaceIdSchema.safeParse(workspaceId);
  if (!parsedWorkspaceId.success) {
    return { ok: false, message: 'O workspace informado não é válido.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: 'Sua sessão expirou. Entre novamente.' };
  }

  const [membershipResult, workspaceResult] = await Promise.all([
    supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', parsedWorkspaceId.data)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('workspaces')
      .select('id')
      .eq('id', parsedWorkspaceId.data)
      .is('archived_at', null)
      .maybeSingle(),
  ]);

  if (
    membershipResult.error ||
    workspaceResult.error ||
    !membershipResult.data ||
    !workspaceResult.data
  ) {
    return {
      ok: false,
      message: 'Você não possui acesso ativo a este workspace.',
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    ACTIVE_WORKSPACE_COOKIE,
    parsedWorkspaceId.data,
    activeWorkspaceCookieOptions,
  );

  return { ok: true };
}
