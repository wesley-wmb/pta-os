'use client';

import {
  Crown,
  LoaderCircle,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import {
  changeWorkspaceMemberRole,
  reactivateWorkspaceMember,
  removeWorkspaceMember,
  suspendWorkspaceMember,
  transferWorkspaceOwnership,
} from './api';
import { teamMutationErrorMessage } from './errors';
import { INVITE_ROLE_OPTIONS, TEAM_ROLE_LABEL } from './labels';
import type { TeamRole } from './schemas';
import type { ManagedTeamMember } from './types';

type ConfirmAction = 'suspend' | 'reactivate' | 'remove' | 'transfer';

export function MemberActionsMenu({
  workspaceId,
  member,
  currentOwnerVersion,
  canManageMembers,
  canTransferOwnership,
}: {
  workspaceId: string;
  member: ManagedTeamMember;
  currentOwnerVersion: number | null;
  canManageMembers: boolean;
  canTransferOwnership: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const isOwner = member.role === 'owner';
  const isRemoved = member.membershipState === 'removed';
  const canAct = canManageMembers && !isRemoved;
  const canTransfer =
    canTransferOwnership &&
    currentOwnerVersion !== null &&
    member.membershipState === 'active' &&
    !member.isSelf &&
    !isOwner;

  async function changeRole(roleValue: string) {
    const role = roleValue as TeamRole;
    if (role === member.role || role === 'owner') return;
    setBusy(true);
    try {
      await changeWorkspaceMemberRole({
        workspaceId,
        userId: member.id,
        role,
        expectedVersion: member.version,
      });
      toast.success(`Papel alterado para ${TEAM_ROLE_LABEL[role]}.`);
    } catch (error) {
      toast.error(teamMutationErrorMessage(error));
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  async function confirm() {
    if (!confirmAction) return;
    setBusy(true);
    try {
      if (confirmAction === 'suspend') {
        await suspendWorkspaceMember({
          workspaceId,
          userId: member.id,
          expectedVersion: member.version,
        });
        toast.success('Acesso suspenso.');
      } else if (confirmAction === 'reactivate') {
        await reactivateWorkspaceMember({
          workspaceId,
          userId: member.id,
          expectedVersion: member.version,
        });
        toast.success('Acesso reativado.');
      } else if (confirmAction === 'remove') {
        await removeWorkspaceMember({
          workspaceId,
          userId: member.id,
          expectedVersion: member.version,
        });
        toast.success('Pessoa removida do workspace.');
      } else if (currentOwnerVersion !== null) {
        await transferWorkspaceOwnership({
          workspaceId,
          newOwnerId: member.id,
          expectedOwnerVersion: currentOwnerVersion,
          expectedNewOwnerVersion: member.version,
        });
        toast.success('Propriedade transferida.');
      }
      setConfirmAction(null);
    } catch (error) {
      toast.error(teamMutationErrorMessage(error));
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  if (isOwner || (!canAct && !canTransfer)) return null;

  const dialog = confirmationCopy(confirmAction, member.fullName);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Ações de ${member.fullName}`}
            disabled={busy}
          >
            {busy ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <MoreHorizontal aria-hidden="true" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{member.fullName}</DropdownMenuLabel>
          {!isOwner ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={!canManageMembers || busy}>
                <ShieldCheck aria-hidden="true" />
                Alterar papel
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="w-48">
                  <DropdownMenuRadioGroup
                    value={member.role}
                    onValueChange={changeRole}
                  >
                    {INVITE_ROLE_OPTIONS.map((role) => (
                      <DropdownMenuRadioItem
                        key={role.value}
                        value={role.value}
                      >
                        {role.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          ) : null}

          {canTransfer ? (
            <DropdownMenuItem onSelect={() => setConfirmAction('transfer')}>
              <Crown aria-hidden="true" />
              Transferir propriedade
            </DropdownMenuItem>
          ) : null}

          {!isOwner ? <DropdownMenuSeparator /> : null}

          {member.membershipState === 'active' && !isOwner && !member.isSelf ? (
            <DropdownMenuItem onSelect={() => setConfirmAction('suspend')}>
              <PauseCircle aria-hidden="true" />
              Suspender acesso
            </DropdownMenuItem>
          ) : null}
          {member.membershipState === 'suspended' ? (
            <DropdownMenuItem onSelect={() => setConfirmAction('reactivate')}>
              <PlayCircle aria-hidden="true" />
              Reativar acesso
            </DropdownMenuItem>
          ) : null}
          {!isOwner && !member.isSelf ? (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setConfirmAction('remove')}
            >
              <Trash2 aria-hidden="true" />
              Remover do workspace
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={Boolean(confirmAction)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !busy) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {dialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirm}
              disabled={busy}
              variant={confirmAction === 'remove' ? 'destructive' : 'default'}
            >
              {busy ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {busy ? 'Salvando…' : dialog.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function confirmationCopy(action: ConfirmAction | null, name: string) {
  if (action === 'suspend') {
    return {
      title: `Suspender o acesso de ${name}?`,
      description:
        'A pessoa perde acesso ao workspace imediatamente. Demandas e histórico permanecem preservados.',
      confirmLabel: 'Suspender acesso',
    };
  }
  if (action === 'reactivate') {
    return {
      title: `Reativar o acesso de ${name}?`,
      description: 'A pessoa volta a acessar o workspace com o papel atual.',
      confirmLabel: 'Reativar acesso',
    };
  }
  if (action === 'remove') {
    return {
      title: `Remover ${name} do workspace?`,
      description:
        'O acesso será encerrado. O histórico e as atribuições existentes permanecem registrados.',
      confirmLabel: 'Remover pessoa',
    };
  }
  if (action === 'transfer') {
    return {
      title: `Transferir a propriedade para ${name}?`,
      description:
        'A pessoa passa a controlar o workspace. Seu papel será ajustado pelo sistema.',
      confirmLabel: 'Transferir propriedade',
    };
  }
  return { title: '', description: '', confirmLabel: 'Confirmar' };
}
