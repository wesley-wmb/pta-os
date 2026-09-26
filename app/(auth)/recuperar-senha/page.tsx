import type { Metadata } from 'next';

import { LocalSetup } from '@/components/system/local-setup';
import { AuthShell } from '@/features/auth/auth-shell';
import { PasswordRecoveryForm } from '@/features/auth/password-recovery-form';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const metadata: Metadata = { title: 'Recuperar senha' };

type PasswordRecoveryPageProps = {
  searchParams: Promise<{ erro?: string | string[] }>;
};

export default async function PasswordRecoveryPage({
  searchParams,
}: PasswordRecoveryPageProps) {
  if (!isSupabaseConfigured()) return <LocalSetup />;

  const params = await searchParams;
  const error = Array.isArray(params.erro) ? params.erro[0] : params.erro;

  return (
    <AuthShell
      title="Recupere sua senha"
      description="Informe seu e-mail para receber um link seguro."
      footer="O link expira e só pode ser usado uma vez."
    >
      <PasswordRecoveryForm invalidLink={error === 'link-invalido'} />
    </AuthShell>
  );
}
