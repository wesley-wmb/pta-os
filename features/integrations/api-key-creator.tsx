'use client';

import { Check, Copy, KeyRound } from 'lucide-react';
import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createApiKeyAction, type ApiKeyActionState } from './actions';
import { apiScopes } from './types';

const initialState: ApiKeyActionState = { status: 'idle' };

const scopeLabels: Record<(typeof apiScopes)[number], string> = {
  'tasks:read': 'Ler tarefas',
  'tasks:write': 'Criar e alterar tarefas',
  'projects:read': 'Ler projetos',
  'resources:read': 'Ler recursos',
  'webhooks:manage': 'Gerenciar webhooks',
};

export function ApiKeyCreator({ disabled = false }: { disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(
    createApiKeyAction,
    initialState,
  );
  const [copied, setCopied] = useState(false);

  async function copyToken() {
    if (!state.token) return;
    await navigator.clipboard.writeText(state.token);
    setCopied(true);
  }

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="api-key-name">Nome da chave</Label>
            <Input
              id="api-key-name"
              name="name"
              placeholder="Integração operacional"
              minLength={3}
              maxLength={80}
              required
              disabled={disabled || pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-key-expiry">Validade</Label>
            <Input
              id="api-key-expiry"
              name="expiresAt"
              type="date"
              disabled={disabled || pending}
            />
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">Escopos</legend>
          <p className="mt-1 text-xs text-muted-foreground">
            Conceda somente os acessos necessários.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {apiScopes.map((scope) => (
              <label
                key={scope}
                className="flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm"
              >
                <input
                  type="checkbox"
                  name="scopes"
                  value={scope}
                  defaultChecked={scope === 'tasks:read'}
                  disabled={disabled || pending}
                  className="size-4 accent-[var(--primary)]"
                />
                {scopeLabels[scope]}
              </label>
            ))}
          </div>
        </fieldset>

        <Button type="submit" disabled={disabled || pending}>
          <KeyRound aria-hidden="true" />
          {pending ? 'Criando…' : 'Criar chave'}
        </Button>
      </form>

      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}

      {state.status === 'success' && state.token ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/[0.07] p-4">
          <p className="text-sm font-semibold">Copie agora</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta chave não será exibida novamente.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-background px-3 py-2 text-xs">
              {state.token}
            </code>
            <Button type="button" variant="outline" onClick={copyToken}>
              {copied ? (
                <Check aria-hidden="true" />
              ) : (
                <Copy aria-hidden="true" />
              )}
              {copied ? 'Copiada' : 'Copiar'}
            </Button>
          </div>
          <span className="sr-only" role="status" aria-live="polite">
            {copied ? 'Chave copiada.' : ''}
          </span>
        </div>
      ) : null}
    </div>
  );
}
