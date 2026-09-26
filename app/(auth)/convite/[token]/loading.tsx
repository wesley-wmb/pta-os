import { Skeleton } from '@/components/ui/skeleton';
import { AuthShell } from '@/features/auth/auth-shell';

export default function InvitationLoading() {
  return (
    <AuthShell
      title="Convite de acesso"
      description="Confirmando sua conta e a validade do convite."
      footer="O convite é pessoal, expira automaticamente e funciona uma única vez."
    >
      <div className="space-y-5" role="status" aria-label="Carregando convite">
        <Skeleton className="size-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    </AuthShell>
  );
}
