# Baseline

## Objetivo

PTA OS é o sistema operacional local para demandas, eventos, produtos e recursos da PTA. A primeira fatia comprova: autenticação, criação de uma demanda, visualização na Central e na Semana, edição no side peek, histórico e persistência.

## Stack fixada

- Next.js 16 App Router, React 19 e TypeScript estrito.
- Tailwind CSS 4 com variáveis e componentes shadcn/Radix.
- Supabase local para Auth, Postgres, RLS, Storage e Realtime.
- TanStack Query/Table, React Hook Form, Zod, dnd-kit, Tiptap e date-fns pt-BR.
- Vitest/Testing Library e Playwright/Axe.

## Limites da fase local

- Nenhuma operação é executada no projeto Supabase hospedado.
- Credenciais privilegiadas não são salvas no repositório.
- Docker Desktop é pré-requisito para iniciar a pilha Supabase local.
- Publicação, domínio, e-mail transacional e integrações externas ficam fora desta fase.

## Critério de saída

O fluxo vertical roda em `localhost`, passa por RLS real e sobrevive a reload. Estados vazio, carregando, erro, conflito e acesso negado são explícitos.
