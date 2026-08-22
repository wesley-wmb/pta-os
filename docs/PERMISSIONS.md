# Permissões

| Papel   | Leitura | Criar/editar tarefas | Configurar workspace   | Gerir membros                    |
| ------- | ------- | -------------------- | ---------------------- | -------------------------------- |
| owner   | sim     | sim                  | sim                    | sim                              |
| admin   | sim     | sim                  | sim                    | sim, exceto remover último owner |
| manager | sim     | sim                  | catálogos operacionais | não                              |
| member  | sim     | sim                  | não                    | não                              |
| viewer  | sim     | não                  | não                    | não                              |

## Política

- Membership deve estar `active` em toda política.
- `SELECT`, `INSERT`, `UPDATE` e `DELETE` possuem políticas próprias e `WITH CHECK` quando aplicável.
- Usuários nunca escolhem um `workspace_id` ao qual não pertencem.
- Viewer é somente leitura, inclusive em comentários e anexos.
- Objetos de Storage começam por `<workspace_id>/<task_id>/...` e seguem a mesma membership.
- Funções `security definer` fixam `search_path` e validam `auth.uid()`.
- Atividade é append-only; apenas gatilhos do banco inserem.

## Segredos

Somente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` são públicas. Chaves privilegiadas compartilhadas fora do sistema devem ser rotacionadas antes de qualquer conexão remota.
