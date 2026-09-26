# Baseline

## Objetivo

PTA OS é o sistema operacional da PTA para demandas, eventos, produtos e recursos. O frontend pode rodar em `localhost`, conectado ao Supabase hospedado, e já cobre autenticação, fluxo operacional de demandas, colaboração, módulos contextuais, Central de Recursos e busca global.

## Stack fixada

- Next.js 16 App Router, React 19 e TypeScript estrito.
- Tailwind CSS 4 com variáveis e componentes shadcn/Radix.
- Supabase hospedado como backend único para Auth, Postgres, RLS e Realtime.
- TanStack Query/Table, React Hook Form, Zod, dnd-kit, Tiptap e date-fns pt-BR.
- Vitest/Testing Library e Playwright/Axe.

## Limites atuais

- Credenciais privilegiadas não são salvas no repositório.
- Somente URL e chave publicável chegam ao navegador.
- Supabase CLI e Docker não são requisitos para executar o frontend ou usar o backend hospedado.
- Mídia e arquivos do usuário são hospedados no Drive ou em outro serviço externo. O PTA OS armazena somente URLs HTTPS e metadata textual, sem upload de binários para o Supabase.
- Uma pilha Supabase local pode ser adicionada depois como ambiente opcional de fixtures destrutivas.
- Publicação, domínio, e-mail transacional e integrações externas ficam fora desta fase.

## Critério de saída

O fluxo vertical roda em `localhost` contra o Supabase hospedado, passa por RLS real e sobrevive a reload. Estados vazio, carregando, erro, conflito e acesso negado são explícitos. Migrations locais novas somente entram neste critério depois de aplicadas e verificadas no projeto hospedado.
