# Modelo de dados

## Projetos

Projetos são apresentados pela rota `/projetos` e, nesta etapa, reutilizam as tabelas `events`, `event_members`, `event_milestones` e a chave `tasks.event_id`. A nomenclatura física é legado de compatibilidade; uma tarefa continua sendo uma única linha em `tasks`. A área pessoal filtra `primary_assignee_id`, enquanto o projeto consulta todas as tarefas ligadas ao mesmo `event_id` dentro do workspace.

A visão inicial escolhida por cada pessoa para um projeto é uma preferência local, versionada por usuário, workspace e projeto. Ela não altera o registro compartilhado nem a URL quando `visao` é informada explicitamente.

## Núcleo de tenancy

- `profiles`: extensão 1:1 de `auth.users`, com identidade global da pessoa
  (nome, pronomes, cargo, área, biografia curta e URL HTTPS opcional de avatar).
- `workspaces`: unidade de isolamento.
- `workspace_members`: papel, estado, remoção lógica, versão e auditoria temporal da participação.
- `workspace_preferences`: fuso, início da semana e preferências operacionais.
- `workspace_invitations`: convite separado de membership, com e-mail normalizado, hash do token, expiração, aceite, cancelamento e versão.

## Trabalho

- `tasks`: entidade central, número atômico por workspace, status, tipo, produto, evento, prioridade, prazo, posição operacional semanal em `week_lane`, ordem manual do quadro em `board_position` e `version`.
- `task_assignees`: responsável primário (um por tarefa).
- `activity_logs`: histórico append-only com listagem sanitizada por RPC.
- `notifications`: caixa de notificações por usuário.
- `task_checklists` e `task_checklist_items`: grupos ordenados, itens e conclusão auditada.
- `task_subtasks`: relação pai–filha entre duas linhas de `tasks`; a tarefa filha preserva responsável, projeto, prazo, comentários, links e histórico próprios.
- `task_custom_field_definitions`, `task_custom_field_options` e `task_custom_field_values`: propriedades reutilizáveis por workspace e valores tipados por tarefa.
- `task_comments`: conversa em texto com exclusão lógica e corpo removido no tombstone.
- `task_links`: referências HTTPS da demanda, incluindo arquivos e mídia hospedados externamente, com autoria protegida.
- `task_attachments`: metadados de anexos privados da tarefa, com reserva, finalização, descrição versionada e remoção por lease. Objetos são isolados por workspace/tarefa no Supabase Storage.
- `v_task_overview`: leitura operacional das demandas, incluindo nomes de status, responsável, tipo, produto e evento.
- `create_global_task`: criação atômica de demanda com contexto opcional, descrição, responsável, prazo e motivo de bloqueio.

Seguidores e tags ligadas diretamente a demandas permanecem no escopo planejado e ainda não foram materializados.

## Modelo operacional de equipes

O contrato em `features/team/operating-model.ts` preserva `tasks` como entidade central. A migration local de fundação, ainda não publicada no Supabase hospedado, adiciona:

- `teams`, `team_members`, `job_functions` e `team_member_functions` para equipes e funções internas;
- `task_dependencies`, `task_approval_requests` e `task_handoffs` para prontidão, gates e passagem de responsabilidade;
- `team_id` e `requester_id` em `tasks`.

A fase seguinte permanece planejada e adicionará:

- `workflow_templates`, `workflow_template_steps` e `workflow_template_dependencies` para modelos versionados;
- `workflow_runs` para agrupar tarefas de uma execução ligada a produto ou evento;
- `task_followers` para pessoas informadas;
- `workflow_run_id` e `workflow_step_id` em `tasks`.

A fundação local usa FKs compostas com `workspace_id`, RLS forçada e RPCs versionadas. Nenhuma dessas novas estruturas está disponível na aplicação hospedada até a migration ser publicada e passar pelo smoke remoto.

## Recursos

