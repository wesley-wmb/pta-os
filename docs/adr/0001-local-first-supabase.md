# ADR 0001: Supabase local antes do projeto hospedado

Status: supersedido pelo ADR 0003 em 22 de agosto de 2026.

## Decisão

Na decisão original, migrations, RLS, Auth e Storage seriam construídos e validados primeiro em uma pilha Supabase local, sem usar o projeto hospedado.

O self-bootstrap é desabilitado por padrão na migration e habilitado somente por `supabase/seed.sql`. O seed é local e nunca deve ser aplicado ao projeto hospedado. O `supabase/config.toml` também descreve somente o ambiente de desenvolvimento: signup aberto e confirmação de e-mail desabilitada não são decisões de produção.

## Motivos

- Desenvolvimento reproduzível por migrations.
- Testes de autorização sem risco aos dados remotos.
- Chaves privilegiadas já compartilhadas fora de um cofre precisam ser rotacionadas antes de uso remoto.

## Consequência

Essa consequência não representa mais o caminho obrigatório. O projeto passou a usar o Supabase hospedado durante o desenvolvimento local, sem exigir Supabase CLI ou Docker. Uma pilha isolada continua possível para testes destrutivos com fixtures.

O P0 admite um único bootstrap por usuário. Uma membership existente, inclusive suspensa ou ligada a workspace arquivado, impede novo bootstrap. Usuários suspensos ou inativos não acessam dados do workspace; a leitura da própria linha de membership permanece uma exceção deliberada para permitir uma futura tela de estado da conta.
