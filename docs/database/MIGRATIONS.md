# Catálogo numerado de migrations

Gerado por `node scripts/document-migrations.mjs`. Fonte: SQL versionado + histórico remoto consultado em 28/09/2026.

Leia primeiro [o roteiro de reprodução](README.md). 000 é preparação do ambiente; 001–047 são a sequência local de dependências sem API pendente; P01 é opcional, não integra o banco publicado. A sequência local não é a ordem histórica de publicação. Nenhuma das duas equivale a um replay certificado.

| Etapa | Migration                                                                                                                   | Versão remota     | Objetivo                                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 001   | [p0_core](../../supabase/migrations/20260822000100_p0_core.sql)                                                             | 20260822000100    | Núcleo multiworkspace: perfis, membros, catálogos, tarefas, responsáveis, histórico, notificações, RLS, RPCs e bootstrap local. |
| 002   | [history_rpc_hardening](../../supabase/migrations/20260822205006_history_rpc_hardening.sql)                                 | 20260822205006    | Restringe a leitura do histórico pela sessão e pelo workspace.                                                                  |
| 003   | [workspace_members_hardening](../../supabase/migrations/20260822205609_workspace_members_hardening.sql)                     | 20260822205609    | Restringe colunas e leitura de memberships do workspace.                                                                        |
| 004   | [task_due_at_overview](../../supabase/migrations/20260822205610_task_due_at_overview.sql)                                   | 20260822205610    | Inclui o horário de conclusão na visão operacional de tarefas.                                                                  |
| 005   | [task_collaboration](../../supabase/migrations/20260822212526_task_collaboration.sql)                                       | 20260822212526    | Checklists, itens, comentários, links e colaboração autorizada.                                                                 |
| 006   | [task_collaboration_followup](../../supabase/migrations/20260822213713_task_collaboration_followup.sql)                     | 20260822213713    | Evolui comentários e operações de colaboração existentes.                                                                       |
| 007   | [resources_search](../../supabase/migrations/20260822220538_resources_search.sql)                                           | 20260822220538    | Central de recursos e busca global com isolamento por workspace.                                                                |
| 008   | [task_collaboration_review_fixes](../../supabase/migrations/20260822220539_task_collaboration_review_fixes.sql)             | 20260822220539    | Corrige contratos e autorização das leituras de colaboração.                                                                    |
| 009   | [task_collaboration_realtime_hardening](../../supabase/migrations/20260822223702_task_collaboration_realtime_hardening.sql) | 20260822223702    | Fortalece vínculos de colaboração e notificações Realtime.                                                                      |
| 010   | [resources_permissions_categories](../../supabase/migrations/20260822223746_resources_permissions_categories.sql)           | 20260822223746    | Protege recursos restritos e criação de categorias.                                                                             |
| 011   | [search_prefix](../../supabase/migrations/20260822223748_search_prefix.sql)                                                 | 20260822223748    | Busca textual por prefixo dentro do workspace autorizado.                                                                       |
| 012   | [resource_relations_categories](../../supabase/migrations/20260822235316_resource_relations_categories.sql)                 | 20260822235316    | Relações de recursos com tarefas, produtos, eventos e tags; gestão de categorias.                                               |
| 013   | [task_attachments_storage](../../supabase/migrations/20260822235318_task_attachments_storage.sql)                           | 20260822235318    | Anexos privados, bucket task-attachments e autorização de upload/leitura.                                                       |
| 014   | [events_products_operational](../../supabase/migrations/20260822235321_events_products_operational.sql)                     | 20260822235321    | Produtos, eventos, participantes, marcos e RPCs operacionais versionadas.                                                       |
| 015   | [workspace_team_activation](../../supabase/migrations/20260823003447_workspace_team_activation.sql)                         | 20260823003447    | Convites seguros e ciclo administrativo de membros do workspace.                                                                |
| 016   | [global_task_context](../../supabase/migrations/20260823010000_global_task_context.sql)                                     | 20260823010000    | Criação global de tarefa e contexto de leitura das visões operacionais.                                                         |
| 017   | [team_operating_model_foundation](../../supabase/migrations/20260824090000_team_operating_model_foundation.sql)             | 20260926213913    | Equipes, funções, participantes, dependências, aprovações e handoffs.                                                           |
| 018   | [external_media_links_rich_text](../../supabase/migrations/20260825090000_external_media_links_rich_text.sql)               | 20260825090000    | Descrição rica e política histórica de mídia externa; uploads são reativados posteriormente.                                    |
| 019   | [task_overview_card_metrics](../../supabase/migrations/20260825103000_task_overview_card_metrics.sql)                       | 20260825103000    | Contadores de colaboração usados nos cards de tarefas.                                                                          |
| 020   | [task_overview_description_preview](../../supabase/migrations/20260825110000_task_overview_description_preview.sql)         | 20260825110000    | Resumo textual curto de descrição na visão de tarefas.                                                                          |
| 021   | [week_board_operational_lanes](../../supabase/migrations/20260825123000_week_board_operational_lanes.sql)                   | 20260825123000    | Faixas operacionais persistentes e movimentação no quadro semanal.                                                              |
| 022   | [task_context_updates](../../supabase/migrations/20260825140000_task_context_updates.sql)                                   | 20260926213923    | Edição do contexto da tarefa mantendo isolamento e versão.                                                                      |
| 023   | [task_custom_fields](../../supabase/migrations/20260924193000_task_custom_fields.sql)                                       | 20260926213925    | Definições, opções e valores de campos personalizados.                                                                          |
| 024   | [task_steps_and_subtasks](../../supabase/migrations/20260924213000_task_steps_and_subtasks.sql)                             | 20260926213927    | Passos de checklist e tarefas delegadas completas.                                                                              |
| 025   | [profile_identity](../../supabase/migrations/20260925103000_profile_identity.sql)                                           | 20260926213930    | Edição do próprio perfil com controle de concorrência.                                                                          |
| 026   | [workspace_settings](../../supabase/migrations/20260925120000_workspace_settings.sql)                                       | 20260926213933    | Preferências e identidade do workspace versionadas.                                                                             |
| 027   | [task_board_ordering](../../supabase/migrations/20260925130000_task_board_ordering.sql)                                     | 20260926201948    | Ordenação manual persistente no Kanban por status.                                                                              |
| 028   | [task_steps_management](../../supabase/migrations/20260925150000_task_steps_management.sql)                                 | 20260926213939    | Edição/exclusão de passos e desvinculação segura de tarefas delegadas.                                                          |
| 029   | [project_timeline_planning](../../supabase/migrations/20260926170000_project_timeline_planning.sql)                         | 20260926201953    | Fases, intervalos de datas e movimentação/redimensionamento no cronograma.                                                      |
| 030   | [project_timeline_milestone_management](../../supabase/migrations/20260926171000_project_timeline_milestone_management.sql) | 20260926201959    | Criação, edição, exclusão e posicionamento de marcos versionados.                                                               |
| 031   | [link_board_week_special_lanes](../../supabase/migrations/20260926180000_link_board_week_special_lanes.sql)                 | 20260926213943    | Sincronização inicial de faixas especiais entre Kanban e Semana.                                                                |
| 032   | [configurable_task_boards](../../supabase/migrations/20260926210000_configurable_task_boards.sql)                           | 20260926212351    | Colunas configuráveis, chaves semânticas e conexões entre quadros.                                                              |
| 033   | [task_card_archive](../../supabase/migrations/20260926220000_task_card_archive.sql)                                         | 20260926212840    | Arquivamento e restauração de tarefa pela ação do card.                                                                         |
| 034   | [board_connection_conflicts](../../supabase/migrations/20260926221000_board_connection_conflicts.sql)                       | 20260926213022    | Impede conexões conflitantes entre status e faixas semanais.                                                                    |
| 035   | [security_advisor_hardening](../../supabase/migrations/20260926223000_security_advisor_hardening.sql)                       | 20260926214344    | Revoga execução cliente de public.rls_auto_enable; exige essa função do ambiente.                                               |
| 036   | [task_board_column_lifecycle](../../supabase/migrations/20260926230000_task_board_column_lifecycle.sql)                     | 20260926221412    | Cria/edita/remove colunas transferindo tarefas para um destino.                                                                 |
| 037   | [restore_configured_board_sync](../../supabase/migrations/20260926231000_restore_configured_board_sync.sql)                 | 20260926221644    | Restaura sincronização por configurações em vez de nomes legados.                                                               |
| 038   | [week_column_lifecycle](../../supabase/migrations/20260926233000_week_column_lifecycle.sql)                                 | 20260927012520    | Exclusão de faixas semanais com destino de redirecionamento.                                                                    |
| P01   | [api_automation_foundation](../../supabase/migrations/20260927130000_api_automation_foundation.sql)                         | **Não publicada** | Fundação NÃO publicada: chaves de API, Vault, outbox, entregas, Cron e integrações.                                             |
| 039   | [task_media_descriptions](../../supabase/migrations/20260927234152_task_media_descriptions.sql)                             | 20260927234152    | Descrições em links/anexos e reativação de upload de mídia privada.                                                             |
| 040   | [task_media_description_realtime](../../supabase/migrations/20260927235815_task_media_description_realtime.sql)             | 20260927235815    | Emite atualização privada ao editar descrição do anexo.                                                                         |
| 041   | [team_project_navigation](../../supabase/migrations/20260928144358_team_project_navigation.sql)                             | 20260928144358    | Vínculo equipe–evento e diretório de equipes.                                                                                   |
| 042   | [team_workspace_context](../../supabase/migrations/20260928145333_team_workspace_context.sql)                               | 20260928145333    | Área de trabalho interna por equipe e criação/arquivamento atômicos.                                                            |
| 043   | [team_context_name_sync](../../supabase/migrations/20260928145850_team_context_name_sync.sql)                               | 20260928145850    | Sincroniza nome da equipe com seu contexto interno.                                                                             |
| 044   | [team_membership_visibility](../../supabase/migrations/20260928150025_team_membership_visibility.sql)                       | 20260928150025    | Visibilidade apenas para participantes, inclusive administradores.                                                              |
| 045   | [team_private_read_rpcs](../../supabase/migrations/20260928150110_team_private_read_rpcs.sql)                               | 20260928150110    | Filtra RPCs SECURITY DEFINER antes de agregação e paginação.                                                                    |
| 046   | [team_operating_model_visibility](../../supabase/migrations/20260928150247_team_operating_model_visibility.sql)             | 20260928150247    | Restringe o modelo operacional às equipes permitidas.                                                                           |
| 047   | [team_mutation_privacy](../../supabase/migrations/20260928150328_team_mutation_privacy.sql)                                 | 20260928150328    | Protege escritas, Storage e Realtime pela participação na equipe.                                                               |

