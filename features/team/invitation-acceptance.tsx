'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  LogIn,
  LogOut,
  ShieldCheck,
  UserPlus,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { selectActiveWorkspace } from '@/features/workspace/actions';
import { createClient } from '@/lib/supabase/client';

import { acceptWorkspaceInvitation } from './api';
import { teamMutationErrorMessage } from './errors';
import { TEAM_ROLE_LABEL } from './labels';
import type { InvitationRouteState } from './types';

type AcceptedWorkspace = {
  id: string;
  name: string;
  selected: boolean;
};

export function InvitationAcceptance({
  token,
  state,
  signUpEnabled,
}: {
  token: string;
  state: InvitationRouteState;
  signUpEnabled: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<'accept' | 'select' | 'sign-out'>();
  const [error, setError] = useState<string>();
  const [acceptedWorkspace, setAcceptedWorkspace] =
    useState<AcceptedWorkspace | null>(null);
  const invitePath = `/convite/${encodeURIComponent(token)}`;
  const loginHref = `/login?retorno=${encodeURIComponent(invitePath)}`;
  const signUpHref = `${loginHref}&modo=cadastro`;

  if (state.authStatus === 'anonymous') {
    return (
      <div className="space-y-5">
        <StateMark icon={LogIn} />
        <div>
          <h2 className="text-base font-semibold">Confirme sua identidade</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Entre com o e-mail que recebeu o convite. Os dados do workspace só
            aparecem depois desta confirmação.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href={loginHref}>Entrar para continuar</Link>
        </Button>
        {signUpEnabled ? (
          <Button asChild variant="outline" className="w-full">
            <Link href={signUpHref}>Criar conta com o e-mail convidado</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  if (acceptedWorkspace) {
    return (
      <div className="space-y-5">
        <StateMark icon={CheckCircle2} tone="success" />
        <div>
          <h2 className="text-base font-semibold">Acesso confirmado</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {acceptedWorkspace.selected
              ? `Você agora faz parte de ${acceptedWorkspace.name}.`
              : `Seu acesso a ${acceptedWorkspace.name} foi criado. Tente abrir o workspace novamente.`}
          </p>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button
          type="button"
          className="w-full"
          disabled={Boolean(busy)}
          onClick={async () => {
            if (!acceptedWorkspace.selected) {
              setBusy('select');
              setError(undefined);
              try {
                const selection = await selectActiveWorkspace(
                  acceptedWorkspace.id,
                );
                if (!selection.ok) {
                  setError(selection.message);
                  return;
                }
                queryClient.clear();
              } catch {
                setError(
                  'Não foi possível abrir o workspace. Tente novamente.',
                );
                return;
              } finally {
                setBusy(undefined);
              }
            }
            router.replace('/inicio');
            router.refresh();
          }}
        >
          {busy === 'select' ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : null}
          {busy === 'select'
            ? 'Abrindo workspace…'
            : acceptedWorkspace.selected
              ? 'Entrar no workspace'
              : 'Tentar abrir o workspace'}
        </Button>
      </div>
    );
  }

  const invitation = state.invitation;
  if (invitation.status === 'pending') {
    return (
      <div className="space-y-6">
        <StateMark icon={UserPlus} />
        <dl className="border-y py-4">
          <Definition label="Workspace" value={invitation.workspaceName} />
          <Definition label="Papel" value={TEAM_ROLE_LABEL[invitation.role]} />
          <Definition
            label="Validade"
            value={formatInviteExpiry(invitation.expiresAt)}
          />
          <Definition
            label="Conta"
            value={state.currentEmail ?? 'E-mail autenticado'}
          />
        </dl>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          type="button"
          className="w-full"
          disabled={Boolean(busy)}
          onClick={async () => {
            setBusy('accept');
            setError(undefined);
            try {
              const result = await acceptWorkspaceInvitation(token);
              setAcceptedWorkspace({
                id: result.workspaceId,
                name: result.workspaceName,
                selected: false,
              });
              try {
                const selection = await selectActiveWorkspace(
                  result.workspaceId,
                );
                if (!selection.ok) {
                  setError(selection.message);
                  return;
                }
                queryClient.clear();
                setAcceptedWorkspace({
                  id: result.workspaceId,
                  name: result.workspaceName,
                  selected: true,
                });
              } catch {
                setError(
                  'Não foi possível abrir o workspace. Tente novamente.',
                );
              }
            } catch (acceptError) {
              setError(
                teamMutationErrorMessage(
                  acceptError,
                  'Não foi possível aceitar o convite. Tente novamente.',
                ),
              );
            } finally {
              setBusy(undefined);
            }
          }}
        >
          {busy === 'accept' ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <ShieldCheck aria-hidden="true" />
          )}
          {busy === 'accept' ? 'Confirmando acesso…' : 'Aceitar convite'}
        </Button>
      </div>
    );
  }

  const copy = terminalStateCopy(invitation.status);
  const mismatch = invitation.status === 'email_mismatch';

  return (
    <div className="space-y-5">
      <StateMark
        icon={
          mismatch
            ? AlertCircle
            : invitation.status === 'expired'
              ? Clock3
              : XCircle
        }
        tone="neutral"
      />
      <div>
        <h2 className="text-base font-semibold">{copy.title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {copy.description}
        </p>
        {mismatch && state.currentEmail ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Conta atual: {state.currentEmail}
          </p>
        ) : null}
      </div>

      {mismatch ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={Boolean(busy)}
          onClick={async () => {
            setBusy('sign-out');
            const supabase = createClient();
            await supabase.auth.signOut();
            router.replace(loginHref);
            router.refresh();
          }}
        >
          {busy === 'sign-out' ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <LogOut aria-hidden="true" />
          )}
          Entrar com outro e-mail
        </Button>
      ) : (
        <Button asChild variant="outline" className="w-full">
          <Link href="/inicio">Ir para o PTA OS</Link>
        </Button>
      )}
    </div>
  );
}

function StateMark({
  icon: Icon,
  tone = 'primary',
}: {
  icon: typeof LogIn;
  tone?: 'primary' | 'success' | 'neutral';
}) {
  return (
    <span
      className={
        tone === 'success'
          ? 'grid size-10 place-items-center rounded-lg bg-emerald-600/10 text-emerald-700'
          : tone === 'neutral'
            ? 'grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground'
            : 'grid size-10 place-items-center rounded-lg bg-primary/10 text-primary'
      }
    >
      <Icon aria-hidden="true" className="size-5" />
    </span>
  );
}

function Definition({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{value}</dd>
    </div>
  );
}

function formatInviteExpiry(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}

function terminalStateCopy(
  status: Exclude<
    InvitationRouteState,
    { authStatus: 'anonymous' }
  >['invitation']['status'],
) {
  if (status === 'email_mismatch') {
    return {
      title: 'Este convite pertence a outro e-mail',
      description: 'Saia e entre com o mesmo endereço que recebeu o convite.',
    };
  }
  if (status === 'expired') {
    return {
      title: 'Este convite expirou',
      description: 'Peça a um administrador para gerar um novo link.',
    };
  }
  if (status === 'cancelled') {
    return {
      title: 'Este convite foi cancelado',
      description: 'Peça um novo convite ao administrador do workspace.',
    };
  }
  if (status === 'accepted') {
    return {
      title: 'Este convite já foi usado',
      description: 'Se o acesso foi concluído, entre normalmente no PTA OS.',
    };
  }
  return {
    title: 'Link de convite inválido',
    description: 'Confira o endereço recebido ou peça um novo convite.',
  };
}
