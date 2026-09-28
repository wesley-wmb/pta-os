# Auditoria Supabase — 27/09/2026

## Escopo e método

Inspeção somente leitura do projeto **PTA OS `cmrufxuwrracarokrcif`**, após `list_projects`. `hub-pta` pertence à mesma organização, mas suas tabelas, configurações e dados não foram consultados nem alterados. Foram consultados catálogos, estatísticas agregadas, advisors, histórico de migrations e um EXPLAIN ANALYZE de SELECT. Não houve reset de estatísticas, DDL remoto, mudança de plano, autenticação ou cobrança por esta auditoria.

Referências: skills Supabase e Postgres best practices, ARCHITECTURE, DATA_MODEL, PERMISSIONS, STATUS e documentação oficial atual. O changelog de 25/09/2026 foi verificado. O inventário descreve o instante da medição; não substitui teste de carga, pentest ou orçamento real da organização.

## Resultado medido

| Evidência                                      | Resultado                                                       |
| ---------------------------------------------- | --------------------------------------------------------------- |
| Versão informada pelo projeto                  | PostgreSQL 17.6.1.155                                           |
| Tamanho lógico de `current_database()`         | 18.386.067 bytes (~17,5 MiB), não é disco provisionado/faturado |
| Tabelas públicas                               | 49; nenhuma com RLS desligada                                   |
| SECURITY DEFINER públicas executáveis por anon | 0                                                               |
| View operacional                               | `v_task_overview`: `security_invoker=true`                      |
| Armazenamento de tarefas                       | Bucket privado, limite 26.214.400 bytes por objeto              |
| Objetos Storage no instante                    | 0; não significa consumo histórico faturado zero                |
| Volume de domínio                              | 7 tarefas e 1 projeto; inclui registros arquivados              |
| Reset de pg_stat_statements                    | 24/09/2026 21:13:44 UTC                                         |

Estatísticas `n_live_tup` são estimativas e estavam defasadas (por exemplo tasks=1 estimado contra 7 por COUNT). Não inferir capacidade ou crescimento a partir dessas estimativas isoladamente.

Consulta diagnóstica executada como usuário administrativo, **sem medir custo RLS do usuário final**:

```sql
explain (analyze, buffers, format json)
select id, due_date, status_id
from public.tasks
where workspace_id = (select id from public.workspaces limit 1)
  and archived_at is null
order by due_date
limit 50;
```

Resultado: 4 linhas, execução 0,212 ms, planejamento 2,05 ms, 6 buffers em cache, zero leitura física/temporários; sequential scan de 7 linhas e sort de 25 KB. Nesse tamanho o scan é apropriado. Não há evidência para criar dezenas de índices ou aumentar compute.

No histórico PostgREST, a seleção ampla de `v_task_overview` teve 534 chamadas, média 7,98 ms e total 4.262,61 ms; outra variante 256 chamadas, média 8,04 ms. RPCs mais custosas na amostra tinham médias entre 11,78 e 44,57 ms. São tempos SQL agregados, não latência ponta a ponta, percentis ou dados de produção representativos.

A consulta interna de processamento WAL/Realtime somou 218.719 chamadas, média 6,94 ms e 1.518.773,47 ms acumulados. Esse polling interno **não equivale a 218.719 mensagens faturadas**. O fan-out e os refetches da aplicação devem ser medidos separadamente.

## Achados priorizados

### P1 — sincronização e histórico de implantação

1. O canal de detalhe com sufixo aleatório não correspondia ao tópico privado `task:<id>` emitido pelo banco. Corrigir no cliente com assinatura compartilhada, limpeza e agrupamento de invalidações. A revisão principal está tratando esse ponto.
2. A RPC `update_task_media_description` salva versão, mas não emitia `attachment_changed`. Preparada migration `task_media_description_realtime` e publicada pela revisão principal no projeto PTA OS, preservando autorização, lock, comparação de versão, grants e evento privado; o guard de sessão agora precede o lock. O smoke autenticado está sob responsabilidade da revisão principal.
3. Histórico: 39 migrations remotas, todos os nomes encontrados localmente; **18 versões/timestamps divergem**. Não executar `db push` indiscriminadamente. Comparar conteúdo, reconciliar histórico em procedimento controlado, depois validar em banco descartável. A migration local `api_automation_foundation` continua não publicada e não foi alterada por esta auditoria.

