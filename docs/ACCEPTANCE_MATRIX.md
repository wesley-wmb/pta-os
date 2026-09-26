# Matriz de aceite

| ID  | Cenário                         | Evidência esperada                                                    |
| --- | ------------------------------- | --------------------------------------------------------------------- |
| A01 | Cadastrar/entrar localmente     | sessão e redirecionamento para Início                                 |
| A02 | Bootstrap inicial               | workspace e catálogos criados uma única vez                           |
| A03 | Criar demanda                   | número sequencial e registro no Postgres                              |
| A04 | Ver na Central                  | mesma tarefa, filtros e estado vazio corretos                         |
| A05 | Ver na Semana                   | tarefa aparece no dia de `due_date` sem deslocamento de fuso          |
| A06 | Abrir side peek                 | URL canônica, fundo preservado, fecha com Escape/Voltar               |
| A07 | Editar status/responsável/prazo | RPC valida `version`, lista atualiza e persiste após reload           |
| A08 | Histórico/notificação           | eventos append-only e notificação do responsável                      |
| A09 | Isolamento                      | usuário externo ao workspace recebe zero linhas/erro autorizado       |
| A10 | Viewer                          | leitura permitida e todas as mutações negadas                         |
| A11 | Responsivo                      | login, shell, Central, Semana e detalhe operáveis em 390 px           |
| A12 | Acessibilidade                  | navegação por teclado, foco e Axe sem violações críticas              |
| A13 | Módulos operacionais            | Eventos, Produtos, Equipe e Histórico leem o workspace real           |
| A14 | Histórico seguro                | cliente não lê payload bruto; RPC retorna até 50 itens seguros        |
| A15 | Capacidade da equipe            | somente papéis autorizados recebem a capacidade por RPC               |
| A16 | Colaboração na demanda          | texto rico, checklist, comentários, respostas e links persistem       |
| A17 | Recursos V1                     | URL HTTPS cria, edita, arquiva, favorita e registra visita            |
| A18 | Recursos restritos              | conteúdo e controles respeitam papel e permissão explícita            |
| A19 | Catálogo de recursos            | filtros, busca e paginação não misturam workspace ou consulta         |
| A20 | Busca global                    | grupos reais retornam apenas entidades que o usuário pode abrir       |
| A21 | Desenvolvimento hospedado       | frontend local funciona sem instalar Supabase CLI ou Docker           |
| A22 | Mídia externa                   | somente URL HTTPS persiste; não há input de arquivo nem Storage       |
| A23 | Relações de recursos            | demanda, produto, evento e tag aparecem na busca e no detalhe         |
| A24 | Portfólio operacional           | produto, evento, marco e demanda contextual persistem por RPC         |
| A25 | Convite de equipe               | token com hash, e-mail correspondente e aceite único                  |
| A26 | Gestão de membros               | papel, suspensão, reativação e remoção usam versão e RPC              |
| A27 | Propriedade do workspace        | transferência atômica mantém exatamente um owner ativo                |
| A28 | Múltiplos workspaces            | seleção validada limpa cache e mantém isolamento entre contextos      |
| A29 | Paridade com a Preview          | shell e oito áreas preservam hierarquia, controles e fluxos reais     |
| A30 | Cards operacionais              | semana e Kanban exibem métricas e permitem DnD por mouse e teclado    |
| A31 | Métricas de Equipe              | carga usa esforço/capacidade e previsibilidade usa entregas com prazo |
