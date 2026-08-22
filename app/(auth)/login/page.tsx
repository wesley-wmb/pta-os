import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LocalSetup } from '@/components/system/local-setup';
import { LoginForm } from '@/features/auth/login-form';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const metadata: Metadata = { title: 'Entrar' };

export default function LoginPage() {
  if (!isSupabaseConfigured()) return <LocalSetup />;

  return (
    <main
      id="conteudo-principal"
      className="grid min-h-dvh place-items-center px-5 py-10"
    >
      <section className="w-full max-w-[390px]" aria-labelledby="login-title">
        <div className="mb-12 flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-md bg-foreground text-xs text-background">
            PTA
          </span>
          <span>OS</span>
          <span
            className="size-2 rounded-full bg-pta-lime"
            aria-hidden="true"
          />
        </div>
        <header className="mb-8">
          <h1
            id="login-title"
            className="text-3xl font-semibold tracking-[-0.035em]"
          >
            Entre no PTA OS
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use seu e-mail de trabalho para continuar.
          </p>
        </header>
        <Suspense
          fallback={
            <p className="py-10 text-sm text-muted-foreground" role="status">
              Carregando acesso…
            </p>
          }
        >
          <LoginForm />
        </Suspense>
        <p className="mt-10 border-t pt-5 text-xs leading-5 text-muted-foreground">
          Acesso protegido por autenticação e políticas de segurança do
          workspace.
        </p>
      </section>
    </main>
  );
}
