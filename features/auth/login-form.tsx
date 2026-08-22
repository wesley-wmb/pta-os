'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

import { authFormSchema, signUpSchema, type AuthFormInput } from './schemas';

type AuthMode = 'sign-in' | 'sign-up';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [formNotice, setFormNotice] = useState<string>();
  const form = useForm<AuthFormInput>({
    resolver: zodResolver(authFormSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  });

  async function onSubmit(values: AuthFormInput) {
    setFormError(undefined);
    setFormNotice(undefined);
    const supabase = createClient();

    if (mode === 'sign-up') {
      const parsed = signUpSchema.safeParse(values);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        form.setError('fullName', { message: issue.message });
        return;
      }
      const result = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: { data: { full_name: parsed.data.fullName, locale: 'pt-BR' } },
      });

      if (result.error) {
        setFormError(
          'Não foi possível concluir o cadastro. Revise os dados e tente novamente.',
        );
        return;
      }

      if (!result.data.session) {
        setFormNotice(
          'Se o cadastro foi concluído, confirme o acesso pelo e-mail recebido.',
        );
        return;
      }
    } else {
      const result = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (result.error) {
        setFormError('E-mail ou senha incorretos.');
        return;
      }
    }

    router.replace(safeReturnTo(searchParams.get('retorno')));
    router.refresh();
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setFormError(undefined);
    setFormNotice(undefined);
    form.clearErrors();
  }

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      {mode === 'sign-up' ? (
        <div className="space-y-2">
          <Label htmlFor="fullName">Nome</Label>
          <Input
            id="fullName"
            autoComplete="name"
            {...form.register('fullName')}
            aria-invalid={Boolean(form.formState.errors.fullName)}
          />
          {form.formState.errors.fullName ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.fullName.message}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="nome@empresa.com.br"
          {...form.register('email')}
          aria-invalid={Boolean(form.formState.errors.email)}
        />
        {form.formState.errors.email ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={
              mode === 'sign-in' ? 'current-password' : 'new-password'
            }
            className="pr-11"
            {...form.register('password')}
            aria-invalid={Boolean(form.formState.errors.password)}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
          </button>
        </div>
        {form.formState.errors.password ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>

      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      {formNotice ? (
        <Alert>
          <AlertDescription>{formNotice}</AlertDescription>
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
        {form.formState.isSubmitting
          ? mode === 'sign-in'
            ? 'Entrando…'
            : 'Criando conta…'
          : mode === 'sign-in'
            ? 'Entrar'
            : 'Criar conta'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {mode === 'sign-in' ? 'Primeiro acesso?' : 'Já possui uma conta?'}{' '}
        <button
          type="button"
          className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          onClick={() => changeMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
        >
          {mode === 'sign-in' ? 'Criar conta' : 'Entrar'}
        </button>
      </p>
    </form>
  );
}

function safeReturnTo(value: string | null) {
  if (!value || value.startsWith('//') || value.includes('\\'))
    return '/inicio';

  try {
    const origin = window.location.origin;
    const target = new URL(value, origin);
    const allowed =
      target.origin === origin &&
      (['/inicio', '/semana', '/demandas'].includes(target.pathname) ||
        /^\/tarefa\/[0-9a-f-]+$/i.test(target.pathname));
    return allowed ? `${target.pathname}${target.search}` : '/inicio';
  } catch {
    return '/inicio';
  }
}
