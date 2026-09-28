# Status

## Fundação de API e automações — 27/09/2026

- Implementada localmente a plataforma de chaves por workspace, escopos,
  expiração, revogação e hash de uso único.
- Criada a Edge Function `pta-api` com listagem, detalhe, criação, atualização,
  atribuição e comentários; mutações continuam passando por RPC e `version`.
- Adicionado outbox canônico para tarefas, responsáveis e comentários, com
  deduplicação, supressão do próprio ator, política antispam e entregas separadas
  para Slack e e-mail. Entregas pendentes do mesmo destinatário/tarefa são
  consolidadas antes do claim; o Slack atualiza a mensagem anterior na janela.
- Criado o dispatcher local para Slack Web API e Resend, com busca por e-mail,
  DM privada, `chat.update`, idempotência do e-mail, retry e limite de tentativas.
- Configurações recebeu `/configuracoes/api`, gestão de chaves, política de
  eventos e documentação em português.
- A migration e as duas Edge Functions ainda precisam ser publicadas e
  verificadas no Supabase hospedado. O CLI vinculado retornou 403 no dry-run e
  não há Docker local; por isso nenhum segredo foi gravado nem mensagem real foi
  enviada. O teste ponta a ponta permanece restrito ao Wesley.

## Release funcional consolidado — 26/09/2026

- O frontend e o projeto Supabase `cmrufxuwrracarokrcif` (PTA OS) estão
  sincronizados. Foram publicadas e verificadas as migrations de contexto de
  tarefas, campos personalizados, passos e subtarefas, perfil, configurações do
  workspace, gestão de checklist, faixas compartilhadas e fundação do modelo
  operacional de equipes.
- Perfil e configurações do workspace estão editáveis para os papéis
  autorizados. O detalhe de tarefa expõe edição e exclusão de itens e seções de
  checklist, além de criação e desvinculação de tarefas vinculadas.
- O cronograma usa fases e marcos persistidos, edição versionada, drag and drop,
  redimensionamento de intervalos, retorno contextual ao fechar a tarefa,
  escalas e zoom de 50% a 200% com Ctrl + roda do mouse.
- O smoke autenticado no localhost confirmou perfil editável, configurações do
  workspace editáveis, controles avançados do checklist e carregamento do
  cronograma com fase, marco, tarefa, escala e zoom.
- RLS forçada e grants das novas tabelas e RPCs foram conferidos no hospedado.
  O helper interno `rls_auto_enable` deixou de ser exposto a `anon` e
  `authenticated`.
- Verificação final aprovada: Prettier, ESLint, TypeScript, 334 testes em 56
  arquivos, build de produção e os cenários E2E aplicáveis contra o servidor
  autenticado. O contrato TypeScript foi regenerado a partir do schema
  hospedado e mantém as anotações nulas aceitas pelas RPCs.

## Kanban, cronograma e Projetos comparados ao Asana — 26/09/2026

- Referência inspecionada na aba autenticada do Asana no Chrome. O escopo
  solicitado foi limitado ao visual e às interações destas áreas.
- Kanban compartilhado: cabeçalhos compactos, superfícies separadas, cartões
  com raio menor e colunas recolhíveis por clique, Enter e Espaço, preservando
  foco e conteúdo. A lista de Projetos usa linhas mais compactas e divisórias.
- O quadro do projeto ganhou criação contextual na toolbar e área de rolagem
  horizontal na base. A hidratação inicial aguarda o cliente para não disputar
  com o cache de tarefas carregado pelo shell.
- Cronograma: menu de fase/marco, barras neutras com faixa de prioridade,
  botão Hoje que recupera a posição horizontal, fila sem data acessível no
  mobile e coluna lateral responsiva de 152/240 px.
- Validação: lint, typecheck, 30 testes afetados e build de produção aprovados.
  A primeira suíte completa teve 323 aprovações e uma falha de isolamento de
  DOM; a limpeza entre testes foi corrigida e os testes afetados repetidos.
- Inspeção autenticada em desktop e 390 px; recolhimento/restauração por
  teclado verificados. Lista também conferida no tema claro. O Chrome pode
  emitir um aviso de atributo `cz-shortcut-listen` inserido por extensão no
  `body`, independente do componente; não foi mascarado na aplicação.
