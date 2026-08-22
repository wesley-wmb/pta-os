# Modelo de dados

## Núcleo de tenancy

- `profiles`: extensão 1:1 de `auth.users`.
- `workspaces`: unidade de isolamento.
- `workspace_members`: papel e estado da participação.
- `workspace_preferences`: fuso, início da semana e preferências operacionais.
- `workspace_invitations`: convite separado de membership.

## Trabalho

- `tasks`: entidade central, número atômico por workspace, status, tipo, produto, evento, prioridade, prazo e `version`.
- `task_assignees`: responsável primário (um por tarefa).
- `task_watchers`, `task_checklists`, `task_checklist_items`, `task_comments`, `task_links`, `task_attachments`.
- `tags` e `task_tags`.
- `task_activity`: histórico append-only.
- `notifications`: caixa de notificações por usuário.

## Catálogos

- `task_statuses`, `task_types`, `products`, `events` pertencem ao workspace.
- Identificadores relacionados usam FKs compostas com `workspace_id` para impedir vínculos cruzados.

## Regras invariantes

- Arquivamento usa `archived_at`; registros históricos não são apagados na UI.
- Prazo sem hora: `due_date` preenchida e `due_time` nula.
- Contagem usa `workspace_counters` e bloqueio de linha em transação.
- Escritas de tarefa usam RPCs; a UI não calcula número nem versão.
