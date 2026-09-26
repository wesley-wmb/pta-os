# Permissões

## Perfil pessoal

- Toda pessoa autenticada pode ler e atualizar apenas a própria identidade.
- Pessoas que compartilham um workspace ativo continuam podendo ler os dados
  públicos do perfil necessários para atribuições e colaboração.
- A atualização passa pela RPC `update_own_profile`, valida a sessão, exige um
  perfil ativo e compara `updated_at` antes de escrever.
- O e-mail é somente leitura na área de perfil e permanece sincronizado pelo
  Supabase Auth. O avatar é uma URL HTTPS; o PTA OS não recebe o arquivo.

## Projetos e tarefas pessoais

- A visualização pessoal mostra por padrão tarefas cujo responsável principal é o usuário atual.
- Essa preferência não altera RLS nem torna a tarefa privada: membros autorizados do workspace continuam vendo o conjunto completo dentro do projeto.
- Criação e edição de projetos continuam usando as capacidades devolvidas pelas RPCs operacionais; mutações de tarefas permanecem versionadas e validadas no banco.
- A tela completa de configurações do projeto segue as mesmas capacidades: quem não pode editar recebe a estrutura em modo de leitura.
- A visão inicial do projeto, o tema, a densidade e a composição visual dos cards são preferências locais por usuário e workspace; não concedem acesso nem alteram dados compartilhados.

## Configurações do workspace

- Todo membro ativo pode ler a identidade e as preferências operacionais do workspace atual.
- Somente owner e admin podem alterar nome, prefixo, cor, fuso, início da semana, dias úteis, horário padrão e resumo de notificações.
- A RPC `update_workspace_settings` valida a sessão e o `workspace_id`, bloqueia o registro e compara `expected_version` antes da escrita e da auditoria.

| Papel   | Leitura | Criar/editar tarefas | Configurar workspace   | Gerir membros                    |
| ------- | ------- | -------------------- | ---------------------- | -------------------------------- |
| owner   | sim     | sim                  | sim                    | sim                              |
| admin   | sim     | sim                  | sim                    | sim, exceto remover último owner |
| manager | sim     | sim                  | catálogos operacionais | não                              |
| member  | sim     | sim                  | não                    | não                              |
| viewer  | sim     | não                  | não                    | não                              |

## Acesso e função profissional

Os papéis acima são a autorização efetiva atual. Head, Líder, Copywriter, Designer, Gestor de Tráfego, Web Designer e outras funções descrevem trabalho e não concedem acesso.

O modelo planejado permite que owner, admin e manager atribuam qualquer membro ativo. Member poderá criar para si, para a fila da própria equipe ou fazer o handoff previsto no fluxo, sem poder distribuir trabalho livremente pelo workspace. Viewer permanece sem mutações.

Gates futuros exigirão um aprovador nomeado. Essa regra só será efetiva depois de migration, RPC e RLS específicas. Até lá, não existe exceção de aprovação para viewer. Consulte `docs/TEAM_OPERATING_MODEL.md`.

## Colaboração na demanda

| Ação                                                  | Viewer | Member autorizado            | Manager, admin e owner |
| ----------------------------------------------------- | ------ | ---------------------------- | ---------------------- |
| Ler descrição, checklist, comentários e links         | sim    | sim                          | sim                    |
| Editar descrição e estrutura do checklist             | não    | criador ou responsável       | sim                    |
| Concluir e reabrir item                               | não    | sim                          | sim                    |
| Criar comentário e link externo                       | não    | sim                          | sim                    |
| Excluir comentário                                    | não    | próprio                      | moderação              |
| Editar ou excluir link                                | não    | próprio                      | sim                    |
| Abrir arquivo ou mídia no serviço externo             | sim    | sim                          | sim                    |
| Enviar arquivo binário ao Supabase pela interface PTA | não    | não                          | não                    |
| Preencher campo personalizado                         | não    | criador ou responsável       | sim                    |
| Criar campo personalizado                             | não    | não                          | sim                    |
| Criar tarefa vinculada para membro ativo              | não    | se puder editar a tarefa pai | sim                    |
| Desvincular tarefa filha sem excluí-la                | não    | se puder editar a tarefa pai | sim                    |
| Renomear ou excluir seção e passo do checklist        | não    | criador ou responsável       | sim                    |

Uma tarefa vinculada é uma tarefa completa. A pessoa que pode editar a tarefa pai pode delegar uma entrega a qualquer membro ativo que não seja viewer; a validação do alvo e do `workspace_id` ocorre no RPC atômico. A tarefa filha aparece nas visões pessoais e de projeto conforme seu responsável e `event_id`, enquanto a tarefa pai mantém o atalho para abrir o detalhe, os comentários, os links e o histórico da filha.

Na página Equipe, owner, admin e manager veem membros ativos; member vê apenas o próprio painel; viewer não acessa a rota. A capacidade semanal é entregue somente pela RPC autorizada.