- As migrations e permissões necessárias foram publicadas no fechamento da
  release funcional descrita acima.

## Apple Design no layout novo — 25/09/2026

- Skill `apple-design` de Emil Kowalski instalada no Codex e preservada com licença e origem em `docs/skills/apple-design`; `AGENTS.md` orienta seu uso no layout React atual.
- Shell e Início receberam feedback imediato, foco explícito, metadados legíveis, tipografia ajustada, superfícies opacas de leitura e movimento sem loops decorativos. Os modos de contraste e transparência reduzida preservam as cores semânticas das ações.
- Verificação: `pnpm lint` sem erros (um aviso preexistente de `CircleAlert` não utilizado em `project-workspace.tsx`), `pnpm typecheck`, 244 testes em 43 arquivos e `pnpm build` aprovados.
- Conferência autenticada do Início com dados reais no navegador: tema escuro em desktop e tema claro em viewport de 390 px. Tema e viewport foram restaurados após a inspeção.

## Perfil pessoal

- A rota `/perfil` apresenta nome, pronomes, cargo, área, biografia, avatar por
  URL HTTPS e e-mail autenticado em uma página completa e responsiva.
- A migration `20260925103000_profile_identity.sql` adiciona os campos de
  identidade profissional e a RPC autenticada `update_own_profile`, com lock e
  concorrência otimista por `updated_at`.
- A migration está publicada no Supabase hospedado. A leitura compatível
  continua protegendo ambientes antigos, mas o projeto PTA OS libera edição.

Atualizado em 26 de setembro de 2026.

## Concluído no produto

- A área Eventos foi transformada em Projetos na navegação e na experiência, com rota canônica `/projetos`, lista editorial, quadro de portfólio, cronograma e detalhe com quadro de tarefas da equipe. Links antigos de `/eventos` são redirecionados.
- O detalhe de Projeto ganhou configurações em página completa, edição da estrutura compartilhada, atalhos para equipe, recursos e atividade e uma visão inicial pessoal salva somente no dispositivo.
- Tarefas e a Visão geral abrem no contexto pessoal do responsável atual; dentro de Projetos, a leitura continua coletiva e reúne todas as tarefas vinculadas ao projeto.

- Configurações reúne conta, aparência, notificações, cards, segurança e administração com busca, estados responsivos e preferências isoladas por pessoa e workspace.
- Perfil pessoal ganhou uma página completa para identidade profissional, biografia e avatar HTTPS, com e-mail autenticado somente para leitura.
- Configurações do workspace cobre identidade, prefixo, cor, fuso, semana de trabalho, horário padrão e notificações; owner e admin editam, e os demais papéis consultam em modo de leitura.
- A personalização dos cards oferece três densidades e oito controles de conteúdo com prévia ao vivo; Kanban, Semana e overlay de arraste usam a mesma composição.

