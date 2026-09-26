'use client';

import { AlertCircle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function ResourcesError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-10 sm:px-8">
      <Alert variant="destructive" className="max-w-xl">
        <AlertCircle aria-hidden="true" />
        <AlertTitle>Não foi possível abrir a central</AlertTitle>
        <AlertDescription>
          Verifique sua conexão e tente novamente.
        </AlertDescription>
      </Alert>
      <Button type="button" variant="outline" className="mt-4" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
