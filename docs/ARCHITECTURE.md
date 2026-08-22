# Arquitetura

## Fronteiras

```text
Browser → Next.js App Router → Supabase Data API/Auth
                          ↘ Postgres RPC + RLS
                          ↘ Storage privado
                          ↘ Realtime
```

- Server Components carregam identidade e contexto inicial.
- TanStack Query mantém dados operacionais no cliente e invalida após RPCs.
- Formulários usam React Hook Form + Zod.
- Nenhuma regra de autorização depende apenas de componentes ocultos; o banco decide.

## Rotas

- `/login`: entrar ou criar conta local.
- `/inicio`: foco do dia e atalhos.
- `/demandas`: Central de Demandas.
- `/semana`: visão semanal da mesma coleção de tarefas.
- `/tarefa/[taskId]`: detalhe completo e URL canônica.
- `@peek/(.)tarefa/[taskId]`: interceptação do detalhe dentro do shell.

## Estado e consistência

- `workspace_id` é resolvido da membership ativa do usuário.
- No onboarding local, cada usuário autenticado sem qualquer membership pode criar um workspace próprio uma única vez; convites e múltiplos workspaces entram em uma evolução posterior.
- RPCs criam/alteram tarefas em transação e geram atividade.
- `tasks.version` evita perda silenciosa em edições concorrentes.
- Realtime apenas sinaliza invalidação; a fonte da verdade continua Postgres.
- `due_date` e `due_time` são campos separados para preservar semântica de data pura.

## Decisões adiadas

Integrações externas, credenciais/Vault, automações com pg_cron e analytics avançado ficam atrás de decisões futuras.
