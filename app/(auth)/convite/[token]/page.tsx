import type { Metadata } from 'next';

import { LocalSetup } from '@/components/system/local-setup';
import { AuthShell } from '@/features/auth/auth-shell';
import { isSelfSignUpEnabled } from '@/features/auth/config';
import { InvitationAcceptance } from '@/features/team/invitation-acceptance';
import { TEAM_ROLE_LABEL } from '@/features/team/labels';
import { getInvitationRouteState } from '@/features/team/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const metadata: Metadata = { title: 'Convite' };
export const dynamic = 'force-dynamic';

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  if (!isSupabaseConfigured()) return <LocalSetup />;

  const { token } = await params;
  const state = await getInvitationRouteState(token);
  const pending =
    state.authStatus === 'authenticated' &&
    state.invitation.status === 'pending'
      ? state.invitation
      : null;

  return (
    <AuthShell
      title={
        pending ? `Convite para ${pending.workspaceName}` : 'Convite de acesso'
      }
      description={
        pending
          ? `Revise o acesso como ${TEAM_ROLE_LABEL[pending.role].toLocaleLowerCase('pt-BR')} antes de entrar.`
          : 'Confirme sua conta para continuar com segurança.'
      }
      footer="O convite é pessoal, expira automaticamente e funciona uma única vez."
    >
      <InvitationAcceptance
        token={token}
        state={state}
        signUpEnabled={isSelfSignUpEnabled()}
      />
    </AuthShell>
  );
}
