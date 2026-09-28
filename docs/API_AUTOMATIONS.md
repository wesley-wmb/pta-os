# API e automações

## Objetivo

A plataforma substitui a integração Asana → Make → Slack por eventos do próprio
PTA OS. A tarefa continua sendo uma única linha em `tasks`; Quadro, Semana,
Projetos, API e notificações observam essa mesma entidade.

## Componentes

```text
Cliente/API → RPC versionada → tasks/assignees/comments
                              ├─ activity_logs
                              └─ task_automation_events (outbox durável)
                                      └─ automation_deliveries
                                            ├─ Slack DM
                                            └─ e-mail
```

- A Edge Function `pta-api` é o gateway HTTP v1.
- Chaves pertencem ao workspace e guardam somente SHA-256 no banco.
- O token bruto é mostrado uma vez ao administrador.
- O `workspace_id`, o ator e os escopos vêm da chave; o corpo da requisição não
  escolhe nenhum deles.
- Mutações externas reutilizam as RPCs de tarefas e continuam exigindo
  `expected_version`.
- O outbox e as entregas não têm grants para navegador.

## Política antispam

| Evento                                         | Destinatário                                | Regra                                                         |
| ---------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| Nova atribuição ou reatribuição                | Novo responsável                            | Suprime quando ele é o ator                                   |
| Responsável comenta ou altera campo importante | Criador da tarefa; fallback para atribuidor | Suprime o ator                                                |
| Terceiro comenta ou altera campo importante    | Responsável atual                           | Suprime o ator                                                |
| Conclusão                                      | Regra acima                                 | Um evento `task.completed`; efeitos derivados não criam aviso |
| Reordenação e sincronização entre visões       | Ninguém                                     | Campos técnicos não entram na allowlist                       |

Campos importantes: responsável, etapa, conclusão/reabertura, prazo, prioridade,
título, descrição, projeto e novo comentário. Campos técnicos como `version`,
`updated_at`, `due_at`, `completed_at`, posições do quadro/semana e vetor de busca
não geram aviso.

A chave de origem é única por mutação canônica. A janela padrão de 60 segundos
usa `collapse_key = workspace:tarefa:destinatário`. Slack pode atualizar a
mensagem do próprio bot; e-mail deve esperar o fechamento da janela para enviar
um único resumo.

## Mensagem padrão

```text
PTA OS | {ação}

Tarefa: {título}
Projeto: {projeto ou "Sem projeto"}
Etapa: {etapa}
Prazo: {dd/mm/aaaa ou "Sem prazo"}

Abrir tarefa: {URL}
```

Comentários não são copiados para Slack ou e-mail. O aviso informa que existe um
novo comentário e direciona a pessoa ao PTA OS.

## API v1

URL base:

```text
https://<project-ref>.supabase.co/functions/v1/pta-api/v1
```

Autenticação:

```http
Authorization: Bearer pta_live_...
```

Endpoints iniciais:

- `GET /tasks`
- `GET /tasks/{id}`
- `POST /tasks`
- `PATCH /tasks/{id}`
- `PUT /tasks/{id}/assignee`
- `POST /tasks/{id}/comments`

Datas sem horário permanecem `YYYY-MM-DD`. Conflitos de versão retornam HTTP 409. A listagem usa cursor opaco e limite máximo de 100.

## Publicação e segredos

1. Aplicar `20260927130000_api_automation_foundation.sql` no projeto hospedado.
2. Regenerar `lib/database.types.ts` a partir do schema publicado.
3. Publicar `pta-api` com validação JWT desabilitada; ela valida a chave PTA.
4. Definir `PTA_API_ALLOWED_ORIGINS` somente se houver consumo em navegador.
5. Instalar o app Slack com `chat:write`, `im:write` e `users:read.email`.
6. Guardar tokens por instalação no Vault. Nenhum token usa `NEXT_PUBLIC_*`.
7. Criar uma conta/transporte Resend, verificar o domínio remetente e salvar a
   chave no Vault. O SMTP padrão do Supabase Auth não serve para notificações de
   tarefas em produção.
8. Publicar o dispatcher. A migration cria o job de recuperação a cada minuto;
   ele fica inerte até encontrar os dois segredos operacionais no Vault.
9. Fazer teste ponta a ponta primeiro com Wesley, sem enviar para os demais.

Variáveis das Edge Functions:

```text
PTA_API_ALLOWED_ORIGINS=https://app.ptadigital.com.br
PTA_APP_BASE_URL=https://app.ptadigital.com.br
PTA_DISPATCH_SECRET=<segredo longo e aleatório>
```

O valor de `PTA_DISPATCH_SECRET` também deve ser gravado no Vault com o nome
`pta_dispatch_secret`. A URL completa da função deve ser gravada como
`pta_automation_dispatcher_url`:

```sql
select vault.create_secret(
  'https://<project-ref>.supabase.co/functions/v1/automation-dispatcher',
  'pta_automation_dispatcher_url'
);
select vault.create_secret('<mesmo PTA_DISPATCH_SECRET>', 'pta_dispatch_secret');
```

O job `pta-automation-dispatcher-every-minute` apenas acorda a função. A fonte
durável continua sendo `automation_deliveries`; uma falha do `pg_net` não perde
o evento, que será tentado novamente na próxima execução.

## Teste ponta a ponta

1. Admin cria e atribui uma tarefa a Wesley: Wesley recebe um aviso.
2. Wesley altera etapa/prazo: o criador recebe um aviso.
3. Wesley comenta: o criador recebe um aviso sem o corpo do comentário.
4. Terceiro altera a tarefa: Wesley recebe um aviso.
5. O ator não recebe cópia de nenhuma ação própria.
6. Concluir gera um único aviso mesmo que a coluna mude automaticamente.
7. Três alterações em menos de 60 segundos resultam numa mensagem revisada ou
   num único resumo.
8. Chave revogada, expirada ou de membro suspenso recebe 401 imediatamente.
9. Atualização com `expected_version` antiga recebe 409 e não grava nada.

Depois do teste com Wesley, repetir em uma matriz com um usuário de cada papel e
um membro sem identidade Slack para validar falha explícita sem fallback para
canal coletivo.

## Webhooks externos

O catálogo e a tabela de endpoints foram reservados para a próxima etapa, mas o
cadastro e a entrega HMAC ainda estão desativados. A interface não permite
habilitar o canal até existir dispatcher, histórico de tentativas e teste de
assinatura ponta a ponta. Isso evita acumular entregas sem consumidor.
