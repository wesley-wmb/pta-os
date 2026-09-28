import {
  BookOpenText,
  Braces,
  ExternalLink,
  Mail,
  MessageSquareText,
  ShieldCheck,
  Webhook,
} from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

import {
  configureIntegrationAction,
  revokeApiKeyAction,
  updateAutomationSettingsAction,
} from './actions';
import { ApiKeyCreator } from './api-key-creator';
import type { ApiPlatformState } from './types';

export function ApiSettingsView({
  workspaceName,
  state,
}: {
  workspaceName: string;
  state: ApiPlatformState;
}) {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[220px_minmax(0,760px)] lg:gap-12">
      <nav
        aria-label="Conteúdo da página"
        className="flex gap-2 overflow-x-auto pb-2 lg:sticky lg:top-6 lg:block lg:space-y-1"
      >
        {[
          ['visao-geral', 'Visão geral'],
          ['chaves', 'Chaves de API'],
          ['automacoes', 'Automações'],
          ['webhooks', 'Webhooks'],
          ['documentacao', 'Documentação'],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="block min-h-11 shrink-0 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="min-w-0 space-y-12">
        <section id="visao-geral" className="scroll-mt-8 border-b pb-10">
          <SectionHeading
            icon={Braces}
            title="Plataforma de integração"
            description={`A API pertence a ${workspaceName}. O workspace e o ator são derivados da chave; integrações nunca escolhem outro workspace no corpo da requisição.`}
          />
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <Fact label="Autenticação" value="Bearer token" />
            <Fact label="Versão" value="v1" />
            <Fact label="Concorrência" value="expected_version" />
          </div>
          {!state.available ? (
            <p className="mt-5 rounded-xl border border-amber-500/35 bg-amber-500/[0.07] px-4 py-3 text-sm leading-6">
              A interface está pronta, mas a migration da plataforma ainda não
              foi publicada neste ambiente. As ações ficam bloqueadas até a
              publicação.
            </p>
          ) : null}
        </section>

        <section id="chaves" className="scroll-mt-8 border-b pb-10">
          <SectionHeading
            icon={ShieldCheck}
            title="Chaves de API"
            description="O valor completo aparece uma vez. O banco guarda somente o hash SHA-256 e o prefixo para identificação."
          />
          <div className="mt-6">
            <ApiKeyCreator disabled={!state.available} />
          </div>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-3 font-medium">Nome</th>
                  <th className="px-2 py-3 font-medium">Prefixo</th>
                  <th className="px-2 py-3 font-medium">Escopos</th>
                  <th className="px-2 py-3 font-medium">Último uso</th>
                  <th className="px-2 py-3 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {state.keys.map((key) => (
                  <tr
                    key={key.id}
                    className={key.revokedAt ? 'opacity-55' : undefined}
                  >
                    <td className="px-2 py-3 font-medium">{key.name}</td>
                    <td className="px-2 py-3 font-mono text-xs">
                      {key.prefix}
                    </td>
                    <td className="px-2 py-3 text-xs text-muted-foreground">
                      {key.scopes.join(', ')}
                    </td>
                    <td className="px-2 py-3 text-muted-foreground">
                      {key.lastUsedAt
                        ? formatDateTime(key.lastUsedAt)
                        : 'Nunca'}
                    </td>
                    <td className="px-2 py-3 text-right">
                      {key.revokedAt ? (
                        <span className="text-xs">Revogada</span>
                      ) : (
                        <form action={revokeApiKeyAction}>
                          <input type="hidden" name="keyId" value={key.id} />
                          <input
                            type="hidden"
                            name="version"
                            value={key.version}
                          />
                          <Button type="submit" size="sm" variant="ghost">
                            Revogar
                          </Button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {state.keys.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-2 py-8 text-center text-muted-foreground"
                    >
                      Nenhuma chave criada neste workspace.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section id="automacoes" className="scroll-mt-8 border-b pb-10">
          <SectionHeading
            icon={MessageSquareText}
            title="Política de notificações"
            description="Uma alteração gera um evento canônico. O responsável, o criador e o ator determinam o destinatário sem avisos para a própria pessoa."
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <IntegrationForm
              provider="slack"
              title="Bot Cláudio no Slack"
              credentialLabel="Bot User OAuth Token"
              credentialPlaceholder="xoxb-…"
              configName="teamName"
              configLabel="Workspace Slack"
              configPlaceholder="PTA Digital"
              version={
                state.integrations.find(
                  (integration) => integration.provider === 'slack',
                )?.version ?? 0
              }
              active={state.integrations.some(
                (integration) =>
                  integration.provider === 'slack' &&
                  integration.status === 'active',
              )}
              disabled={!state.available}
            />
            <IntegrationForm
              provider="resend"
              title="E-mail operacional"
              credentialLabel="Chave da API Resend"
              credentialPlaceholder="re_…"
              configName="fromAddress"
              configLabel="Remetente verificado"
              configPlaceholder="Cláudio <notificacoes@ptadigital.com.br>"
              version={
                state.integrations.find(
                  (integration) => integration.provider === 'resend',
                )?.version ?? 0
              }
              active={state.integrations.some(
                (integration) =>
                  integration.provider === 'resend' &&
                  integration.status === 'active',
              )}
              disabled={!state.available}
            />
          </div>
          <form
            action={updateAutomationSettingsAction}
            className="mt-6 space-y-6"
          >
            <input
              type="hidden"
              name="version"
              value={state.settings.version}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <ChannelToggle
                name="slackEnabled"
                icon={MessageSquareText}
                label="Slack"
                checked={state.settings.slackEnabled}
                disabled={!state.available}
              />
              <ChannelToggle
                name="emailEnabled"
                icon={Mail}
                label="E-mail"
                checked={state.settings.emailEnabled}
                disabled={!state.available}
              />
              <ChannelToggle
                name="webhookEnabled"
                icon={Webhook}
                label="Webhooks (em breve)"
                checked={false}
                disabled
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                Domínio corporativo permitido
                <input
                  name="corporateEmailDomain"
                  defaultValue={state.settings.corporateEmailDomain ?? ''}
                  placeholder="ptadigital.com.br"
                  disabled={!state.available}
                  className="mt-2 flex h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Janela de agrupamento
                <select
                  name="collapseWindowSeconds"
                  defaultValue={state.settings.collapseWindowSeconds}
                  disabled={!state.available}
                  className="mt-2 flex h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <option value="0">Sem agrupamento</option>
                  <option value="30">30 segundos</option>
                  <option value="60">60 segundos</option>
                  <option value="120">2 minutos</option>
                </select>
              </label>
            </div>

            <fieldset>
              <legend className="text-sm font-medium">
                Eventos importantes
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <EventToggle
                  name="notifyOnAssignment"
                  label="Atribuição e reatribuição"
                  checked={state.settings.notifyOnAssignment}
                />
                <EventToggle
                  name="notifyOnStatusChange"
                  label="Etapa, conclusão e reabertura"
                  checked={state.settings.notifyOnStatusChange}
                />
                <EventToggle
                  name="notifyOnDueChange"
                  label="Alteração de prazo"
                  checked={state.settings.notifyOnDueChange}
                />
                <EventToggle
                  name="notifyOnPriorityChange"
                  label="Alteração de prioridade"
                  checked={state.settings.notifyOnPriorityChange}
                />
                <EventToggle
                  name="notifyOnContentChange"
                  label="Título, descrição e projeto"
                  checked={state.settings.notifyOnContentChange}
                />
                <EventToggle
                  name="notifyOnComment"
                  label="Novo comentário"
                  checked={state.settings.notifyOnComment}
                />
              </div>
            </fieldset>

            <Button type="submit" disabled={!state.available}>
              Salvar política
            </Button>
          </form>
        </section>

        <section id="webhooks" className="scroll-mt-8 border-b pb-10">
          <SectionHeading
            icon={Webhook}
            title="Webhooks"
            description="Próxima etapa da plataforma para integrações que precisam receber eventos assinados."
          />
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            O modelo e a fila durável já fazem parte da fundação. O cadastro de
            destinos e a entrega assinada ainda não estão habilitados; esta
            opção permanece visível para documentar a próxima etapa sem criar
            entregas que não possam ser processadas.
          </p>
        </section>

        <section id="documentacao" className="scroll-mt-8">
          <SectionHeading
            icon={BookOpenText}
            title="Documentação"
            description="Consulte autenticação, endpoints, erros, datas, concorrência e eventos."
          />
          <Button asChild variant="outline" className="mt-5">
            <Link href="/configuracoes/api/documentacao">
              Abrir documentação
              <ExternalLink aria-hidden="true" />
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Braces;
  title: string;
  description: string;
}) {
  return (
    <header>
      <div className="flex items-center gap-2 text-primary">
        <Icon className="size-5" aria-hidden="true" />
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </header>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-primary/35 pl-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function ChannelToggle({
  name,
  icon: Icon,
  label,
  checked,
  disabled,
}: {
  name: string;
  icon: typeof Braces;
  label: string;
  checked: boolean;
  disabled: boolean;
}) {
  return (
    <label className="flex min-h-12 items-center gap-3 rounded-lg border px-3 text-sm font-medium">
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        disabled={disabled}
        className="size-4 accent-[var(--primary)]"
      />
    </label>
  );
}

function EventToggle({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="size-4 accent-[var(--primary)]"
      />
      {label}
    </label>
  );
}

function IntegrationForm({
  provider,
  title,
  credentialLabel,
  credentialPlaceholder,
  configName,
  configLabel,
  configPlaceholder,
  version,
  active,
  disabled,
}: {
  provider: 'slack' | 'resend';
  title: string;
  credentialLabel: string;
  credentialPlaceholder: string;
  configName: 'teamName' | 'fromAddress';
  configLabel: string;
  configPlaceholder: string;
  version: number;
  active: boolean;
  disabled: boolean;
}) {
  return (
    <form
      action={configureIntegrationAction}
      className="space-y-3 rounded-xl border p-4"
    >
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="version" value={version} />
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span
          className={
            active
              ? 'text-xs font-medium text-emerald-600 dark:text-emerald-400'
              : 'text-xs text-muted-foreground'
          }
        >
          {active ? 'Configurado' : 'Não configurado'}
        </span>
      </div>
      <label className="block text-xs font-medium">
        {credentialLabel}
        <input
          name="credential"
          type="password"
          autoComplete="off"
          required
          minLength={20}
          placeholder={credentialPlaceholder}
          disabled={disabled}
          className="mt-1.5 flex h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      </label>
      <label className="block text-xs font-medium">
        {configLabel}
        <input
          name={configName}
          required
          placeholder={configPlaceholder}
          disabled={disabled}
          className="mt-1.5 flex h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={disabled}>
        {active ? 'Rotacionar credencial' : 'Conectar'}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        O segredo segue direto ao Vault e não volta para o navegador.
      </p>
    </form>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
