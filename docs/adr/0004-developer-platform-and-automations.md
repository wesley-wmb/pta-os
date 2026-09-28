# ADR 0004 — Plataforma de API e automações

**Status:** aceita em 27/09/2026

## Contexto

O fluxo anterior dependia do Asana e do Make. Ele duplicava eventos de mudança,
misturava eventos do usuário com efeitos automáticos e podia enviar três
mensagens para uma única conclusão. O PTA OS já concentra tarefas, responsáveis,
projetos, comentários e versões no Postgres.

## Decisão

- Supabase continua sendo o único backend.
- A API pública roda em Supabase Edge Functions.
- Estado, autorização, RLS, chaves, outbox, tentativas e auditoria ficam no
  Postgres.
- Tokens por workspace ficam no Vault quando precisam ser recuperados; chaves
  da API PTA são irrecuperáveis e persistem somente como hash.
- Slack Web API e Resend são transportes externos. Não recebem regras de domínio.
- Eventos externos derivam de triggers canônicos nas tabelas de domínio, dentro
  da mesma transação. `activity_logs` permanece auditoria e não é usado como
  fila.
- Toda mutação de tarefa via API continua em RPC e exige `version` quando altera
  um registro existente.
- O dispatcher usa entregas idempotentes, retry e dead letter. Database Webhook
  pode acordá-lo e Supabase Cron recupera pendências.

## Consequências

As automações deixam de depender da interface ou do nome editável de uma coluna.
Segredos nunca chegam ao navegador. A entrega externa é observável e repetível,
mas exatamente uma vez não pode ser garantido por todos os provedores; recibos,
hash de conteúdo e chaves idempotentes reduzem duplicatas.

O Resend foi escolhido como transporte operacional porque há integração oficial
com Supabase Edge Functions e suporte a chave idempotente. A conta, o domínio e
a credencial ainda precisam ser configurados antes da publicação do canal. O
SMTP padrão do Supabase Auth permanece exclusivo de autenticação.
