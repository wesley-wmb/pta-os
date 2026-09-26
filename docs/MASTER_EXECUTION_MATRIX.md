# Matriz mestre de execução do PTA OS

Atualizado em 25 de agosto de 2026.

Este documento consolida os pedidos acumulados do projeto, o estado real da implementação e a ordem de fechamento. Ele é a fonte principal para evitar perda de contexto entre design, produto, banco e auditoria.

## Critérios permanentes

- A aplicação roda localmente e usa o Supabase hospedado como único backend.
- Supabase CLI e Docker não são instalados na máquina.
- Toda leitura e escrita de domínio respeita `workspace_id` e RLS.
- Somente URL e chave publicável podem chegar ao navegador.
- Arquivos, imagens, vídeos e áudios ficam em Drive ou outro host externo. O PTA OS persiste somente URLs HTTPS e metadata textual.
- Descrições longas usam texto rico seguro com títulos, listas, checks e formatação legível no estilo de um documento operacional.
- Tarefas continuam sendo a entidade central de Demandas, Semana, Eventos, Produtos e contexto operacional.
- A interface usa português do Brasil, tipografia simples de sistema, corpo confortável e escrita direta.
- A interface não usa travessões em textos do produto.
- Azul PTA é a cor principal de ação, seleção, foco e resposta ao hover.
- Verde e lima ficam restritos a progresso, saúde e sinais operacionais.
- Tema claro e escuro são obrigatórios.
- Bordas arredondadas, superfícies bem agrupadas e espaçamento substituem linhas retas em excesso.
- A estrutura funcional e a hierarquia da Preview são a referência principal.
- A identidade visual, logos, tom de escrita e sistema de cores do PTA permanecem próprios.
- Toda entrega passa por lint, typecheck, testes afetados, build e auditoria no navegador.
- Subagentes são usados em frentes independentes de design, funcionalidade e auditoria.

## Estado executivo

| Frente                            | Estado                              | Evidência atual                                                                                           | Próxima ação                                                                        |
| --------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Aplicação local                   | Concluída em runtime                | Next.js abre e navega no localhost usando o projeto hospedado                                             | Remover scripts, exemplo e dependência de CLI local que ainda contradizem a decisão |
| Conexão segura ao Supabase        | Concluída                           | Cliente usa somente URL e chave publicável                                                                | Rotacionar credenciais privilegiadas expostas fora do cofre                         |
| Design global                     | Implementado, auditoria parcial     | Tipografia nativa, azul PTA, temas, motion reduzido, maior arredondamento e responsividade                | Revisar metadados pequenos, divisores residuais e todos os estados nos dois temas   |
| Paridade estrutural com a Preview | Avançada, ainda parcial             | Início, Demandas, Semana, Eventos, Produtos, Recursos, Equipe e Histórico seguem boa parte da hierarquia  | Completar módulos e controles que ainda existem apenas na Preview                   |
| Demandas e pipeline               | Operacional, ajustes pendentes      | Tabela, Kanban, filtros, busca, métricas, criação e drag and drop funcionando                             | Completar ações em lote e revalidar mutações após a migration global                |
| Minha semana                      | Operacional, ajustes pendentes      | Semana, lista, calendário, período, filtros e layout responsivo funcionando                               | Corrigir Campos, agenda diária e ampliar E2E                                        |
| Light e dark                      | Implementada, auditoria parcial     | Alternância persistente e temas inspecionados nas jornadas principais                                     | Auditar todas as rotas, dialogs, vazios e hovers nos dois temas                     |
| Eventos e Produtos                | Operacionais, ajustes pendentes     | Listagem, filtros, cards, criação e detalhes contextuais                                                  | Aproximar cabeçalhos e métricas da Preview e revalidar RPCs                         |
| Central de Recursos               | Parcial no hospedado                | Interface, busca, criação simples e estados funcionam; gestão de categorias sinaliza backend indisponível | Revalidar migrations e RPCs remotas                                                 |
| Mídia externa e texto rico        | Implementado localmente             | Upload interno removido, links externos e editor estruturado conectados às demandas                       | Publicar migration, testar permissões externas e ampliar para outros módulos        |
| Equipe e workspaces               | Parcial no hospedado                | Gestão atual, capacidade, convites, múltiplos workspaces e modelo informativo implementados               | Publicar a fundação operacional de equipes                                          |
| Linha de produção                 | Fundação local concluída            | Funções, dependências, aprovações e handoffs modelados e testados                                         | Publicar migration e conectar controles operacionais                                |
| Migrations hospedadas             | Pendente de revalidação             | Duas migrations finais estão locais; token anterior recebeu 403                                           | Aplicar por Management API com token autorizado                                     |
| Auditoria funcional local         | Manual concluída, automação parcial | Rotas, botões, dialogs, responsividade, temas e drag and drop verificados                                 | Versionar E2E autenticado e repetir o smoke depois das migrations                   |
| Qualidade de código               | Concluída                           | Lint, typecheck, 181 testes e build aprovados                                                             | Repetir gates no fechamento remoto                                                  |
| Diferencial visual gerado         | Avaliado                            | Identidade usa SVG, CSS e asset WebP leve com respeito a movimento reduzido                               | Gerar mídia nova somente se houver função clara e orçamento de desempenho           |