## Contratos e rastreabilidade por migration

Todos os passos publicados dependem do acumulado anterior na sequência local. Funções redefinidas posteriormente substituem versões antigas: não reaplique um passo isolado no banco atual. A lista de objetos abaixo é um índice textual dos CREATEs, não um parser SQL; ALTERs, grants e políticas devem ser lidos no arquivo completo.

### 001 — p0_core

Núcleo multiworkspace: perfis, membros, catálogos, tarefas, responsáveis, histórico, notificações, RLS, RPCs e bootstrap local.

- SQL: [20260822000100_p0_core.sql](../../supabase/migrations/20260822000100_p0_core.sql).
- Histórico: publicada como `20260822000100`, posição remota 1.
- Comparação textual: `different_text_review_required`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `private.runtime_flags`, `public.workspace_role`, `public.membership_status`, `public.task_status_category`, `public.task_priority`, `public.profiles`, `public.workspaces`, `public.workspace_members`, `public.workspace_invitations`, `public.workspace_preferences`, `public.task_statuses`, `public.task_types`, `public.products`, `public.events`, `public.workspace_counters`, `public.tasks`, `public.task_assignees`, `public.activity_logs`, `public.notifications`, `private.set_updated_at`, `private.sync_auth_profile`, `private.is_active_workspace_member`, `private.current_workspace_role`, `private.shares_active_workspace`, `private.can_create_tasks`, `private.can_edit_task`, `private.next_task_number`, `private.tasks_before_write`, `private.tasks_after_write`, `private.assignees_after_write`, `private.prevent_activity_mutation`, `public.bootstrap_user_workspace`, `public.create_task`, `public.update_task`, `public.set_task_primary_assignee`, `public.move_task_to_day`, `public.v_task_overview`, `public.get_task_detail`.

