import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { LocalSetup } from '@/components/system/local-setup';
import { AuthShell } from '@/features/auth/auth-shell';
import { NewPasswordForm } from '@/features/auth/new-password-form';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Nova senha' };

export default async function NewPasswordPage() {
  if (!isSupabaseConfigured()) return <LocalSetup />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/recuperar-senha?erro=link-invalido');

  return (
    <AuthShell
      title="Crie uma nova senha"
      description="Use pelo menos 8 caracteres."
      footer="Depois de salvar, entre novamente com a nova senha."
    >
      <NewPasswordForm />
    </AuthShell>
  );
}
