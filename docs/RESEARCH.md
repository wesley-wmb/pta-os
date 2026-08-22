# Pesquisa oficial

Pesquisa realizada em 22 de agosto de 2026. Foram priorizadas fontes primárias.

- [Next.js — App Router](https://nextjs.org/docs/app): layouts, Server Components e convenções atuais.
- [Next.js — Parallel Routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes) e [Intercepting Routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes): base do side peek com URL canônica.
- [Supabase — Auth com Next.js SSR](https://supabase.com/docs/guides/auth/server-side/nextjs): clientes de browser/servidor e renovação de cookies.
- [Supabase — desenvolvimento local](https://supabase.com/docs/guides/local-development): CLI, Docker e migrations reproduzíveis.
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security): autorização no banco por operação.
- [Supabase — Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control): bucket privado e políticas em `storage.objects`.
- [Supabase — Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes): atualização de listas sem banco paralelo.
- [TanStack Query — visão geral](https://tanstack.com/query/latest/docs/framework/react/overview): cache e invalidação de mutações.
- [Playwright — acessibilidade](https://playwright.dev/docs/accessibility-testing) e [WCAG 2.2](https://www.w3.org/TR/WCAG22/): testes automatizados com Axe e critérios de interface.
- [Zod 4](https://zod.dev/): contratos compartilhados de entrada.

## Decisões resultantes

- O peek usa `@peek/(.)tarefa/[taskId]`, `default.tsx` obrigatório e página completa na mesma URL.
- O servidor valida o usuário com Auth; RLS continua sendo a fronteira de autorização.
- Views expostas devem usar `security_invoker`; funções elevadas ficam em schema privado ou validam membership internamente.
- Chaves locais públicas podem ir ao cliente; `service_role` nunca entra em `NEXT_PUBLIC_*`.