### 002 — history_rpc_hardening

Restringe a leitura do histórico pela sessão e pelo workspace.

- SQL: [20260822205006_history_rpc_hardening.sql](../../supabase/migrations/20260822205006_history_rpc_hardening.sql).
- Histórico: publicada como `20260822205006`, posição remota 2.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.list_task_activity`.

### 003 — workspace_members_hardening

Restringe colunas e leitura de memberships do workspace.

- SQL: [20260822205609_workspace_members_hardening.sql](../../supabase/migrations/20260822205609_workspace_members_hardening.sql).
- Histórico: publicada como `20260822205609`, posição remota 3.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.list_team_members`.

### 004 — task_due_at_overview

Inclui o horário de conclusão na visão operacional de tarefas.

- SQL: [20260822205610_task_due_at_overview.sql](../../supabase/migrations/20260822205610_task_due_at_overview.sql).
- Histórico: publicada como `20260822205610`, posição remota 4.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.v_task_overview`.

### 005 — task_collaboration

Checklists, itens, comentários, links e colaboração autorizada.

- SQL: [20260822212526_task_collaboration.sql](../../supabase/migrations/20260822212526_task_collaboration.sql).
- Histórico: publicada como `20260822212526`, posição remota 5.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.task_checklists`, `public.task_checklist_items`, `public.task_comments`, `public.task_links`, `private.preserve_task_collaboration_authorship`, `private.task_collaboration_role`, `private.is_valid_task_description`, `private.task_collaboration_payload`, `public.get_task_detail`, `public.update_task_description`, `public.create_task_checklist`, `public.add_task_checklist_item`, `public.toggle_task_checklist_item`, `public.add_task_comment`, `public.delete_task_comment`, `public.add_task_link`, `public.update_task_link`, `public.remove_task_link`.