- Organização da tarefa distingue o solicitante fixo (`created_by`) do responsável editável. A chave técnica continua interna para busca e auditoria, sem ocupar espaço nos cards e detalhes.
- Checklist permite adicionar o primeiro passo sem criar ou nomear uma lista, mantém seções opcionais e oferece edição inline com controle de conflito.
- Checklist agora permite editar e excluir passos, renomear e excluir seções com confirmação; as ações são auditadas e protegidas por `updated_at`.
- Tarefas vinculadas usam a própria entidade `tasks`: podem herdar o contexto da tarefa pai, ser atribuídas a outro membro e preservar detalhe, comentários, links e histórico próprios.
- Tarefas vinculadas podem ser abertas, atribuídas e desvinculadas sem apagar a entrega filha; a relação possui confirmação, auditoria e concorrência otimista na tarefa pai.
- Fundação de campos personalizados com texto curto, número, data, sim/não e seleção única, limite de 12 campos ativos por workspace, RLS e mutações versionadas por RPC.
- Scaffold Next.js 16, design system editorial, identidade PTA e shell responsivo.
- Acabamento visual autoral com campo editorial gerado a partir da geometria PTA, WebP de 31 KB restrito ao acesso desktop e camada de motion em CSS sem loops ou dependências adicionais.
- Revisão tipográfica com corpo de 16 px, navegação de 15 px, títulos responsivos de 32 a 40 px, microcopy direta e remoção de linhas decorativas e hierarquias duplicadas.
- Autenticação com Supabase Auth, callback PKCE, recuperação de senha e bootstrap protegido.
- Início, Central de Demandas, detalhe canônico e side peek responsivo sobre a mesma entidade `tasks`.
- Pipeline unificada de demandas com Kanban, dia, semana, mês e tabela, filtros operacionais, busca contextual, navegação por período e movimentação por status ou data.
- O Kanban possui ordem manual persistente, alvos entre cartões, atualização otimista com rollback, movimento por teclado e anúncios de posição em português. Emergência e Alterações são compartilhadas com as faixas equivalentes da Semana; as demais posições continuam independentes. A RPC local `move_task_in_board` mantém status e posição atômicos e exige motivo ao entrar em bloqueio.
- Criação de demanda disponível no cabeçalho, nas colunas do Kanban e nos dias da semana, com prazo e status herdados do ponto de entrada.
- Tema claro e escuro persistente, com preferência do sistema no primeiro acesso, sidebar fosca e indicador ativo de alto contraste.
- Eventos e Produtos com criação, edição, detalhe, responsáveis, participantes, marcos e demandas contextuais sobre dados reais do workspace.
- Equipe com gestão de membros, convites, papéis, suspensão, reativação, remoção lógica e transferência de propriedade; Histórico com leitura sanitizada do workspace.
- Troca segura entre múltiplos workspaces com seleção HTTP only validada no servidor e limpeza integral do cache do cliente.
- Colaboração em demandas com editor rico seguro, títulos, listas, checks, citações, links HTTPS, comentários paginados, respostas, edição pelo autor e exclusão lógica.
- Links e arquivos das tarefas aceitam mídia privada (até 25 MB), descrição opcional, edição e remoção. Backend publicado pela migration 20260927234152_task_media_descriptions.
- Central de Recursos real para URLs HTTPS, com categorias, favoritos particulares, recentes, paginação, detalhe interno, abertura externa registrada, restrição e permissões explícitas.
- Criação de categoria diretamente no editor de recurso, com slug validado e posição serializada por workspace.
- Relações de recurso com demandas, produtos, eventos e tags editáveis por RPC, exibidas no detalhe com deep links.
- Categorias de recurso com criação, renomeação, cor, reordenação e arquivamento conforme o papel do usuário.
- A busca de Recursos inclui título, descrição, categoria, produto, evento, tag e demanda em vetor FTS coberto pelo índice GIN.
- Busca global real por `Ctrl+K` ou `Cmd+K`, além da rota `/busca`, agrupando demandas, eventos, produtos, recursos visíveis e pessoas autorizadas.
- Estados vazios, carregamento e falha sem dados simulados.
- DTOs validados com Zod, concorrência otimista e controles de mutação condicionados às capacidades retornadas pelo banco.
- Modelo operacional de equipes documentado em `docs/TEAM_OPERATING_MODEL.md`, com contrato puro, testes e visão informativa em `/equipe?visao=modelo`.
- A fundação de equipes, funções, dependências, aprovações e handoffs foi publicada com RLS forçada e RPCs autenticadas. A interface atual ainda apresenta esse modelo de forma informativa enquanto os controles operacionais são conectados.
- Auditoria estrutural contra `preview.html` concluída com três revisões independentes de layout, fluxo e funcionalidade. Início, Minha semana, Demandas, Eventos, Produtos, Recursos, Equipe e Histórico receberam as correções de maior impacto encontradas.
- Início agora usa evento real em destaque, prioridades, ritmo semanal, próximos eventos e movimentações recentes.
- Minha semana agora reproduz o quadro operacional horizontal usado pelo time, com listas persistentes de urgência, links importantes, planejamento, dias úteis, concluídos, alterações, ideias e arquivo. Os cards densos preservam contexto, prioridade, checklist, comentários, responsável e arraste entre todas as listas.
- O detalhe de demanda segue a composição da Preview: status, prioridade, título, descrição, propriedades planas, checklist, links externos e atividade com comentários no mesmo fluxo.
- Demandas ganhou seleção em massa, exportação da seleção, composição responsiva de filtros e métricas de checklist e comentários preparadas na visão do banco.
- Histórico possui busca, período, exportação CSV e faixa editorial de indicadores. Produtos possui resumo global com dados reais.
- Equipe calcula carga por esforço estimado versus capacidade semanal e previsibilidade por entregas com prazo nos últimos 28 dias.
- O detalhe de Evento foi ampliado para uma superfície imersiva com hero, progresso, ações, abas e visão geral em duas colunas.
- Canais Realtime de demandas e notificações agora usam identificadores únicos por assinatura para impedir colisões durante navegação e remontagem.