## Matriz por tela

### Acesso e primeiro uso

- Login, cadastro, recuperação de senha e callback PKCE implementados.
- Bootstrap de workspace protegido e compatível com convite.
- A falha antiga que exigia liberação manual foi substituída pelo fluxo de criação permitido ao usuário elegível.
- O acesso preserva a identidade PTA e usa o símbolo oficial correto por tema.
- O cliente não recebe `secret`, `service_role`, PAT ou chave do Gemini.
- O cliente não envia mídia ou arquivos do usuário ao Supabase. Ele guarda somente links HTTPS compartilháveis.

### Shell e navegação

- Sidebar fosca, arredondada e sem o verde como cor dominante.
- Abas Início, Minha semana, Demandas, Eventos, Produtos, Central de recursos, Equipe e Histórico adaptadas.
- Busca global, notificações, nova demanda, troca de tema e troca de workspace preservadas.
- Navegação mobile funcional e sem overflow horizontal.
- Hover, foco e seleção usam azul PTA com contraste visível.
- Metadados entre 10 e 12 px ainda precisam de uma revisão final de legibilidade.
- Divisores lineares residuais devem ser removidos quando o agrupamento por espaço ou superfície já for suficiente.

### Início

- Hierarquia próxima da Preview com foco operacional, prioridades e ritmo.
- Dados reais do workspace, sem métricas fictícias.
- Superfícies arredondadas e agrupamento editorial com menos divisores.
- CTAs levam aos módulos correspondentes.
- A estrutura ainda pode ganhar blocos equivalentes a próximos eventos e movimentações recentes quando as consultas agregadas estiverem disponíveis.

### Demandas

- Métricas de abertas, andamento, revisão e atrasadas.
- Tabela e Kanban sobre a mesma entidade `tasks`.
- Busca, filtros, campos, abas operacionais e paginação.
- Criação global e contextual.
- Cards movidos por drag and drop com persistência por RPC e `version`.
- Estados vazios e falhas operacionais claros.
- Descrição longa com títulos, bullets, lista numerada, checks, citação, links e formatação inline segura.
- A tabela ainda não possui seleção por checkbox e ações em lote equivalentes à referência.

### Minha semana

- Semana, lista e calendário.
- Navegação por período e data preservada na URL.
- Visão por equipe e filtros.
- Colunas responsivas, sem rolagem horizontal forçada.
- Cards com produto ou evento, status, prazo, progresso e responsável.
- Criação a partir do dia selecionado.
- Os controles Contexto e Prazo da Lista ainda precisam alterar efetivamente as colunas exibidas.
- A agenda diária precisa de navegação de período própria para não retornar de forma ambígua à semana.

### Eventos

- Galeria visual, lista, mês e linha do tempo.
- Filtros por status, produto e ano.
- Cards com progresso, volume de demandas, responsáveis, risco e período.
- Criação, edição, participantes, marcos e demandas contextuais.
- Azul PTA aparece em ação, hover e foco; cores auxiliares representam saúde e contexto.
- O calendário anual atual é um agrupamento mensal e o roadmap ainda pode se aproximar da faixa contínua da Preview.
- Ações principais devem subir do painel de filtros para o cabeçalho na revisão final.

### Produtos

- Portfólio em cards responsivos e visão de tabela.
- Métricas de eventos, demandas abertas, recursos e saúde.
- Criação, edição, membros e relação com eventos e demandas.
- Cabeçalhos visuais respeitam a identidade PTA sem depender de imagens pesadas.
- A galeria deve exibir a contagem real de Recursos e recuperar a faixa agregada vista na Preview.
- A ação Novo produto deve subir para o cabeçalho na revisão final.

### Central de Recursos

- Busca destacada, categorias, fixados e biblioteca.
- URLs HTTPS, favoritos, recentes, paginação, permissões e relações.
- Arquivos e mídia são referências externas. Não existe upload binário nem preview buscado pelo servidor.
- Criação simples continua disponível mesmo se a gestão administrativa de categorias falhar.
- A indisponibilidade remota de categorias é explicada sem detalhes técnicos para o usuário.
- O estado remoto real das RPCs de categorias precisa ser reconciliado com `docs/STATUS.md`, que registra a migration como aplicada.

### Equipe e workspaces

- Uma pessoa pode participar de vários workspaces.
- Um workspace é a fronteira de isolamento; pode conter várias equipes internas.
- Papéis de acesso: owner, admin, manager, member e viewer.
- Funções profissionais: Head, Líder, Copywriter, Designer, Gestor de Tráfego, Web Designer, Vídeo e Conteúdo, Automação e funções configuráveis.
- Owner e admin administram membros e convites.
- Manager coordena a operação, mas não administra propriedade.
- Member cria para si, para a fila da equipe ou para um handoff permitido.
- Viewer permanece em leitura.
- Carga, capacidade, previsibilidade, cards de pessoas, convites e permissões estão implementados.
- O modelo operacional está documentado em `docs/TEAM_OPERATING_MODEL.md`.
- A criação e administração geral de novos workspaces depois do onboarding ainda não possui uma jornada completa.
- Os nomes de papéis precisam ser padronizados entre Gestor, Coordenador, Visualizador, Observador e Leitura.
- A utilização exibida é uma aproximação por volume e capacidade, pois as tarefas ainda não possuem esforço planejado suficiente para uma taxa real.