### 006 — task_collaboration_followup

Evolui comentários e operações de colaboração existentes.

- SQL: [20260822213713_task_collaboration_followup.sql](../../supabase/migrations/20260822213713_task_collaboration_followup.sql).
- Histórico: publicada como `20260822213713`, posição remota 6.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `private.task_link_provider`, `public.list_task_comments`, `private.task_collaboration_payload`, `public.add_task_comment`, `public.update_task_comment`, `public.delete_task_comment`, `public.add_task_link`, `public.update_task_link`, `public.remove_task_link`, `private.task_collaboration_activity`.

### 007 — resources_search

Central de recursos e busca global com isolamento por workspace.

- SQL: [20260822220538_resources_search.sql](../../supabase/migrations/20260822220538_resources_search.sql).
- Histórico: publicada como `20260822220538`, posição remota 7.
- Comparação textual: `different_text_review_required`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.resource_type`, `public.resource_permission_level`, `public.resource_categories`, `public.tags`, `public.resources`, `public.resource_tasks`, `public.resource_products`, `public.resource_events`, `public.resource_tags`, `public.resource_permissions`, `public.resource_favorites`, `public.resource_visits`, `private.is_valid_resource_url`, `private.resource_search_vector`, `private.resources_before_write`, `private.resource_activity_after_write`, `private.products_search_before_write`, `private.events_search_before_write`, `private.profiles_search_before_write`, `private.tasks_search_before_write`, `private.can_view_resource`, `private.can_edit_resource`, `private.jsonb_uuid_array`, `private.replace_resource_relations`, `public.list_resources`, `public.get_resource_detail`, `public.create_resource`, `public.update_resource`, `public.archive_resource`, `public.set_resource_favorite`, `public.record_resource_visit`, `public.search_workspace`.

### 008 — task_collaboration_review_fixes

Corrige contratos e autorização das leituras de colaboração.

- SQL: [20260822220539_task_collaboration_review_fixes.sql](../../supabase/migrations/20260822220539_task_collaboration_review_fixes.sql).
- Histórico: publicada como `20260822220539`, posição remota 8.
- Comparação textual: `different_text_review_required`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.list_task_comments`, `public.update_task_comment`.

### 009 — task_collaboration_realtime_hardening

Fortalece vínculos de colaboração e notificações Realtime.

- SQL: [20260822223702_task_collaboration_realtime_hardening.sql](../../supabase/migrations/20260822223702_task_collaboration_realtime_hardening.sql).
- Histórico: publicada como `20260822223702`, posição remota 9.
- Comparação textual: `different_text_review_required`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `private.task_link_provider`, `public.remove_task_link`.

### 010 — resources_permissions_categories

Protege recursos restritos e criação de categorias.

- SQL: [20260822223746_resources_permissions_categories.sql](../../supabase/migrations/20260822223746_resources_permissions_categories.sql).
- Histórico: publicada como `20260822223746`, posição remota 10.
- Comparação textual: `different_text_review_required`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `private.guard_resource_restriction`, `public.create_resource_category`.

### 011 — search_prefix

Busca textual por prefixo dentro do workspace autorizado.

- SQL: [20260822223748_search_prefix.sql](../../supabase/migrations/20260822223748_search_prefix.sql).
- Histórico: publicada como `20260822223748`, posição remota 11.
- Comparação textual: `different_text_review_required`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.search_workspace`.

### 012 — resource_relations_categories

Relações de recursos com tarefas, produtos, eventos e tags; gestão de categorias.

- SQL: [20260822235316_resource_relations_categories.sql](../../supabase/migrations/20260822235316_resource_relations_categories.sql).
- Histórico: publicada como `20260822235316`, posição remota 12.
- Comparação textual: `different_text_review_required`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `private.resource_search_vector_v2`, `private.lock_resource_category_write`, `private.resources_before_write`, `private.resource_activity_after_write`, `private.refresh_resource_search_vector`, `private.resource_relation_search_after_write`, `private.resource_catalog_search_after_write`, `public.update_resource`, `public.archive_resource`, `public.search_resource_relation_options`, `public.create_resource_tag`, `private.resource_categories_snapshot`, `public.list_resource_categories`, `public.update_resource_category`, `public.archive_resource_category`, `public.reorder_resource_categories`.

### 013 — task_attachments_storage

Anexos privados, bucket task-attachments e autorização de upload/leitura.

- SQL: [20260822235318_task_attachments_storage.sql](../../supabase/migrations/20260822235318_task_attachments_storage.sql).
- Histórico: publicada como `20260822235318`, posição remota 13.
- Comparação textual: `different_text_review_required`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.task_attachment_state`, `private.is_valid_task_attachment_type`, `public.task_attachments`, `private.preserve_task_attachment_identity`, `private.can_read_task_attachment_object`, `private.can_read_task_attachment_metadata`, `private.can_upload_task_attachment_object`, `private.can_delete_task_attachment_object`, `public.list_task_attachments`, `public.prepare_task_attachment`, `public.complete_task_attachment`, `public.begin_remove_task_attachment`, `public.cancel_task_attachment_removal`, `public.finalize_remove_task_attachment`, `private.task_attachment_activity`.

