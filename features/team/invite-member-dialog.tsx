'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { createWorkspaceInvitation } from './api';
import { teamMutationErrorMessage } from './errors';
import {
  createInvitationUrl,
  InvitationLinkDialog,
} from './invitation-link-dialog';
import { INVITE_ROLE_OPTIONS } from './labels';
import {
  inviteRoleSchema,
  invitationFormSchema,
  type InvitationFormInput,
} from './schemas';

type GeneratedInvite = { email: string; url: string };

export function InviteMemberDialog({
  workspaceId,
  disabled = false,
}: {
  workspaceId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [generatedInvite, setGeneratedInvite] =
    useState<GeneratedInvite | null>(null);
  const form = useForm<InvitationFormInput>({
    resolver: zodResolver(invitationFormSchema),
    defaultValues: { email: '', role: 'member' },
  });
  const selectedRole = useWatch({ control: form.control, name: 'role' });
  const selectedRoleOption = INVITE_ROLE_OPTIONS.find(
    (option) => option.value === selectedRole,
  );

  async function submit(values: InvitationFormInput) {
    setFormError(undefined);
    const parsed = invitationFormSchema.safeParse(values);
    if (!parsed.success) return;

    try {
      const result = await createWorkspaceInvitation({
        workspaceId,
        email: parsed.data.email,
        role: parsed.data.role,
      });
      setOpen(false);
      setGeneratedInvite({
        email: result.invitation.email,
        url: createInvitationUrl(result.rawToken),
      });
      form.reset();
      router.refresh();
    } catch (error) {
      setFormError(
        teamMutationErrorMessage(
          error,
          'Não foi possível criar o convite. Tente novamente.',
        ),
      );
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setFormError(undefined);
        }}
      >
        <DialogTrigger asChild>
          <Button type="button" disabled={disabled}>
            <UserPlus aria-hidden="true" />
            Convidar pessoa
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={form.handleSubmit(submit)} noValidate>
            <DialogHeader>
              <DialogTitle>Convidar para a equipe</DialogTitle>
              <DialogDescription>
                Defina o acesso e compartilhe o link de uso único com a pessoa.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="invite-email">E-mail de trabalho</Label>
                <Input
                  id="invite-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="nome@empresa.com.br"
                  {...form.register('email')}
                  aria-invalid={Boolean(form.formState.errors.email)}
                  aria-describedby={
                    form.formState.errors.email
                      ? 'invite-email-error'
                      : undefined
                  }
                />
                {form.formState.errors.email ? (
                  <p
                    id="invite-email-error"
                    className="text-xs text-destructive"
                  >
                    {form.formState.errors.email.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-role">Papel</Label>
                <Select
                  value={selectedRole}
                  onValueChange={(value) => {
                    const role = inviteRoleSchema.safeParse(value);
                    if (role.success) {
                      form.setValue('role', role.data, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                  }}
                >
                  <SelectTrigger
                    id="invite-role"
                    className="w-full"
                    aria-describedby="invite-role-description"
                  >
                    <SelectValue>
                      {selectedRoleOption?.label ?? 'Colaborador'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {INVITE_ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex flex-col items-start">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p
                  id="invite-role-description"
                  className="text-xs leading-5 text-muted-foreground"
                >
                  {selectedRoleOption?.description ??
                    'Cria e atualiza demandas autorizadas.'}
                </p>
              </div>

              <p className="border-t pt-4 text-xs leading-5 text-muted-foreground">
                O convite expira em 7 dias. Criar outro link invalida o
                anterior.
              </p>

              {formError ? (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}
            </div>

            <DialogFooter className="mt-5 flex-col sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={form.formState.isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : null}
                {form.formState.isSubmitting
                  ? 'Criando convite…'
                  : 'Criar convite'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {generatedInvite ? (
        <InvitationLinkDialog
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setGeneratedInvite(null);
          }}
          inviteUrl={generatedInvite.url}
          email={generatedInvite.email}
        />
      ) : null}
    </>
  );
}