## Banco hospedado

- O aplicativo local usa o projeto Supabase hospedado como único backend para Auth, Postgres e Realtime.
- O navegador recebe somente URL e chave publicável. Chaves privilegiadas não usam prefixo `NEXT_PUBLIC_*`.
- A migration P0, os hardenings de Histórico, Equipe e prazo, e as migrations base de colaboração foram aplicadas anteriormente ao projeto hospedado.
- A migration base de colaboração protege descrição, checklist, comentários e links com RLS forçada e escrita por RPC.
- A leitura de `activity_logs` foi revogada do cliente. Histórico e detalhe recebem payload sanitizado.
- As migrations finais foram aplicadas e verificadas no projeto hospedado: `20260822223702_task_collaboration_realtime_hardening`, `20260822223746_resources_permissions_categories` e `20260822223748_search_prefix`.
- O smoke remoto confirmou grants somente para `authenticated`, política privada de Broadcast, guard de restrição ativo, criação de categoria, criação de recurso e busca por prefixo. Os dados do smoke foram revertidos na mesma transação.
- As migrations `20260822235316_resource_relations_categories`, `20260822235318_task_attachments_storage` e `20260822235321_events_products_operational` também foram aplicadas no hospedado. O fluxo de anexos foi reativado com descrições e mídias pela migration `20260927234152_task_media_descriptions`.
- A verificação estrutural histórica confirmou o bucket e suas políticas antes da nova decisão de produto. Os objetos e registros existentes serão preservados até inventário e migração explícita.
- O teste interativo de anexos cobriu envio de TXT e PNG, miniatura, descrição, edição e persistência; a remoção foi verificada pelo ciclo RPC/Storage durante a limpeza das fixtures.
- A migration `20260823003447_workspace_team_activation` foi aplicada e verificada no hospedado.
- A verificação de Equipe confirmou cinco novas colunas de convite, quatro novas colunas de membership, RLS forçada, dois gatilhos diferidos de owner, dez RPCs executáveis somente por `authenticated` e ausência de escrita direta pelo cliente.
- O smoke transacional de Equipe cobriu criação, inspeção, aceite idempotente, troca de papel, suspensão, reativação, remoção lógica, novo convite de reativação, cancelamento e transferência de propriedade nos dois sentidos. Todos os dados foram revertidos.
- A migration `20260823010000_global_task_context` foi aplicada e verificada no hospedado. A criação global aceita tipo, produto, evento, descrição rica e bloqueio sem expor escrita direta nas tabelas.
- A auditoria autenticada de 25 de agosto encontrou indisponibilidade nas RPCs administrativas de categorias de Recursos e de gestão avançada de Equipe. Isso exige revalidar a presença, os grants e o cache do schema remoto, mesmo quando o histórico acima registra a aplicação anterior das migrations relacionadas.
- As migrations de equipes, contexto de tarefas, campos personalizados, passos
  e subtarefas, perfil, workspace, gestão de checklist e faixas compartilhadas
  foram publicadas e registradas no histórico remoto em 26 de setembro.
- Ordenação do Kanban, cronograma, gerenciamento de marcos, quadros
  configuráveis, arquivamento de cards e proteção de conflitos já estavam
  publicados e foram reconciliados pelo nome no histórico remoto.