### 014 — events_products_operational

Produtos, eventos, participantes, marcos e RPCs operacionais versionadas.

- SQL: [20260822235321_events_products_operational.sql](../../supabase/migrations/20260822235321_events_products_operational.sql).
- Histórico: publicada como `20260822235321`, posição remota 14.
- Comparação textual: `different_text_review_required`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.product_members`, `public.event_members`, `public.event_milestones`, `private.portfolio_can_manage`, `private.portfolio_member_is_active`, `private.portfolio_slug`, `private.event_health`, `private.portfolio_members_valid`, `private.products_before_write`, `private.events_before_write`, `private.event_milestones_before_write`, `public.list_products_operational`, `public.list_events_operational`, `public.get_product_operational`, `public.get_event_operational`, `public.create_product_operational`, `public.update_product_operational`, `public.create_event_operational`, `public.update_event_operational`, `public.create_event_milestone`, `public.toggle_event_milestone`, `public.create_context_task`.

### 015 — workspace_team_activation

Convites seguros e ciclo administrativo de membros do workspace.

- SQL: [20260823003447_workspace_team_activation.sql](../../supabase/migrations/20260823003447_workspace_team_activation.sql).
- Histórico: publicada como `20260823003447`, posição remota 15.
- Comparação textual: `different_text_review_required`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `private.workspace_members_before_update`, `private.workspace_invitations_before_update`, `private.enforce_workspace_active_owner`, `private.enforce_profile_active_ownership`, `private.workspace_member_management_json`, `private.workspace_invitation_management_json`, `public.list_workspace_team_management`, `public.create_workspace_invitation`, `public.cancel_workspace_invitation`, `public.inspect_workspace_invitation`, `public.accept_workspace_invitation`, `public.change_workspace_member_role`, `public.suspend_workspace_member`, `public.reactivate_workspace_member`, `public.remove_workspace_member`, `public.transfer_workspace_ownership`.

### 016 — global_task_context

Criação global de tarefa e contexto de leitura das visões operacionais.

- SQL: [20260823010000_global_task_context.sql](../../supabase/migrations/20260823010000_global_task_context.sql).
- Histórico: publicada como `20260823010000`, posição remota 16.
- Comparação textual: `history_sql_absent`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.v_task_overview`, `public.create_global_task`.

### 017 — team_operating_model_foundation

Equipes, funções, participantes, dependências, aprovações e handoffs.

- SQL: [20260824090000_team_operating_model_foundation.sql](../../supabase/migrations/20260824090000_team_operating_model_foundation.sql).
- Histórico: publicada como `20260926213913`, posição remota 27.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.team_member_role`, `public.task_approval_decision`, `public.task_handoff_status`, `public.teams`, `public.team_members`, `public.job_functions`, `public.team_member_functions`, `public.task_dependencies`, `public.task_approval_requests`, `public.task_handoffs`, `private.teams_before_update`, `private.team_members_before_update`, `private.job_functions_before_update`, `private.team_member_functions_before_update`, `private.task_dependencies_before_write`, `private.task_approval_requests_before_write`, `private.task_handoffs_before_write`, `private.tasks_operating_model_guard`, `private.task_assignees_team_guard`, `private.ensure_workspace_operating_model`, `private.current_team_role`, `private.can_manage_operating_model`, `private.can_manage_team_members`, `private.is_current_user_team_lead`, `public.list_workspace_operating_model`, `public.create_operating_team`, `public.update_operating_team`, `public.archive_operating_team`, `public.upsert_team_member`, `public.remove_team_member`, `public.save_job_function`, `public.archive_job_function`, `public.set_team_member_functions`.

### 018 — external_media_links_rich_text

Descrição rica e política histórica de mídia externa; uploads são reativados posteriormente.

- SQL: [20260825090000_external_media_links_rich_text.sql](../../supabase/migrations/20260825090000_external_media_links_rich_text.sql).
- Histórico: publicada como `20260825090000`, posição remota 17.
- Comparação textual: `history_sql_absent`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `private.jsonb_has_only_keys`, `private.is_valid_task_description_mark`, `private.is_valid_task_description_node`, `private.is_valid_task_description`.

### 019 — task_overview_card_metrics

Contadores de colaboração usados nos cards de tarefas.

- SQL: [20260825103000_task_overview_card_metrics.sql](../../supabase/migrations/20260825103000_task_overview_card_metrics.sql).
- Histórico: publicada como `20260825103000`, posição remota 18.
- Comparação textual: `history_sql_absent`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.v_task_overview`.

