'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

import { newPasswordSchema, type NewPasswordInput } from './schemas';

export function NewPasswordForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string>();
  const form = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', passwordConfirmation: '' },
  });

  async function onSubmit(values: NewPasswordInput) {
    setFormError(undefined);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });

    if (error) {
      setFormError('Não foi possível atualizar a senha. Solicite outro link.');
      return;
    }

    await supabase.auth.signOut({ scope: 'global' });
    router.replace('/login?aviso=senha-atualizada');
    router.refresh();
  }

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="new-password">Nova senha</Label>
        <div className="relative">
          <Input
            id="new-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className="pr-11"
            {...form.register('password')}
            aria-invalid={Boolean(form.formState.errors.password)}
            aria-describedby={
              form.formState.errors.password ? 'new-password-error' : undefined
            }
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? 'Ocultar senhas' : 'Mostrar senhas'}
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
          </button>
        </div>
        {form.formState.errors.password ? (
          <p id="new-password-error" className="text-xs text-destructive">
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password-confirmation">Repita a senha</Label>
        <Input
          id="password-confirmation"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          {...form.register('passwordConfirmation')}
          aria-invalid={Boolean(form.formState.errors.passwordConfirmation)}
          aria-describedby={
            form.formState.errors.passwordConfirmation
              ? 'password-confirmation-error'
              : undefined
          }
        />
        {form.formState.errors.passwordConfirmation ? (
          <p
            id="password-confirmation-error"
            className="text-xs text-destructive"
          >
            {form.formState.errors.passwordConfirmation.message}
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
        {form.formState.isSubmitting ? 'Salvando…' : 'Salvar nova senha'}
      </Button>
    </form>
  );
}