Nomes divergentes: task_board_ordering, project_timeline_planning, project_timeline_milestone_management, configurable_task_boards, task_card_archive, board_connection_conflicts, team_operating_model_foundation, task_context_updates, task_custom_fields, task_steps_and_subtasks, profile_identity, workspace_settings, task_steps_management, link_board_week_special_lanes, security_advisor_hardening, task_board_column_lifecycle, restore_configured_board_sync, week_column_lifecycle.

### P2 — custo e escala

- Miniaturas inicialmente usavam o original e renovavam URLs assinadas por arquivo a cada 240 s. Um original de 25 MB exibido como miniatura continua podendo transferir 25 MB. Priorizar preview sob demanda, lazy loading e imagem reduzida; avaliar transformação Supabase contra sua quota antes de ativar indiscriminadamente. URLs assinadas curtas são adequadas à proteção, mas não devem causar polling de arquivos fora de vista.
- Listagem operacional usa `select('*')` na view e amplia o conjunto antes de filtrar no cliente. Próxima evolução: filtros/intervalo no servidor, projeções pequenas por visão e paginação por cursor. Não adicionar LIMIT silencioso que esconda tarefas do quadro ou altere totais. Um resumo agregado separado deve alimentar métricas.
- Agrupar invalidações em rajadas e manter uma assinatura por escopo ativo. Não buscar toda a lista para cada alteração de comentário. Desassinar ao sair e evitar canais duplicados em modal + página.
- Limites existentes de 25 MB/arquivo, reservas e quantidade por tarefa reduzem abuso pontual, mas não são orçamento por workspace nem controle de banda. Planejar quota agregada e limpeza idempotente de reservas expiradas, sem apagar arquivos válidos automaticamente.
- Não há medição disponível nesta auditoria do consumo mensal, spend cap, compute contratado, p95 HTTP, número de usuários simultâneos ou banda do outro projeto. Portanto não é possível garantir ausência de excedentes.

### P2 — segurança e manutenção

Advisors encontrados:

| Aviso                                    | Quantidade | Decisão                                                                                                                                                                   |
| ---------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FKs sem índice cobrindo todas as colunas | 79 INFO    | Priorizar conforme EXPLAIN e volume; muitos são campos de autoria. Não criar 79 índices preventivamente.                                                                  |
| Índices sem uso                          | 28 INFO    | Não remover baseado em 3 dias de amostra pequena; podem proteger workloads futuros/constraints.                                                                           |
| Auth com limite absoluto de conexões     | 1 INFO     | 10 conexões; reavaliar alocação percentual antes de aumentar compute.                                                                                                     |
| RLS ligada sem policy                    | 1 INFO     | `workspace_counters`, acesso interno por RPC; não abrir policy apenas para silenciar.                                                                                     |
| SECURITY DEFINER autenticadas            | 107 WARN   | Superfície intencional de RPC. Cada rotina precisa guard de sessão, membership/capacidade, escopo e search_path fixo; aviso não prova exploração nem certifica segurança. |
| Proteção de senha vazada desligada       | 1 WARN     | Ativar no Auth em procedimento de configuração; não foi alterada.                                                                                                         |