### 020 — task_overview_description_preview

Resumo textual curto de descrição na visão de tarefas.

- SQL: [20260825110000_task_overview_description_preview.sql](../../supabase/migrations/20260825110000_task_overview_description_preview.sql).
- Histórico: publicada como `20260825110000`, posição remota 19.
- Comparação textual: `history_sql_absent`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.v_task_overview`.

### 021 — week_board_operational_lanes

Faixas operacionais persistentes e movimentação no quadro semanal.

- SQL: [20260825123000_week_board_operational_lanes.sql](../../supabase/migrations/20260825123000_week_board_operational_lanes.sql).
- Histórico: publicada como `20260825123000`, posição remota 20.
- Comparação textual: `history_placeholder`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.move_task_in_week`, `public.v_task_overview`.

### 022 — task_context_updates

Edição do contexto da tarefa mantendo isolamento e versão.

- SQL: [20260825140000_task_context_updates.sql](../../supabase/migrations/20260825140000_task_context_updates.sql).
- Histórico: publicada como `20260926213923`, posição remota 28.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.update_task`, `private.tasks_after_write`.

### 023 — task_custom_fields

Definições, opções e valores de campos personalizados.

- SQL: [20260924193000_task_custom_fields.sql](../../supabase/migrations/20260924193000_task_custom_fields.sql).
- Histórico: publicada como `20260926213925`, posição remota 29.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.task_custom_field_type`, `public.task_custom_field_definitions`, `public.task_custom_field_options`, `public.task_custom_field_values`, `public.create_task_custom_field`, `public.set_task_custom_field_value`, `public.get_task_detail`.

### 024 — task_steps_and_subtasks

Passos de checklist e tarefas delegadas completas.

- SQL: [20260924213000_task_steps_and_subtasks.sql](../../supabase/migrations/20260924213000_task_steps_and_subtasks.sql).
- Histórico: publicada como `20260926213927`, posição remota 30.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.task_subtasks`, `public.add_task_checklist_item_to_task`, `public.update_task_checklist`, `public.update_task_checklist_item`, `public.create_task_subtask`, `private.task_collaboration_payload`, `public.get_task_detail`.

### 025 — profile_identity

Edição do próprio perfil com controle de concorrência.

- SQL: [20260925103000_profile_identity.sql](../../supabase/migrations/20260925103000_profile_identity.sql).
- Histórico: publicada como `20260926213930`, posição remota 31.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.update_own_profile`.

### 026 — workspace_settings

Preferências e identidade do workspace versionadas.

- SQL: [20260925120000_workspace_settings.sql](../../supabase/migrations/20260925120000_workspace_settings.sql).
- Histórico: publicada como `20260926213933`, posição remota 32.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.get_workspace_settings`, `public.update_workspace_settings`.

### 027 — task_board_ordering

Ordenação manual persistente no Kanban por status.

- SQL: [20260925130000_task_board_ordering.sql](../../supabase/migrations/20260925130000_task_board_ordering.sql).
- Histórico: publicada como `20260926201948`, posição remota 21.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.move_task_in_board`, `public.v_task_overview`.

### 028 — task_steps_management

Edição/exclusão de passos e desvinculação segura de tarefas delegadas.

- SQL: [20260925150000_task_steps_management.sql](../../supabase/migrations/20260925150000_task_steps_management.sql).
- Histórico: publicada como `20260926213939`, posição remota 33.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.remove_task_checklist_item`, `public.remove_task_checklist`, `public.unlink_task_subtask`.

### 029 — project_timeline_planning

Fases, intervalos de datas e movimentação/redimensionamento no cronograma.

- SQL: [20260926170000_project_timeline_planning.sql](../../supabase/migrations/20260926170000_project_timeline_planning.sql).
- Histórico: publicada como `20260926201953`, posição remota 22.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.event_phases`, `private.event_phases_before_write`, `public.create_event_phase`, `public.update_event_phase`, `public.archive_event_phase`, `public.create_event_milestone_in_phase`, `public.move_event_milestone_in_timeline`, `public.move_task_in_timeline`, `public.get_project_timeline`.

### 030 — project_timeline_milestone_management

Criação, edição, exclusão e posicionamento de marcos versionados.

