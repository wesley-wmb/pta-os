'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

const workspaceSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do workspace.').max(120),
});

type WorkspaceInput = z.infer<typeof workspaceSchema>;

export function WorkspaceBootstrap({ fullName }: { fullName: string }) {
  const router = useRouter();
  const form = useForm<WorkspaceInput>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { name: 'PTA' },
  });

  async function onSubmit(values: WorkspaceInput) {
    const slug = `${slugify(values.name)}-${crypto.randomUUID().slice(0, 6)}`;
    const { error } = await createClient().rpc('bootstrap_user_workspace', {
      p_name: values.name,
      p_slug: slug,
      p_task_prefix: 'PTA',
    });

    if (error) {
      toast.error(
        error.message.includes('PTA_BOOTSTRAP_DISABLED')
          ? 'O workspace precisa ser liberado por um administrador.'
          : 'Não foi possível preparar o workspace.',
      );
      return;
    }

    toast.success('Workspace pronto.');
    router.refresh();
  }

  return (
    <main
      id="conteudo-principal"
      className="grid min-h-dvh place-items-center px-5 py-12"
    >
      <section className="w-full max-w-lg" aria-labelledby="workspace-title">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Primeiro acesso
        </p>
        <h1
          id="workspace-title"
          className="text-balance text-3xl font-semibold tracking-[-0.035em]"
        >
          Vamos preparar seu espaço, {firstName(fullName)}.
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Isso cria o workspace e os status iniciais da sua operação. Você
          poderá ajustar tudo depois.
        </p>
        <form className="mt-8 space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Nome do workspace</Label>
            <Input
              id="workspace-name"
              autoFocus
              {...form.register('name')}
              aria-invalid={Boolean(form.formState.errors.name)}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <Button
            type="submit"
            className="h-10 w-full sm:w-auto"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : null}
            {form.formState.isSubmitting ? 'Preparando…' : 'Preparar workspace'}
          </Button>
        </form>
      </section>
    </main>
  );
}

function slugify(value: string) {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'workspace'
  );
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || 'bem-vindo';
}