- `20260825090000_external_media_links_rich_text`, `20260825103000_task_overview_card_metrics` e `20260825110000_task_overview_description_preview` foram aplicadas e registradas no histórico remoto. O PostgREST foi recarregado após a publicação.
- A visão segura dos cards entrega totais de checklist, comentários e um trecho textual limitado da descrição, sem expor o documento rico completo na listagem.
- A migration `20260825123000_week_board_operational_lanes` foi aplicada e registrada no hospedado. Ela adiciona `week_lane` à entidade central, publica `move_task_in_week` com autorização e concorrência otimista e expõe a posição semanal na visão RLS-aware.

## Qualidade verificada

- A padronização configurável de Quadro, Semana e Projetos passou por
  `pnpm lint`, `pnpm typecheck`, 316 testes em 54 arquivos e `pnpm build`. A
  inspeção autenticada no localhost confirmou Emergência e Alterações nas duas
  visões de tarefas, sem erro de execução. Os controles de gestão permanecem
  ocultos no fallback até a migration configurável ser publicada no Supabase
  hospedado.

- A visão geral do projeto usa uma leitura operacional enxuta: direção editável, trabalho em andamento, próximo marco, detalhes e atividade. Projeto vazio não recebe avaliação positiva sem dados.
- O cronograma não presume etapas. Fases personalizáveis, marcos e tarefas são
  entidades persistidas, versionadas e organizadas por intervalo e data.
- A auditoria de 25 de setembro separou capacidades opcionais do backend das permissões comuns: tarefas vinculadas, gerenciamento avançado de checklist, edição de perfil/workspace e ordenação manual do Kanban não são mais expostos como disponíveis quando suas RPCs não existem.
- O relatório completo, incluindo limitações remotas e verificações locais, está em `docs/AUDIT_2026-09-25.md`.

- Na integração das seis frentes de configuração, `pnpm lint`, `pnpm typecheck` e `pnpm test` com 237 testes foram aprovados. O Kanban autenticado também foi aberto contra o schema hospedado anterior para confirmar o fallback de leitura.

- `pnpm lint`, `pnpm typecheck`, `pnpm test` com 209 testes e `pnpm build` foram aprovados após a evolução de checklist e tarefas vinculadas.
- `pnpm format:check` e `pnpm typecheck` foram repetidos após o acabamento final e permanecem aprovados.
- A auditoria manual autenticada cobriu as rotas principais, alternância de tema, dialogs, filtros e drag and drop real. Foram inspecionadas larguras de 390, 1280 e 1920 px sem overflow horizontal indevido.
- A auditoria comparativa de 25 de agosto validou no navegador autenticado Início, Semana, Lista, Calendário, Tabela, Kanban, seleção em massa, busca e exportação do Histórico, tema claro e escuro, abertura de criação, detalhe de Evento e ativação do drag and drop por teclado com cancelamento sem mutação.
- A nova auditoria autenticada criou uma demanda pela coluna semanal, confirmou a descrição no card, moveu a demanda por teclado entre dias, recarregou a página para confirmar persistência, criou e concluiu um item de checklist e confirmou o progresso de 100% no card. O registro temporário foi arquivado após o teste.
- A auditoria do quadro operacional criou uma demanda diretamente em Emergência, confirmou a lista após recarga, moveu o card por teclado para Links importantes e confirmou a segunda posição após nova recarga. Os doze destinos permaneceram disponíveis nos temas claro e escuro; o registro temporário foi arquivado ao final.
- O erro de criação causado pela ausência de `create_global_task` foi reproduzido antes da migration e eliminado após a publicação. A demanda de validação foi encontrada na Central, reaberta após recarga e arquivada ao final.
- Após a correção dos nomes dos canais, a navegação auditada não registrou erros de console nem novas colisões de Realtime.
- A suíte Playwright versionada ainda possui somente dois cenários de setup local sem autenticação e não reproduz essa auditoria completa. E2E autenticado, Axe nas rotas internas e drag and drop automatizado permanecem pendentes.
- A camada final de motion usa apenas opacidade e transformação, mantém os overlays sem blur de tela inteira e neutraliza animações e resposta tátil em `prefers-reduced-motion`.

## Execução local