- SQL: [20260926171000_project_timeline_milestone_management.sql](../../supabase/migrations/20260926171000_project_timeline_milestone_management.sql).
- Histórico: publicada como `20260926201959`, posição remota 23.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.update_event_milestone`, `public.delete_event_milestone`.

### 031 — link_board_week_special_lanes

Sincronização inicial de faixas especiais entre Kanban e Semana.

- SQL: [20260926180000_link_board_week_special_lanes.sql](../../supabase/migrations/20260926180000_link_board_week_special_lanes.sql).
- Histórico: publicada como `20260926213943`, posição remota 34.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `private.sync_task_special_lanes`.

### 032 — configurable_task_boards

Colunas configuráveis, chaves semânticas e conexões entre quadros.

- SQL: [20260926210000_configurable_task_boards.sql](../../supabase/migrations/20260926210000_configurable_task_boards.sql).
- Histórico: publicada como `20260926212351`, posição remota 24.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.task_board_settings`, `public.task_week_lanes`, `public.task_status_week_lane_links`, `public.project_board_settings`, `public.project_board_columns`, `private.task_status_configuration_defaults`, `private.task_week_lane_configuration_version`, `private.project_board_column_configuration_version`, `private.seed_task_board_configuration`, `private.seed_task_status_week_lane_link`, `private.sync_task_special_lanes`, `public.get_task_board_configuration`, `public.update_task_board_column`, `public.reorder_task_board_columns`, `public.set_task_board_lane_link`, `public.get_project_board_configuration`, `public.update_project_board_column`, `public.reorder_project_board_columns`.

### 033 — task_card_archive

Arquivamento e restauração de tarefa pela ação do card.

- SQL: [20260926220000_task_card_archive.sql](../../supabase/migrations/20260926220000_task_card_archive.sql).
- Histórico: publicada como `20260926212840`, posição remota 25.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.set_task_card_archived`.

### 034 — board_connection_conflicts

Impede conexões conflitantes entre status e faixas semanais.

- SQL: [20260926221000_board_connection_conflicts.sql](../../supabase/migrations/20260926221000_board_connection_conflicts.sql).
- Histórico: publicada como `20260926213022`, posição remota 26.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.set_task_board_lane_link`.

### 035 — security_advisor_hardening

Revoga execução cliente de public.rls_auto_enable; exige essa função do ambiente.

- SQL: [20260926223000_security_advisor_hardening.sql](../../supabase/migrations/20260926223000_security_advisor_hardening.sql).
- Histórico: publicada como `20260926214344`, posição remota 35.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: ajustes em objetos existentes; consulte o SQL.

### 036 — task_board_column_lifecycle

Cria/edita/remove colunas transferindo tarefas para um destino.

- SQL: [20260926230000_task_board_column_lifecycle.sql](../../supabase/migrations/20260926230000_task_board_column_lifecycle.sql).
- Histórico: publicada como `20260926221412`, posição remota 36.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.manage_task_board_column`, `public.connect_week_board_column`.

### 037 — restore_configured_board_sync

Restaura sincronização por configurações em vez de nomes legados.

- SQL: [20260926231000_restore_configured_board_sync.sql](../../supabase/migrations/20260926231000_restore_configured_board_sync.sql).
- Histórico: publicada como `20260926221644`, posição remota 37.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `private.sync_task_special_lanes`.

### 038 — week_column_lifecycle

Exclusão de faixas semanais com destino de redirecionamento.

- SQL: [20260926233000_week_column_lifecycle.sql](../../supabase/migrations/20260926233000_week_column_lifecycle.sql).
- Histórico: publicada como `20260927012520`, posição remota 38.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `private.route_retired_week_lane`, `public.delete_week_board_column`.

### P01 — api_automation_foundation

Fundação NÃO publicada: chaves de API, Vault, outbox, entregas, Cron e integrações.

- SQL: [20260927130000_api_automation_foundation.sql](../../supabase/migrations/20260927130000_api_automation_foundation.sql).
- Histórico: não publicada; fora da reprodução do ambiente funcional.
- Comparação textual: `not_published`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.automation_delivery_channel`, `public.automation_delivery_status`, `public.workspace_integration_provider`, `public.workspace_integration_status`, `public.workspace_api_keys`, `public.workspace_automation_settings`, `public.workspace_webhook_endpoints`, `public.workspace_integrations`, `public.task_automation_events`, `public.automation_deliveries`, `private.require_workspace_admin`, `public.list_workspace_api_keys`, `public.create_workspace_api_key`, `public.revoke_workspace_api_key`, `public.get_workspace_automation_settings`, `public.list_workspace_integrations`, `public.configure_workspace_integration`, `public.update_workspace_automation_settings`, `private.authenticate_workspace_api_key`, `private.assume_api_actor`, `public.api_list_tasks`, `public.api_get_task`, `public.api_create_task`, `public.api_update_task`, `public.api_set_task_assignee`, `public.api_add_task_comment`, `private.enqueue_task_automation_event`, `public.claim_automation_deliveries`, `public.complete_automation_delivery`, `private.invoke_automation_dispatcher`, `private.tasks_enqueue_automation`, `private.assignees_enqueue_automation`, `private.comments_enqueue_automation`.

