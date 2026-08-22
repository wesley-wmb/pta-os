# Plano de testes

## Unitários

- Schemas Zod: títulos, prioridades, data pura e payload de versão.
- Utilitários de data pt-BR sem conversão indevida para UTC.
- Mapeamento de status e agrupamento semanal.

## Integração Supabase

- Usuário anônimo, membro ativo, viewer, membership suspensa e cross-workspace.
- Criação concorrente mantém número único.
- Update com versão antiga retorna conflito.
- Storage recusa path e MIME não permitidos.
- Atividade não pode ser inserida pelo cliente.

## E2E

- Fluxo vertical completo em Chromium desktop e Pixel 7.
- Deep link abre página completa; navegação suave abre peek.
- Reload conserva tarefas e alterações.
- Axe nas rotas principais e percurso integral por teclado.

## Gates

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e `pnpm test:e2e` com Supabase local ativo.