- Rodar o frontend local não exige instalar Supabase CLI nem Docker.
- O arquivo local de ambiente aponta para o Supabase hospedado usando somente variáveis públicas no cliente.
- Supabase CLI e Docker permanecem opcionais para uma futura matriz isolada de RLS com fixtures. A ausência deles não bloqueia desenvolvimento, build ou uso do projeto hospedado.

## Lacunas restantes

- Publicar e verificar a fundação local de equipes no Supabase hospedado, gerar os tipos e conectar os controles de gestão à interface.
- Revalidar no projeto hospedado as RPCs de categorias de Recursos e gestão de Equipe, incluindo grants, RLS e cache do PostgREST.
- Alinhar `package.json`, `.env.example` e `tests/e2e/local-setup.spec.ts` ao desenvolvimento com Supabase hospedado, removendo a dependência operacional de CLI, Docker e banco local.
- Versionar a matriz E2E autenticada para rotas, temas, dialogs, mutações de Recursos, Histórico e drag and drop.
- Adicionar paginação remota ao Histórico quando o volume ultrapassar a janela sanitizada atual de 50 registros.
- Permitir que proprietários e administradores editem a capacidade semanal diretamente na área Equipe.
- Evoluir o detalhe imersivo de Evento para uma rota canônica compartilhável, mantendo a consulta rápida atual.
- Persistir templates versionados, execuções completas, SLA em horas úteis e seguidores de tarefas.
- Ampliar o E2E autenticado para cobrir as mutações completas de colaboração, Recursos e Busca usando fixtures isoladas.
- Adicionar renomeação e arquivamento de tags. A criação de tag já existe dentro do editor de relações.
- Avaliar filtros dedicados por produto, evento e tag. A busca textual já encontra esses relacionamentos.
- Evoluir a ordenação manual de seções e itens de checklist; edição, exclusão e
  desvinculação já estão disponíveis.
- Monitorar uploads incompletos e quotas do bucket privado de anexos.
- Levar o editor rico seguro para descrições longas de Produtos, Eventos e Recursos depois de estabilizar a experiência em Demandas.
- Exigir MFA/AAL2 nas operações de rotação e desconexão de credenciais antes de
  liberar a gestão para mais administradores. Os segredos já são modelados no
  Vault e nunca são devolvidos ao navegador.
- Publicar o aplicativo e configurar URLs de autenticação do ambiente definitivo.
- Rotacionar ou revogar credenciais privilegiadas que tenham sido compartilhadas fora do cofre de segredos.

### Cronograma — comparação direta com Asana (26/09/2026)

- Grade com altura limitada à janela, rolagem interna e cabeçalho/coluna de seções fixos; tarefas curtas mostram responsável, título e prazo sem esticar artificialmente o intervalo.
- Filtros combinados por conclusão, responsável e prioridade; ordenação por início, conclusão, responsável e título; painel lateral de cores, agrupamento, escala e expansão das seções.
- Painel Sem data permite agendar tarefas pela RPC existente, com versionamento, atualização otimista e rollback. Planejamento contextual permite editar início, conclusão, status e seção real (`event_phase_id`).
- Agrupamento por seções do projeto preserva fases vazias e uma seção para tarefas ainda não associadas. As mutações usam `move_task_in_timeline`, `workspace_id` e versão; as migrations do cronograma estão publicadas no Supabase.
- Ainda não há paridade integral com Asana: dependências visuais, caminho crítico, reprogramação em cascata e reordenação/edição de seções diretamente na grade não foram implementados nesta revisão.

### Kanbans e vínculo de projeto — 26/09/2026

- Aplicadas no PTA OS as migrações `20260926210000`, `20260926220000` e `20260926221000`: configuração versionada das colunas, capas HTTPS, exclusão recuperável de cards e proteção contra conexões conflitantes entre Quadro e Semana.
- Colunas recebem nome, cor, ícone e capa externa; o título funciona como alça de ordenação. Cards da Semana permitem ordenação por posição dentro das faixas.
- O menu do card oferece edição, abertura do projeto vinculado e exclusão com Desfazer. Excluir arquiva a tarefa central e a remove de todas as visões; não existe uma cópia por quadro.
- A etiqueta de projeto representa `tasks.event_id`. Selecionar Projeto inclui a mesma tarefa no Kanban correspondente; criar dentro do projeto preenche esse vínculo. Trocar o projeto invalida o cache de portfólio e as assinaturas de tarefas usam workspace para atualizar também o projeto anterior.
- A conexão Quadro–Semana é uma regra adicional bidirecional para os próximos movimentos. Não cria tarefas nem é necessária para vincular um projeto. Uma faixa já conectada não pode ser tomada silenciosamente por outra coluna.
- Validação interativa concluída no navegador autenticado.

