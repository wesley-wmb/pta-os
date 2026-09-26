import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LocalSetup } from '@/components/system/local-setup';
import { AuthShell } from '@/features/auth/auth-shell';
import { isSelfSignUpEnabled } from '@/features/auth/config';
import { LoginForm } from '@/features/auth/login-form';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const metadata: Metadata = { title: 'Entrar' };

export default function LoginPage() {
  if (!isSupabaseConfigured()) return <LocalSetup />;

  return (
    <AuthShell
      title="Entre no PTA OS"
      description="Use seu e-mail de trabalho para continuar."
      footer="Use o acesso vinculado ao seu workspace."
    >
      <Suspense
        fallback={
          <p className="py-10 text-sm text-muted-foreground" role="status">
            Carregando acesso…
          </p>
        }
      >
        <LoginForm signUpEnabled={isSelfSignUpEnabled()} />
      </Suspense>
    </AuthShell>
  );
}
