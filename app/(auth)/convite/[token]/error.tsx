'use client';

import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AuthShell } from '@/features/auth/auth-shell';

export default function InvitationError({ reset }: { reset: () => void }) {
  return (
    <AuthShell
      title="Não foi possível abrir o convite"
      description="A conexão falhou antes da validação. Nenhum acesso foi alterado."
      footer="Se o problema continuar, peça um novo link ao administrador do workspace."
    >
      <div className="space-y-5">
        <span className="grid size-10 place-items-center rounded-lg bg-destructive/10 text-destructive">
          <AlertCircle aria-hidden="true" className="size-5" />
        </span>
        <p className="text-sm leading-6 text-muted-foreground">
          Tente novamente quando a conexão estiver estável.
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={reset}
        >
          Tentar novamente
        </Button>
      </div>
    </AuthShell>
  );
}
