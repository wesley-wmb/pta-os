# ADR 0001 — Supabase local antes do projeto hospedado

Status: aceito em 22 de agosto de 2026.

## Decisão

Construir e validar migrations, RLS, Auth e Storage na pilha Supabase local. Nenhuma credencial hospedada será usada nesta fase.

O self-bootstrap é desabilitado por padrão na migration e habilitado somente por `supabase/seed.sql`. O seed é local e nunca deve ser aplicado ao projeto hospedado. O `supabase/config.toml` também descreve somente o ambiente de desenvolvimento: signup aberto e confirmação de e-mail desabilitada não são decisões de produção.

## Motivos

- Desenvolvimento reproduzível por migrations.
- Testes de autorização sem risco aos dados remotos.
- Chaves privilegiadas já compartilhadas fora de um cofre precisam ser rotacionadas antes de uso remoto.

## Consequência

Docker Desktop é requisito local. A futura conexão hospedada será uma etapa explícita, começando por rotação de chaves, signup fechado/invite-only, confirmação habilitada e `db push --dry-run` sem executar o seed local.

O P0 admite um único bootstrap por usuário. Uma membership existente — inclusive suspensa ou ligada a workspace arquivado — impede novo bootstrap. Usuários suspensos/inativos não acessam dados do workspace; a leitura da própria linha de membership permanece uma exceção deliberada para permitir uma futura tela de estado da conta.
