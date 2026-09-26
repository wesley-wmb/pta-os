# Pesquisa oficial

Pesquisa realizada em 22 de agosto de 2026. Foram priorizadas fontes primárias.

- [Next.js: App Router](https://nextjs.org/docs/app): layouts, Server Components e convenções atuais.
- [Next.js: Parallel Routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes) e [Intercepting Routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes): base do side peek com URL canônica.
- [Supabase: Auth com Next.js SSR](https://supabase.com/docs/guides/auth/server-side/nextjs): clientes de browser e servidor, além de renovação de cookies.
- [Supabase: desenvolvimento local](https://supabase.com/docs/guides/local-development): referência opcional para CLI, Docker, fixtures e migrations reproduzíveis. O fluxo atual usa o Supabase hospedado sem exigir essas ferramentas.
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security): autorização no banco por operação.
- [Supabase: Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control): referência para auditar e desativar com segurança o fluxo legado de anexos. A decisão atual é não receber binários do usuário no Supabase.
- [Supabase: Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes): atualização de listas sem banco paralelo.
- [TanStack Query: visão geral](https://tanstack.com/query/latest/docs/framework/react/overview): cache e invalidação de mutações.
- [Playwright: acessibilidade](https://playwright.dev/docs/accessibility-testing) e [WCAG 2.2](https://www.w3.org/TR/WCAG22/): testes automatizados com Axe e critérios de interface.
- [Zod 4](https://zod.dev/): contratos compartilhados de entrada.
- [Asana: Timeline](https://help.asana.com/s/article/plan-and-execute-projects-with-timeline): tarefas como barras temporais, marcos como checkpoints, dependências e edição conectada ao trabalho real.
- [Asana: Project roadmap](https://asana.com/resources/project-roadmap): roadmap como visão executiva de fases, entregas, datas e objetivos, sem substituir o plano detalhado.
- [Notion: Timeline view](https://www.notion.com/en-gb/help/guides/intro-to-timeline-view): agrupamento por propriedades, subitens, dependências e escalas temporais sobre a mesma base de dados.
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines): hierarquia visual clara, conteúdo em primeiro plano e movimento que preserva contexto.

## Decisões resultantes

- O peek usa `@peek/(.)tarefa/[taskId]`, `default.tsx` obrigatório e página completa na mesma URL.
- O servidor valida o usuário com Auth; RLS continua sendo a fronteira de autorização.
- Views expostas devem usar `security_invoker`; funções elevadas ficam em schema privado ou validam membership internamente.
- Chaves locais públicas podem ir ao cliente; `service_role` nunca entra em `NEXT_PUBLIC_*`.
- O banco guarda somente URLs HTTPS de mídia externa. As permissões do Drive ou de outro host continuam independentes da RLS do PTA OS.
- O cronograma do projeto combina uma faixa executiva de seis etapas com detalhes de tarefas e marcos. Marcos continuam sendo checkpoints; tarefas permanecem em `tasks` e são posicionadas automaticamente pela próxima data-alvo da etapa, preservando uma única fonte de verdade.
