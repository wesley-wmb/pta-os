import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getPublicSupabaseConfig } from '@/lib/supabase/config';

export const metadata: Metadata = { title: 'Documentação da API' };

export default function ApiDocumentationPage() {
  const config = getPublicSupabaseConfig();
  const baseUrl = config
    ? `${config.url}/functions/v1/pta-api/v1`
    : 'https://SEU-PROJETO.supabase.co/functions/v1/pta-api/v1';

  return (
    <article className="mx-auto w-full max-w-[920px] px-4 pb-24 pt-6 sm:px-6 sm:pt-8 lg:px-10">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-6">
        <Link href="/configuracoes/api">
          <ChevronLeft aria-hidden="true" />
          API e integrações
        </Link>
      </Button>

      <header className="mb-12 max-w-3xl">
        <p className="pta-eyebrow mb-2">PTA OS · API v1</p>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          Documentação da API
        </h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          Use a mesma entidade de tarefa vista no Quadro, na Semana e nos
          Projetos. Toda credencial pertence a um único workspace.
        </p>
      </header>

      <div className="space-y-12 text-sm leading-7">
        <DocSection title="Começar">
          <p>
            Crie uma chave em Configurações → API e integrações. Envie o valor
            no cabeçalho{' '}
            <InlineCode>Authorization: Bearer SUA_CHAVE</InlineCode>. A chave
            bruta aparece apenas uma vez.
          </p>
          <Code>{`curl '${baseUrl}/tasks?limit=25' \\
  -H 'Authorization: Bearer pta_live_...'`}</Code>
        </DocSection>

        <DocSection title="Isolamento e escopos">
          <p>
            A API deriva o <InlineCode>workspace_id</InlineCode> e o ator da
            credencial. Valores enviados pelo cliente nunca substituem esse
            contexto. Os escopos iniciais são{' '}
            <InlineCode>tasks:read</InlineCode>,{' '}
            <InlineCode>tasks:write</InlineCode>,{' '}
            <InlineCode>projects:read</InlineCode>,{' '}
            <InlineCode>resources:read</InlineCode> e{' '}
            <InlineCode>webhooks:manage</InlineCode>.
          </p>
        </DocSection>

        <DocSection title="Endpoints de tarefas">
          <Endpoint
            method="GET"
            path="/tasks"
            text="Lista por cursor; limit entre 1 e 100."
          />
          <Endpoint
            method="GET"
            path="/tasks/{id}"
            text="Retorna a tarefa visível no workspace."
          />
          <Endpoint
            method="POST"
            path="/tasks"
            text="Cria uma tarefa e pode atribuí-la a um membro."
          />
          <Endpoint
            method="PATCH"
            path="/tasks/{id}"
            text="Atualiza campos com expected_version."
          />
          <Endpoint
            method="PUT"
            path="/tasks/{id}/assignee"
            text="Troca o responsável com expected_version."
          />
          <Endpoint
            method="POST"
            path="/tasks/{id}/comments"
            text="Adiciona um comentário."
          />
        </DocSection>

        <DocSection title="Criar uma tarefa">
          <Code>{`curl -X POST '${baseUrl}/tasks' \\
  -H 'Authorization: Bearer pta_live_...' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "title": "Revisar página do Summit",
    "priority": "high",
    "due_date": "2026-10-02",
    "project_id": "UUID_DO_PROJETO",
    "primary_assignee_id": "UUID_DO_RESPONSAVEL"
  }'`}</Code>
        </DocSection>

        <DocSection title="Alterar com segurança">
          <p>
            Toda mutação existente usa concorrência otimista. Leia a versão da
            tarefa, envie <InlineCode>expected_version</InlineCode> e trate{' '}
            <InlineCode>409 version_conflict</InlineCode> lendo a versão atual
            antes de repetir.
          </p>
          <Code>{`curl -X PATCH '${baseUrl}/tasks/UUID_DA_TAREFA' \\
  -H 'Authorization: Bearer pta_live_...' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "expected_version": 7,
    "patch": { "priority": "urgent", "due_date": "2026-10-01" }
  }'`}</Code>
        </DocSection>

        <DocSection title="Datas">
          <p>
            Datas sem horário usam <InlineCode>YYYY-MM-DD</InlineCode> e
            permanecem datas puras. Não converta uma data de prazo para
            meia-noite UTC. Quando necessário, envie{' '}
            <InlineCode>due_time</InlineCode> separadamente como{' '}
            <InlineCode>HH:mm:ss</InlineCode>.
          </p>
        </DocSection>

        <DocSection title="Erros">
          <p>
            Todas as falhas usam o formato abaixo e devolvem{' '}
            <InlineCode>X-Request-Id</InlineCode>. Códigos HTTP: 400/422 para
            entrada inválida, 401 para chave inválida, 403 para escopo ou papel,
            404 para registro ausente e 409 para conflito de versão.
          </p>
          <Code>{`{
  "error": {
    "code": "version_conflict",
    "message": "A tarefa foi alterada. Leia a versão atual e tente novamente.",
    "request_id": "..."
  }
}`}</Code>
        </DocSection>

        <DocSection title="Eventos e webhooks">
          <p>
            O catálogo inicial inclui <InlineCode>task.assigned</InlineCode>,{' '}
            <InlineCode>task.updated</InlineCode>,{' '}
            <InlineCode>task.status_changed</InlineCode>,{' '}
            <InlineCode>task.completed</InlineCode>,{' '}
            <InlineCode>task.reopened</InlineCode>,{' '}
            <InlineCode>task.comment_added</InlineCode> e{' '}
            <InlineCode>task.archived</InlineCode>. O catálogo já alimenta a
            fila interna usada por Slack e e-mail. O cadastro de endpoints
            externos e a assinatura HMAC ainda estão planejados e permanecem
            desativados nesta versão.
          </p>
        </DocSection>

        <DocSection title="Automação Slack e e-mail">
          <p>
            Atribuição avisa o novo responsável. Quando o responsável comenta ou
            altera um campo importante, o aviso vai ao criador; alterações por
            terceiros vão ao responsável atual. O ator nunca recebe o próprio
            aviso. Conclusão e mudança automática de etapa formam um único
            evento, e mudanças próximas são agrupadas na janela configurada.
          </p>
        </DocSection>
      </div>
    </article>
  );
}

function DocSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t pt-7">
      <h2 className="mb-3 text-xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-4 text-muted-foreground">{children}</div>
    </section>
  );
}

function Endpoint({
  method,
  path,
  text,
}: {
  method: string;
  path: string;
  text: string;
}) {
  return (
    <div className="grid gap-1 border-b py-3 sm:grid-cols-[72px_220px_1fr] sm:gap-3">
      <strong className="text-foreground">{method}</strong>
      <code className="text-foreground">{path}</code>
      <span>{text}</span>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 text-[0.9em] text-foreground">
      {children}
    </code>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border bg-muted/45 p-4 text-xs leading-6 text-foreground">
      <code>{children}</code>
    </pre>
  );
}
