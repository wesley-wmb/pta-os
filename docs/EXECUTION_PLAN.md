# Plano de execução

A fonte de verdade consolidada dos pedidos, evidências, pendências e ordem de fechamento está em `docs/MASTER_EXECUTION_MATRIX.md`.

1. Fundação: scaffold estável, design tokens, qualidade, documentação e conexão segura ao Supabase hospedado.
2. Dados: migrations SQL versionadas, tenancy, RLS, RPCs, Realtime e tipos gerados. Supabase CLI e Docker são ferramentas opcionais, não requisitos do frontend local.
3. Fluxo vertical: cadastro/login, bootstrap do workspace, Início, nova demanda, Central, Semana e side peek.
4. Colaboração: descrição rica segura, checklists, comentários paginados, respostas e links HTTPS para mídia externa.
5. Operação: Eventos, Produtos, Equipe, Histórico, Central de Recursos URL-only, busca global, responsividade e estados de falha.
6. Verificação: testes unitários, políticas, E2E desktop/mobile, Axe, build, auditoria de segredos e confirmação do schema hospedado.

Cada etapa termina com um checkpoint Git sem credenciais e atualização de `docs/STATUS.md`. Uma migration local não é descrita como remota antes da aplicação e verificação no projeto hospedado.
