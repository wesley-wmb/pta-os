'use client';

import { Button } from '@/components/ui/button';

export default function PeekError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-full place-items-center px-6 py-12" role="alert">
      <div className="max-w-sm text-center">
        <h2 className="font-semibold">Não foi possível abrir esta tarefa.</h2>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={reset}
        >
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