- `resources`: referência externa HTTPS pertencente ao workspace, com tipo, descrição, categoria, restrição, versão e arquivamento lógico.
- `resource_categories`: catálogo ordenado por workspace, com nome e slug únicos entre categorias ativas.
- `resource_favorites`: favorito particular por usuário e recurso.
- `resource_visits`: última visita e contador particular usados pelo filtro de recentes.
- `resource_permissions`: acesso explícito `view` ou `edit` a recursos restritos.
- `tags`: catálogo disponível para classificação de recursos.
- `resource_tasks`, `resource_products`, `resource_events` e `resource_tags`: relações compostas que preservam o isolamento do workspace.

Recursos usam links externos. Anexos de tarefas usam task_attachments e bucket privado task-attachments, com descrição de até 1000 caracteres e version para edição otimista. `external_url` aceita somente HTTPS absoluto validado no cliente e no banco. A permissão de acesso ao arquivo continua sob responsabilidade do provedor externo.

## Catálogos

- `task_statuses` e `task_types` pertencem ao workspace.
- `products`: portfólio versionado com responsável, estado, descrição e participantes em `product_members`.
- `events`: operação versionada com produto, responsável, datas, objetivo, métrica, saúde e participantes em `event_members`.
- `event_milestones`: marcos ordenados, versionados e auditados de cada evento.
- Identificadores relacionados usam FKs compostas com `workspace_id` para impedir vínculos cruzados.

## API e automações

- `workspace_api_keys`: credenciais por workspace com prefixo, hash SHA-256,
  escopos, expiração, revogação, último uso e versão. O token bruto nunca é
  persistido.
- `workspace_automation_settings`: canais, domínio corporativo, allowlist de
  eventos e janela de agrupamento versionados por workspace.
- `workspace_webhook_endpoints`: destinos HTTPS e referência futura ao segredo
  de assinatura no Vault.
- `task_automation_events`: evento canônico e idempotente produzido junto com a
  mutação de tarefa, responsável ou comentário.
- `automation_deliveries`: estado e recibo de cada entrega por canal, sem acesso
  direto pelo cliente.

## Regras invariantes

### Configuração dos quadros de tarefas

- `task_board_settings` versiona a configuração de cada quadro por
  `workspace_id` e tipo (`status` ou `week`).
- `task_statuses.semantic_key` preserva a identidade funcional de uma coluna
  quando seu nome, cor, ícone ou posição muda.
- `task_week_lanes` guarda as faixas operacionais da Semana com metadados de
  apresentação e versão próprios.
- `task_status_week_lane_links` define automações direcionais ou bidirecionais
  entre status e faixas semanais. Emergência e Alterações são vínculos iniciais.
- `project_board_settings` e `project_board_columns` guardam a ordem e a
  apresentação do ciclo estável de Projetos (`planning`, `active`, `completed`
  e `cancelled`) sem permitir que um rótulo editável altere o valor de domínio.
- Leituras e mutações usam RPCs com escopo de workspace, RLS, locks e versões
  esperadas. A movimentação da tarefa continua passando pelas RPCs de `tasks`.

- Preferências de aparência, densidade, movimento e composição dos cards são locais ao dispositivo e isoladas pela dupla `user_id` + `workspace_id`; não representam dados de domínio nem contornam RLS.
- `workspace_preferences` é lida e atualizada pelas RPCs `get_workspace_settings` e `update_workspace_settings`. A atualização aceita `expected_version`, bloqueia a linha e é limitada a owner e admin.

- O perfil pertence à pessoa, não a um workspace. A própria pessoa pode editar
  somente a sua identidade pela RPC `update_own_profile`, usando `updated_at`
  como controle de concorrência; o e-mail continua sincronizado pelo Supabase
  Auth e não é editável por essa RPC.

