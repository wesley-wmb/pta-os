# PTA OS — regras de implementação

- O produto é multiworkspace. Toda leitura e escrita de domínio deve carregar `workspace_id` e respeitar RLS.
- Supabase é o único backend: Auth, Postgres, Storage e Realtime. Não introduza outro provedor sem decisão explícita.
- Nunca use uma chave `secret` ou `service_role` no navegador. Somente URL e chave publicável podem usar `NEXT_PUBLIC_*`.
- Datas sem horário permanecem `date`; não converta para meia-noite UTC.
- Mutações de tarefas passam por RPC e usam `version` para concorrência otimista.
- A entidade central é `tasks`; semana, central e páginas de contexto são visões da mesma entidade.
- Use Server Components como padrão. Componentes cliente devem ficar na menor fronteira interativa possível.
- Interface em português do Brasil, acessível por teclado, com foco visível e alvos móveis adequados.
- Evite cards decorativos e dashboards genéricos. Priorize densidade editorial, hierarquia e informação operacional.
- Antes de concluir uma alteração: `pnpm lint`, `pnpm typecheck`, testes afetados e `pnpm build`.

Consulte `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/PERMISSIONS.md` e `docs/STATUS.md` antes de mudanças estruturais.

## Design do layout novo

- Para evoluir o shell atual e as telas de Início, Tarefas e Projetos, leia `docs/skills/apple-design/SKILL.md` (Emil Kowalski) e `docs/DESIGN_SYSTEM.md`.
- Aplique a skill à implementação atual em `app`, `components` e `features`; não redesenhe referências HTML antigas. Preserve a identidade PTA, as regras de domínio e a densidade operacional.
- Priorize feedback imediato, tipografia legível, movimento funcional e materiais acessíveis. A skill orienta decisões; não exige instalar bibliotecas nem adicionar gestos sem necessidade.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