[Remediação de FKs](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [índices sem uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), [SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [proteção de senha](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

O changelog anuncia PostgreSQL 17.11 com correções de segurança, enquanto o inventário informa 17.6.1.155. Conferir a atualização disponível no dashboard e notas de compatibilidade; `pgcrypto` está instalado, `ltree` e `btree_gist` não. Nenhum upgrade foi executado. [Notas oficiais](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).

A frase antiga de DATA_MODEL que dizia que task_attachments estava desabilitada foi corrigida pela auditoria principal para refletir o fluxo privado atual.

## Modelo de custos e controle operacional

As quotas selecionadas são compartilhadas pela **organização**, somando os projetos. Cada projeto possui compute próprio cobrado separadamente. Menos requests reduz trabalho e transferência, mas request não é unidade universal de cobrança. [Cobrança Supabase](https://supabase.com/docs/guides/platform/billing-on-supabase).

Egress depende de bytes transferidos; cache e tráfego não cacheado têm quotas próprias. Pro inclui 100 GB de Storage, medido em GB-hora/média do período, e 5 milhões de mensagens Realtime. Alterações de banco contam por cliente receptor; Broadcast conta envio e receptores. Os números são referências do plano consultado, não saldos da conta. [Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [Storage](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size), [Realtime](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages).

Spend Cap no Pro limita excedentes de itens elegíveis, mas pode restringir serviço; não cobre compute e vários adicionais. Não é teto financeiro configurável por projeto. Confirmar seu estado em Billing antes de declarar o orçamento protegido. [Controle de custos](https://supabase.com/docs/guides/platform/cost-control).

Rotina proposta, ainda não automatizada:

1. Baseline semanal por projeto e total organização: egress, Storage GB-hora, mensagens/conexões Realtime, compute e fatura projetada.
2. Limiares internos 50/75/90% da quota conjunta com projeção até fim do ciclo. Reservar margem ao outro projeto; não atribuir toda a quota ao PTA OS.
3. A cada release: contar requests e bytes das jornadas abrir quadro, abrir/fechar tarefa, editar comentário, mover tarefa e carregar mídias; comparar com baseline.
4. Antes de novos índices: pg_stat_statements + EXPLAIN com RLS autenticada e dataset representativo em ambiente descartável. Não fazer carga sintética no banco real.
5. Backup e recuperação precisam abranger também objetos: backup Postgres não inclui conteúdo do Storage. Definir RPO/RTO e ensaio de restore antes de operação crítica.

## Arquitetura recomendada

### Verificação de migrations antes do release

`scripts/audit-migrations.mjs` compara arquivos locais com um export JSON de `list_migrations` contendo `project_id` e `migrations`. Não abre conexão, lê credenciais, altera arquivos ou repara histórico. Recusa outro projeto. Código de saída 1 significa divergência ou migration pendente; 0 significa apenas nomes/versões alinhados, não equivalência do SQL. O snapshot versionado representa a auditoria e deve ser atualizado por nova consulta autenticada antes de outro release.

```sh
node scripts/audit-migrations.mjs docs/audits/migrations-2026-09-27.json
```

O snapshot final tem 40 migrations após a publicação da correção Realtime. O teste encontrou corretamente as divergências legadas e a fundação de API ainda pendente. Nenhuma reparação automática foi realizada.

Manter Supabase e o desenho atual de RPCs transacionais/versionadas, RLS e FKs compostas por workspace. Separar consultas operacionais pequenas de resumos agregados; cache por usuário/workspace/filtro e invalidação estreita. Realtime transporta sinal de mudança, não payloads completos. Recursos e arquivos não entram em consultas de lista salvo metadados essenciais. Autorizações continuam no banco, não em cache compartilhado entre tenants.

[Otimização de consultas](https://supabase.com/docs/guides/database/query-optimization), [RLS e índices](https://supabase.com/docs/guides/database/postgres/row-level-security), [Trade-offs de índices](https://supabase.com/docs/guides/troubleshooting/steps-to-improve-query-performance-with-indexes-q8PoC9), [Backup e Storage](https://supabase.com/docs/guides/database/overview).

Nenhum índice foi adicionado, removido ou recomendado como ganho comprovado. O maior ganho imediato sustentado pela revisão é corrigir assinaturas/refetches e evitar downloads desnecessários; a capacidade futura precisa de benchmark com dados representativos.