### 039 — task_media_descriptions

Descrições em links/anexos e reativação de upload de mídia privada.

- SQL: [20260927234152_task_media_descriptions.sql](../../supabase/migrations/20260927234152_task_media_descriptions.sql).
- Histórico: publicada como `20260927234152`, posição remota 39.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.save_task_link_with_description`, `public.prepare_task_media`, `public.update_task_media_description`, `private.is_valid_task_attachment_type`.

### 040 — task_media_description_realtime

Emite atualização privada ao editar descrição do anexo.

- SQL: [20260927235815_task_media_description_realtime.sql](../../supabase/migrations/20260927235815_task_media_description_realtime.sql).
- Histórico: publicada como `20260927235815`, posição remota 40.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.update_task_media_description`.

### 041 — team_project_navigation

Vínculo equipe–evento e diretório de equipes.

- SQL: [20260928144358_team_project_navigation.sql](../../supabase/migrations/20260928144358_team_project_navigation.sql).
- Histórico: publicada como `20260928144358`, posição remota 41.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `private.guard_project_team`, `private.guard_team_project_archive`, `public.list_team_directory`, `public.list_team_projects`, `public.set_project_team`, `public.create_team_project`.

### 042 — team_workspace_context

Área de trabalho interna por equipe e criação/arquivamento atômicos.

- SQL: [20260928145333_team_workspace_context.sql](../../supabase/migrations/20260928145333_team_workspace_context.sql).
- Histórico: publicada como `20260928145333`, posição remota 42.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `private.guard_team_workspace_event`, `private.guard_team_context_event`, `private.guard_team_project_archive`, `private.archive_team_context_event`, `public.create_operating_team_workspace`, `public.archive_team_workspace`, `public.list_team_directory`.

### 043 — team_context_name_sync

Sincroniza nome da equipe com seu contexto interno.

- SQL: [20260928145850_team_context_name_sync.sql](../../supabase/migrations/20260928145850_team_context_name_sync.sql).
- Histórico: publicada como `20260928145850`, posição remota 43.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `private.sync_team_context_name`.

### 044 — team_membership_visibility

Visibilidade apenas para participantes, inclusive administradores.

- SQL: [20260928150025_team_membership_visibility.sql](../../supabase/migrations/20260928150025_team_membership_visibility.sql).
- Histórico: publicada como `20260928150025`, posição remota 44.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `private.can_read_team`, `private.can_read_event`, `private.can_read_task`, `private.can_read_domain_entity`, `public.list_team_directory`, `public.list_team_projects`.

### 045 — team_private_read_rpcs

Filtra RPCs SECURITY DEFINER antes de agregação e paginação.

- SQL: [20260928150110_team_private_read_rpcs.sql](../../supabase/migrations/20260928150110_team_private_read_rpcs.sql).
- Histórico: publicada como `20260928150110`, posição remota 45.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.get_event_operational`, `public.get_product_operational`, `public.get_project_timeline`, `public.get_resource_detail`, `public.get_task_detail`, `public.list_events_operational`, `public.list_products_operational`, `public.list_task_activity`, `public.list_task_attachments`, `public.list_task_comments`, `public.search_resource_relation_options`, `public.search_workspace`.

### 046 — team_operating_model_visibility

Restringe o modelo operacional às equipes permitidas.

- SQL: [20260928150247_team_operating_model_visibility.sql](../../supabase/migrations/20260928150247_team_operating_model_visibility.sql).
- Histórico: publicada como `20260928150247`, posição remota 46.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `public.list_workspace_operating_model`.

### 047 — team_mutation_privacy

Protege escritas, Storage e Realtime pela participação na equipe.

- SQL: [20260928150328_team_mutation_privacy.sql](../../supabase/migrations/20260928150328_team_mutation_privacy.sql).
- Histórico: publicada como `20260928150328`, posição remota 47.
- Comparação textual: `matches_ignoring_whitespace`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.
- Objetos declarados: `private.can_edit_task`, `private.task_collaboration_role`, `private.guard_team_context_write`, `private.task_team_workspace_context`.

## Atualização

Após uma nova publicação, atualize o snapshot remoto e o script para sua data, inclua a descrição e regenere este catálogo e o manifesto. Preserve snapshots anteriores como evidência histórica. SHA-256 normaliza CRLF/LF; a comparação MD5 ignora whitespace e serve só para triagem, não para validar SQL semanticamente.