- Arquivamento usa `archived_at`; registros históricos não são apagados na UI.
- Prazo sem hora: `due_date` preenchida e `due_time` nula.
- Contagem usa `workspace_counters` e bloqueio de linha em transação.
- Escritas de tarefa usam RPCs; a UI não calcula número nem versão.
- `create_task_subtask` cria a tarefa filha, sua atribuição e o vínculo com a tarefa pai na mesma transação. A relação repete `workspace_id`, aceita um único pai por filha e nunca cria uma segunda entidade de trabalho.
- O checklist possui uma seção padrão interna criada somente no primeiro passo. Nomear e criar seções adicionais é opcional; edições de títulos e itens usam `updated_at` como token de concorrência.
- Passos e seções podem ser removidos pelas RPCs `remove_task_checklist_item` e `remove_task_checklist`; a exclusão da seção remove seus itens pela FK com cascade e mantém o evento na auditoria.
- `unlink_task_subtask` remove apenas a relação pai–filha. A tarefa delegada continua sendo uma linha completa em `tasks`, com responsável, projeto, comentários, links e histórico preservados.
- Campos personalizados aceitam texto curto, número, data pura, sim/não e seleção única. Definições são limitadas a 12 ativas por workspace e valores atualizam a versão da tarefa.
- Mudanças de status e data feitas pela pipeline reutilizam as RPCs versionadas da entidade central.
- `move_task_in_week` posiciona a mesma tarefa em listas operacionais persistentes e exige a versão esperada. A lista `scheduled` usa `due_date`; `backlog` limpa data e horário sem convertê-los para UTC. As faixas `emergency` e `revision` compartilham estado com os status Emergência e Alterações do Quadro.
- `move_task_in_board` altera status e ordem manual de modo atômico, valida o `workspace_id`, a membership e a versão esperada, exige motivo ao entrar em bloqueio e rebalanceia posições fracionárias somente quando o intervalo numérico se esgota. `board_position` nunca altera `week_position`; apenas os pares Emergência/`emergency` e Alterações/`revision` sincronizam a classificação entre as duas visões.
- Descrições aceitam um documento JSON seguro com parágrafos, títulos, listas ordenadas e não ordenadas, checks, citações, links HTTPS, negrito, itálico, tachado, código inline e quebras de linha.
- Tabelas filhas repetem `workspace_id` e usam FKs compostas para impedir vínculos cruzados.
- Imagens, vídeos, áudios e outros arquivos são hospedados fora do Supabase. O banco guarda somente URL HTTPS e metadata textual necessária para exibição.
- Registros antigos de `task_attachments` não são apagados automaticamente. Qualquer exportação ou remoção definitiva depende de inventário e decisão explícita.
- Favoritos e visitas pertencem ao usuário autenticado e não são compartilhados com o workspace.
- Recursos restritos são visíveis para owner e admin, para o autor conforme a regra de edição e para usuários ativos com permissão explícita.
- Permissão `edit` é válida somente para manager ativo. Permissões de member e viewer são normalizadas para `view`.
- Owner e admin possuem acesso implícito e não são persistidos como permissões configuráveis.
- A busca global reutiliza os limites de visibilidade de cada entidade e não funciona como atalho para contornar RLS.
- O vetor FTS de recurso agrega categoria e relações ativas com demandas, produtos, eventos e tags, mantendo o índice GIN existente.
- Workspaces não arquivados mantêm exatamente um owner ativo. Transferências alteram os dois papéis na mesma transação e validam as duas versões.
- Suspensão e remoção de membership não apagam relações históricas. Uma remoção registra `removed_at` e `removed_by` e mantém o registro suspenso.
- Convites aceitos ou cancelados são terminais. Um token já consumido não reativa uma membership removida; a reativação por convite exige um novo token.

- Colunas semanais desativadas mantêm redirect_lane_key dentro do workspace; delete_week_board_column transfere tarefas e conexões transacionalmente. O trigger posterior à sincronização redireciona escritas antigas e defaults para um destino ativo. Datas e projeto permanecem na mesma tarefa.


## Operação por equipes — 28/09/2026

teams.workspace_event_id possui FK composta para events e unicidade por workspace. events.primary_team_id referencia teams. O vínculo interno é protegido e o nome acompanha teams.name; tarefas de contexto usam a mesma equipe.