### Colunas e conexões diretas — 26/09/2026

- Quadro por status e Kanban interno dos projetos: Adicionar coluna no final; Excluir coluna exige destino e transfere as tarefas por RPC versionada. Colunas são compartilhadas no workspace. A exclusão desativa o status e remove sua conexão, preservando cards e projetos.
- Semana: Automações abre o editor de conexão no próprio contexto, com nomes reais, resumo bidirecional e remoção da conexão. Substituir a conexão usa uma única transação.
- Cards de Quadro, projetos e Semana têm menu Ações com edição e exclusão recuperável. Adicionar tarefa fica no rodapé da coluna fora da área de rolagem dos cards.
- Restaurada a sincronização baseada nas configurações: a função remota havia voltado à regra legada por nomes e não respeitava conexões personalizadas. O cliente remoto também deixa de inferir vínculos pelo nome da coluna.
- Smoke remoto com rollback: criação, conflito de versão, conexão nos dois sentidos, transferência na exclusão, preservação de quantidade de tarefas, arquivamento/restauração e rejeição de usuário externo.

### Desempenho — 26/09/2026

- Pesquisa em três frentes e diagnóstico com estatísticas SQL reais registrados em `docs/PERFORMANCE.md`, incluindo metas, fontes oficiais, decisões e limites da medição.
- Links de navegação com feedback pendente, loading boundaries nas rotas centrais e prefetch seletivo de detalhes por intenção; abas de projeto trocam localmente via History API.
- Contexto de workspace usa joins autorizados para reduzir etapas de rede; Início carrega fontes independentes em paralelo. Sidebar consulta contagens, sem baixar todos os cards.
- Realtime de tarefas compartilhado por workspace/cache com atualização agrupada; suporte a cancelamento nas leituras e animações mais curtas com reduced motion.
- Paginação contextual, métricas de navegador em produção e otimizações adicionais de mutação/payload continuam descritas como próximas etapas, não como ganhos já medidos.

### Correção do carregamento de workspace — 26/09/2026

- Removido filtro cliente sobre `workspace_members.removed_at`, coluna interna sem SELECT para authenticated. O filtro introduzido durante a otimização causava erro 42501 no carregamento do shell.
- Mantidos os filtros autorizados por usuário/workspace/status e a RLS existente; nenhuma permissão foi ampliada.
- Consultas de memberships e perfis com joins verificadas no banco sob `SET LOCAL ROLE authenticated`; teste de regressão impede reintroduzir o filtro privado.

### Exclusão de colunas da Semana — 26/09/2026

- Menu da coluna operacional permite excluir com destino obrigatório; a RPC transfere cards de todo o workspace, preservando projeto, datas e arquivo, com versão esperada e autorização owner/admin/manager.
- Colunas removidas guardam destino de redirecionamento para criações e clientes antigos; a última coluna de planejamento e os dias do calendário permanecem necessários.
- Tarefas agendadas atrasadas continuam visíveis quando Para planejar é removida. Nomes editados são respeitados e conexões só oferecem colunas ativas com os nomes atuais.
- Migração aplicada e smoke SQL transacional com rollback validou transferência, versões, redirecionamento encadeado e negação de usuário externo. Validação visual permanece indisponível pela restrição salva de acesso ao navegador.


## Operação por equipes — 28/09/2026

Operação por equipes implementada: diretório, abertura direta da área de trabalho, Pessoas, criação atômica e privacidade por participação. O contexto teste foi reaproveitado em Operação com autorização. Migrations novas de 28/09 aplicadas somente em cmrufxuwrracarokrcif e timestamps locais alinhados ao remoto.
