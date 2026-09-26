'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

import { passwordRecoverySchema, type PasswordRecoveryInput } from './schemas';

const successMessage =
  'Se houver uma conta para este endereço, enviaremos um link para criar outra senha.';

export function PasswordRecoveryForm({
  invalidLink = false,
}: {
  invalidLink?: boolean;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string>();
  const form = useForm<PasswordRecoveryInput>({
    resolver: zodResolver(passwordRecoverySchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: PasswordRecoveryInput) {
    setFormError(undefined);

    const callbackUrl = new URL('/auth/confirm', window.location.origin);
    callbackUrl.searchParams.set('next', '/nova-senha');

    const { error } = await createClient().auth.resetPasswordForEmail(
      values.email,
      { redirectTo: callbackUrl.toString() },
    );

    if (error) {
      setFormError('Não foi possível enviar o e-mail agora. Tente novamente.');
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="space-y-5">
        <Alert>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="h-10 w-full">
          <Link href="/login">Voltar para entrar</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      {invalidLink ? (
        <Alert variant="destructive">
          <AlertDescription>
            Este link expirou ou já foi usado. Solicite outro.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="recovery-email">E-mail</Label>
        <Input
          id="recovery-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="nome@empresa.com.br"
          {...form.register('email')}
          aria-invalid={Boolean(form.formState.errors.email)}
          aria-describedby={
            form.formState.errors.email ? 'recovery-email-error' : undefined
          }
        />
        {form.formState.errors.email ? (
          <p id="recovery-email-error" className="text-xs text-destructive">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>

      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="submit"
        className="h-10 w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : null}
        {form.formState.isSubmitting ? 'Enviando…' : 'Enviar link'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Lembrou a senha?{' '}
        <Link
          href="/login"
          className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
        >
          Entrar
        </Link>
      </p>
    </form>
  );
}