## Gestão da equipe

| Ação                         | Owner | Admin | Manager | Member | Viewer |
| ---------------------------- | ----- | ----- | ------- | ------ | ------ |
| Listar membros e convites    | sim   | sim   | não     | não    | não    |
| Criar ou cancelar convite    | sim   | sim   | não     | não    | não    |
| Alterar papel de não owner   | sim   | sim   | não     | não    | não    |
| Suspender, reativar, remover | sim   | sim   | não     | não    | não    |
| Transferir propriedade       | sim   | não   | não     | não    | não    |
| Aceitar convite pessoal      | sim   | sim   | sim     | sim    | sim    |

- O aceite exige sessão autenticada e igualdade entre o e-mail da conta e o e-mail normalizado do convite.
- Um convite nunca concede o papel owner. A propriedade só muda pela RPC dedicada e atômica.
- O token bruto não é persistido. Inspeções sem correspondência de e-mail não revelam nome, ID ou papel do workspace.
- Escritas diretas em `workspace_members` e `workspace_invitations` são revogadas do cliente autenticado.

## Central de Recursos

| Ação                                    | Viewer e member         | Manager                             | Admin e owner         |
| --------------------------------------- | ----------------------- | ----------------------------------- | --------------------- |
| Ver recurso não restrito                | sim                     | sim                                 | sim                   |
| Ver recurso restrito                    | com permissão explícita | se autor ou com permissão explícita | sim, acesso implícito |
| Favoritar e registrar visita própria    | sim, se puder ver       | sim, se puder ver                   | sim                   |
| Criar recurso não restrito              | não                     | sim                                 | sim                   |
| Criar recurso restrito                  | não                     | não                                 | sim                   |
| Editar ou arquivar recurso não restrito | não                     | sim                                 | sim                   |
| Editar ou arquivar recurso restrito     | não                     | se autor ou com `edit`              | sim                   |
| Criar categoria                         | não                     | sim                                 | sim                   |
| Renomear e reordenar categoria          | não                     | sim                                 | sim                   |
| Arquivar categoria                      | não                     | não                                 | sim                   |
| Alterar restrição e gerir permissões    | não                     | não                                 | sim                   |
| Criar e relacionar tags                 | não                     | sim                                 | sim                   |

- Owner e admin não aparecem como permissões configuráveis porque seu acesso é implícito.
- A lista de pessoas autorizáveis inclui memberships ativas, inclusive viewer, e ignora participantes suspensos ou inativos.
- Somente manager ativo pode receber `edit`. Para member e viewer, qualquer valor enviado é normalizado para `view`.
- Permissões antigas são normalizadas contra as memberships ativas antes de salvar. Entradas obsoletas são removidas e não bloqueiam a edição do recurso.
- A busca global aplica a mesma visibilidade das rotas de origem. Um recurso restrito sem acesso não aparece no resultado.
- A busca de pessoas retorna somente perfis permitidos pela membership e pelas capacidades do chamador.

## Política

- Membership deve estar `active` em toda política.
- `SELECT`, `INSERT`, `UPDATE` e `DELETE` possuem políticas próprias e `WITH CHECK` quando aplicável.
- Usuários nunca escolhem um `workspace_id` ao qual não pertencem.
- Viewer é somente leitura, inclusive em comentários e links externos.
- A aplicação não envia arquivo do usuário ao Supabase Storage. Imagens, vídeos, áudios e documentos entram apenas como URLs HTTPS de serviços externos.
- A pessoa que adiciona o link deve conferir no provedor externo se o público correto possui acesso. RLS protege a referência no PTA OS, mas não substitui a permissão do Drive ou de outro host.
- Funções `security definer` fixam `search_path` e validam `auth.uid()`.
- Atividade é append-only; apenas gatilhos do banco inserem.
- O cliente não possui `SELECT` direto em `activity_logs`; listas usam DTO sanitizado por RPC.
- O cliente não possui acesso direto a `weekly_capacity_minutes`.
- O cliente autenticado recebe somente `SELECT` nas tabelas de colaboração; toda mutação passa por RPC.
- Links de demanda aceitam somente HTTPS absoluto e nunca geram preview no servidor.
- Escritas de Recursos passam por RPC e repetem a validação de papel, `workspace_id`, versão e URL no banco.
- A interface oculta controles de mutação sem capacidade correspondente, mas a autorização final continua no banco.
- Tabelas de participantes, marcos e relações de recurso não aceitam escrita direta do cliente autenticado. A metadata de anexos é legado sem novos uploads.
- Funções administrativas de equipe usam lock por workspace, versão esperada e logs sem e-mail, token ou hash.

## Segredos

Somente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` são públicas. Chaves privilegiadas compartilhadas fora do sistema devem ser rotacionadas antes de qualquer conexão remota.
