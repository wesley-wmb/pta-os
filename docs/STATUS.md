# Status

Atualizado em 22 de agosto de 2026.

## Concluído

- Requisitos e pesquisa oficial consolidados.
- Scaffold Next.js estável, design foundation e dependências fixadas.
- Supabase CLI inicializado para desenvolvimento local.
- Migration P0 com tenancy, RLS forçada, RPCs, notificações e Realtime.
- Autenticação local, bootstrap protegido, shell e fluxo vertical de demandas.
- Início, Central, Semana de sete dias, criação, detalhe e side peek responsivo.
- Permissões refletidas na UI, concorrência otimista e validação Zod dos DTOs.
- Migration `20260822000100_p0_core.sql` aplicada ao Supabase hospedado sem seed.
- Verificação remota aprovada: histórico, 14 tabelas com `FORCE RLS`, bootstrap desligado, trigger Auth, Realtime e view com `security_invoker`.
- App local conectado ao hospedado somente com URL e chave publicável; tipos TypeScript regenerados do schema remoto.
- Primeiro usuário hospedado confirmado e workspace inicial provisionado atomicamente: 1 proprietário ativo, preferências, 6 status e 3 tipos de demanda. O self-bootstrap foi desligado novamente no mesmo procedimento.
- Lint, TypeScript, 15 testes unitários, build e 4 testes E2E aprovados.

## Pronto para validar quando o Docker estiver disponível

- `pnpm db:start`, `pnpm db:reset` e `pnpm db:test`.
- Gerar novamente `lib/database.types.ts` a partir do banco local.
- Executar os fluxos autenticados e a matriz comportamental de RLS.

## Bloqueio local

Docker não está disponível no host. A pilha Supabase local e os testes comportamentais de RLS com fixtures só poderão rodar após instalar/iniciar Docker Desktop. A verificação estrutural do banco hospedado passou, mas não substitui essa matriz comportamental.

## Não iniciado

- Publicação do app.
- Integrações externas e módulo de credenciais.
- Convites e onboarding dos próximos usuários em produção.
- Rotação/revogação das credenciais privilegiadas que foram compartilhadas na conversa.
