'use client';

import { Button } from '@/components/ui/button';

export default function ProjectError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold">
        Não foi possível abrir o projeto
      </h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        O projeto pode ter mudado ou sua conexão foi interrompida.
      </p>
      <Button className="mt-5" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