### Linha de produção

- Cada etapa continua sendo uma tarefa real, com responsável principal.
- Dependências definem quando uma tarefa está pronta para avançar.
- Handoffs registram a passagem entre Copy, Design, Tráfego, Web e Liderança.
- Aprovações funcionam como gates nomeados, sem transformar o aprovador em responsável de execução.
- O fluxo planejado cobre briefing, copy, arte, revisão, configuração, publicação e análise.
- Templates versionados, execuções completas e SLA em horas úteis permanecem na fase seguinte.

### Histórico

- Métricas operacionais, atividade sanitizada e categorias de entrega.
- O navegador não lê payload bruto de `activity_logs`.
- Busca, filtro de período, exportação e paginação vistos na Preview ainda precisam de implementação funcional.

## Auditoria já realizada

- Rotas auditadas: `/inicio`, `/demandas`, Kanban, Semana, Lista, Calendário, `/eventos`, `/produtos`, `/recursos`, `/equipe`, modelo da equipe e `/historico`.
- Botões principais, abas, filtros, dialogs, busca global, notificações e alternância de tema foram acionados.
- Drag and drop foi testado em uma demanda real e a demanda foi devolvida ao status original.
- Tema escuro foi testado e o ambiente foi devolvido ao tema claro.
- Larguras de 390, 1280 e 1920 px foram verificadas sem overflow horizontal indevido.
- O smoke final não encontrou erros de console nas rotas principais.
- Não existem travessões em textos de interface nos arquivos de aplicação verificados.
- Essa auditoria foi manual e autenticada. A suíte Playwright versionada ainda não reproduz todo o percurso.

## Banco hospedado

### Aplicado e documentado

- Núcleo multiworkspace, RLS, tarefas, histórico, colaboração, recursos, busca, eventos, produtos e ativação administrativa de equipe. A estrutura antiga de anexos permanece apenas como legado preservado.

### Pendente ou exigindo revalidação

- `20260823010000_global_task_context.sql`
- `20260824090000_team_operating_model_foundation.sql`
- `20260825090000_external_media_links_rich_text.sql`
- RPCs administrativas de categorias de recursos, pois o navegador encontrou indisponibilidade no schema hospedado.
- RPC de gestão avançada de equipe, pois a interface precisou usar o fallback operacional.
- `lib/database.types.ts`, pois os tipos locais não representam com confiança o schema remoto observado.
- `package.json`, `.env.example` e `tests/e2e/local-setup.spec.ts`, pois ainda mencionam Supabase local, Docker e CLI.

### Procedimento de publicação

1. Rotacionar as chaves privilegiadas e PATs compartilhados fora do cofre.
2. Criar um PAT de escopo restrito com acesso de escrita ao banco do projeto correto.
3. Definir o token apenas no ambiente local seguro.
4. Aplicar as migrations por API de gerenciamento do Supabase, sem instalar CLI ou Docker.
5. Confirmar o histórico remoto de migrations e executar smokes transacionais.
6. Gerar novamente os tipos de banco.
7. Remover fallbacks que deixarem de ser necessários.
8. Repetir lint, typecheck, testes, build e auditoria no navegador.

## Lacunas de auditoria automatizada

- Criar E2E autenticado para login hospedado, bootstrap e recuperação de senha.
- Cobrir criação, edição, arquivamento, favorito, visita, categorias e relações de Recursos.
- Cobrir busca, filtro e exportação do Histórico quando forem implementados.
- Cobrir temas, dialogs, cards, filtros e breakpoints de todas as rotas principais.
- Cobrir drag and drop real com persistência e restauração da fixture.
- Executar Axe nas rotas autenticadas principais.

## Backlog preservado

- Templates de fluxo versionados e execuções completas.
- SLA em horas úteis.
- Seguidores de tarefas.
- Renomeação e arquivamento de tags.
- Filtros dedicados por produto, evento e tag.
- Reordenação, edição e exclusão estrutural de checklists.
- Inventário e migração segura dos anexos legados para referências externas.
- Editor rico seguro para descrições longas de Produtos, Eventos e Recursos.
- Cofre de segredos e MFA antes de armazenar credenciais operacionais.
- Publicação do aplicativo e URLs definitivas de autenticação.

## Ordem de fechamento

1. Receber autorização remota segura sem segredos na conversa.
2. Aplicar e verificar migrations hospedadas.
3. Atualizar tipos e habilitar os controles dependentes do schema.
4. Repetir a auditoria visual e funcional completa.
5. Corrigir qualquer regressão encontrada.
6. Executar todos os gates de qualidade.
7. Registrar a versão como pronta para publicação.
