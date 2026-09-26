'use client';

import { CircleAlert, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';

export function OperationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[900px] px-5 py-12 sm:px-8">
      <section
        role="alert"
        className="flex min-h-64 flex-col items-center justify-center border-y px-6 py-14 text-center"
      >
        <span className="grid size-9 place-items-center text-destructive">
          <CircleAlert aria-hidden="true" className="size-5" />
        </span>
        <h2 className="mt-5 text-lg font-semibold">Esta área não carregou.</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Tente novamente. Nada foi alterado.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Tentar novamente
        </button>
      </section>
    </div>
  );
}
