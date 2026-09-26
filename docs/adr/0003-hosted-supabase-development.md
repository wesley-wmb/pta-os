# ADR 0003: Supabase hospedado no desenvolvimento local

Status: aceito em 22 de agosto de 2026.

## Contexto

O frontend precisa funcionar localmente sem instalar Supabase CLI ou Docker. Auth, Postgres e Realtime já pertencem ao projeto Supabase hospedado, e o produto precisa validar RLS e RPCs no backend que realmente atende a aplicação.

## Decisão

- O frontend local usa o Supabase hospedado como backend único.
- O navegador recebe somente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Chaves `secret`, `service_role`, PATs e senhas de banco nunca entram no bundle, nos arquivos versionados ou na documentação.
- Mudanças de schema continuam em migrations SQL versionadas e passam por revisão antes da aplicação remota.
- Uma migration local só é registrada como aplicada depois da confirmação no histórico do projeto hospedado.
- Supabase CLI e Docker são opcionais. Podem apoiar uma futura matriz isolada de RLS, mas não bloqueiam frontend, build ou uso do ambiente hospedado.
- Seeds locais nunca são aplicados automaticamente ao projeto hospedado.

## Consequências

- O caminho de desenvolvimento fica menor e reproduz o backend usado pela aplicação.
- Testes que alteram ou removem dados exigem workspace descartável, fixtures controladas ou uma pilha isolada opcional.
- A aplicação de migration remota exige cuidado adicional com ordem, compatibilidade e rollback por nova migration.
- Credenciais privilegiadas compartilhadas fora de um cofre devem ser rotacionadas antes de uso contínuo.
