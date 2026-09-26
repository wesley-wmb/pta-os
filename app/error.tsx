'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function AppError({ retry }: { retry: () => void }) {
  return (
    <main
      id="conteudo-principal"
      className="grid min-h-[100dvh] place-items-center bg-background px-6 py-16 text-foreground"
    >
      <section className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 shadow-sm sm:p-10">
        <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle aria-hidden="true" className="size-6" />
        </div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          Conexão temporariamente indisponível
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.035em]">
          Não foi possível carregar o workspace
        </h1>
        <p className="mt-3 max-w-md text-base leading-7 text-muted-foreground">
          Tente novamente. Seus dados continuam preservados no Supabase.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="button" size="lg" onClick={() => retry()}>
            <RefreshCw aria-hidden="true" />
            Tentar novamente
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Voltar ao acesso</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
