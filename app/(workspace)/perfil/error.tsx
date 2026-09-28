'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function ProfileError({ reset }: { reset: () => void }) {
  return (
    <section className="grid min-h-[60vh] place-items-center px-5 py-12">
      <section
        className="max-w-md text-center"
        aria-labelledby="profile-error-title"
      >
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle aria-hidden="true" />
        </span>
        <h1
          id="profile-error-title"
          className="mt-5 text-2xl font-semibold tracking-[-0.025em]"
        >
          Não foi possível abrir seu perfil
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Sua conta continua segura. Tente carregar os dados novamente.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-6"
          onClick={reset}
        >
          <RotateCcw aria-hidden="true" />
          Tentar novamente
        </Button>
      </section>
    </section>
  );
}
