# Banco de dados — reprodução e migrations

Referência verificada em **28/09/2026**, exclusivamente no projeto **PTA OS `cmrufxuwrracarokrcif`**, PostgreSQL **17.6.1.155**. O projeto `hub-pta` não faz parte deste roteiro.

## O que está documentado

- **000**: preparação do ambiente Supabase.
- **001–047**: todas as migrations com registro de publicação, numeradas na ordem dos arquivos locais, com links, finalidade, versão remota e objetos declarados.
- **P01**: `api_automation_foundation`, existente no código e **não publicada**. Não faz parte da reprodução do banco funcional atual.
- Estrutura atual: **50 tabelas** (`49 public`, `1 private`), **557 colunas de tabelas/view**, **409 constraints**, **165 índices**, **210 funções**, **77 políticas**, **86 triggers de aplicação/Auth**, **1 view** e **48 valores de enums**. Contagens são do escopo documentado, não dos schemas internos completos do Supabase.

O catálogo cobre os 48 arquivos locais, mas **a execução do zero ainda não está certificada**. A inspeção foi somente leitura; não houve reset, reparo de histórico ou alteração do banco hospedado. Os snapshots são documentação estrutural, **não um backup restaurável dos dados**.

## Arquivos de referência

| Arquivo                                                               | Uso                                                                                                |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [MIGRATIONS.md](MIGRATIONS.md)                                        | Sequência 001–047, pendência P01, descrição e link para cada SQL                                   |
| [migration-manifest.json](migration-manifest.json)                    | Ordem local, ordem remota, versões, SHA-256 dos arquivos e triagem de diferenças                   |
| [Migrations remotas](../audits/migrations-2026-09-28.json)            | Histórico efetivamente consultado no projeto                                                       |
| [Inventário](../audits/database-inventory-2026-09-28.json)            | Tabelas/RLS, extensões, bucket, publicações e Edge Functions                                       |
| [Catálogo estrutural](../audits/database-catalog-2026-09-28.json)     | Colunas/defaults, constraints, índices, enums, view, políticas, triggers, ACLs e grants de tabelas |
| [Definições das funções](../audits/database-routines-2026-09-28.json) | SQL atual de cada função em public/private, extraído com pg_get_functiondef                        |
| [SQLs originais](../../supabase/migrations/)                          | Fonte das migrations; não foram renomeados nem reescritos nesta documentação                       |
| [Testes SQL](../../supabase/tests/database/)                          | Contratos de domínio e privacidade; alguns usam fixtures do ambiente original                      |

## 000 — Preparação

1. Use um **novo ambiente descartável Supabase**, com PostgreSQL 17, para o ensaio. PostgreSQL puro não basta: as migrations dependem de Auth, Storage, Realtime e papéis `anon`, `authenticated` e `service_role`.
2. Mantenha as extensões necessárias. O inventário de origem contém `plpgsql`, `pg_stat_statements`, `uuid-ossp`, `pgcrypto`, `supabase_vault` e `unaccent`; não instale `pg_cron`/`pg_net` só para reproduzir o publicado, pois pertencem à P01 pendente.
3. Confira schemas `auth`, `storage`, `realtime` e a infraestrutura gerenciada. As migrations criam `private` e o domínio em `public`; não recrie tabelas internas do Supabase manualmente.
4. Verifique **`public.rls_auto_enable()`**: a migration de hardening revoga seu acesso, mas não a cria. Sua definição atual está no snapshot de funções e seu event trigger no catálogo. Se ausente no destino, reconcilie esse pré-requisito antes do ensaio; não simplesmente ignore o erro nem substitua a função por um stub.
5. Confira ferramentas com `pnpm exec supabase --help`, `pnpm exec supabase db dump --help` e `pnpm exec supabase db reset --help`. CLI inspecionada: 2.115.0. `supabase/config.toml` descreve o ambiente local, não é um export das configurações hospedadas.
6. Confirme o destino antes de qualquer escrita. Este roteiro não deve ser executado como reset no projeto em uso.

O changelog de 25/09 anuncia PostgreSQL 17.11; o banco consultado ainda informa 17.6.1.155. Em um destino mais novo, revise compatibilidade de extensões e operadores. Não é necessário fazer downgrade para imitar a versão antiga.

## 001–047 — Reconstrução por migrations

Abra o [catálogo numerado](MIGRATIONS.md) e aplique o acumulado da sequência publicada em um ambiente vazio **somente após resolver as diferenças abaixo**. Essa é a ordem de dependências proposta pelos arquivos locais; a ordem real de publicação também está preservada no manifesto e é diferente.

Não use um `db push` genérico da pasta atual como receita de reprodução: ele também encontrará P01, que adiciona funcionalidades ausentes no banco de origem. Para ensaio isolado, prepare uma cópia de trabalho com apenas os 47 SQLs publicados, preservando seus nomes, e mantenha P01 fora dessa cópia. Não apague ou renomeie migrations no repositório principal para contornar o histórico.

O teste local exige Docker/Supabase funcionando. Na cópia isolada, depois de conferir a ajuda da CLI e o alvo local:

```powershell
pnpm exec supabase start
pnpm exec supabase db reset --local --no-seed
```

Esses comandos são uma etapa de **ensaio**, não uma garantia de sucesso do replay. Registre o primeiro erro, reconcilie a dependência e repita em banco vazio. Não continue manualmente sobre uma instalação parcialmente aplicada.

### Diferenças detectadas e tratamento

| Achado                                | Resultado de 28/09 | Tratamento                                                                                                          |
| ------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Versões locais diferentes das remotas | 18                 | Comparar SQL antes de renomear ou reparar; não reaplicar em produção                                                |
| SQL igual ignorando whitespace        | 32 migrations      | Evidência textual, não prova de igualdade do schema final                                                           |
| Texto diferente do histórico          | 10 migrations      | Revisar comentários, wrappers e SQL; diferença de hash não prova mudança semântica                                  |
| Histórico sem SQL                     | 4 migrations       | global_task_context, external_media_links_rich_text, task_overview_card_metrics e task_overview_description_preview |
| Histórico com placeholder             | 1 migration        | week_board_operational_lanes registra apenas “Applied through Supabase Management API”                              |
| Código não publicado                  | 1 migration        | P01 deve ficar fora da reprodução do estado atual                                                                   |

As diferenças por arquivo estão no manifesto. Os 10 textos diferentes podem incluir comentários e delimitadores; não foram classificados como equivalentes nesta revisão. Os snapshots de funções e do catálogo permitem comparar o **estado atual**, inclusive quando o histórico não conserva SQL.

Não marque uma migration como aplicada só porque tem o mesmo nome. `migration repair` altera o histórico, não recria o schema. Antes de qualquer reparo, compare as definições e valide uma cópia descartável.

## Reprodução exata do estado atual

Para recuperar exatamente o banco em funcionamento, use **backup/dump e restauração para um projeto novo**, conforme o guia oficial, em vez de assumir que o histórico incompleto reproduz tudo. São caminhos alternativos: **não restaure um dump completo e depois reaplique 001–047 sobre as mesmas tabelas**.

Um dump de schema deve incluir o domínio `public`/`private` e seus objetos, grants, políticas e dependências. Configurações e objetos personalizados em `auth`, `storage` e `realtime` também precisam ser preservados; um dump limitado a `public` não basta. O catálogo registra, por exemplo, `auth_user_profile_sync`, políticas de `storage.objects`/`realtime.messages`, o bucket privado e publicações.

O comando de exportação de schema da CLI, usando uma conexão de leitura autorizada fornecida apenas no ambiente local, é:

```powershell
pnpm exec supabase db dump --db-url $env:PTA_SOURCE_DB_URL --file .tmp-schema.sql
```

Confira o conteúdo e o alcance do dump seguindo o guia de restauração; a CLI exclui schemas gerenciados em seu fluxo padrão. Esse arquivo **não foi gerado nesta revisão**. A URL de conexão PostgreSQL e acesso ao banco são necessários; chave publicável/secret da Data API não substitui a senha/conexão de pg_dump.

Não versione dumps de dados, usuários, credenciais ou objetos Storage. Os arquivos JSON aqui versionados contêm estrutura e definições, sem linhas de tarefas, perfis, sessões ou segredos do Vault.

## O que precisa acompanhar o schema

| Camada            | Como reproduzir                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Dados de domínio  | Backup consistente, preservando UUIDs e FKs de workspaces, pessoas, equipes, tarefas, eventos, fases, marcos e anexos                        |
| Supabase Auth     | Procedimento oficial de migração de usuários/identidades; não criar auth.users por INSERT avulso                                             |
| Configuração Auth | Site URL, redirects, provedores, confirmação de e-mail, SMTP, políticas de senha e signup no destino; não estão nas migrations               |
| Storage           | Criar/conferir bucket privado task-attachments e copiar os arquivos reais via fluxo suportado; metadados SQL não copiam bytes                |
| Realtime          | Conferir publicações da aplicação e políticas privadas; partições realtime.messages_* são infraestrutura dinâmica, não migrations do domínio |
| Chaves e segredos | Gerar/configurar no novo projeto; nunca copiar para NEXT_PUBLIC nem registrar em Git                                                         |
| Frontend          | Apontar URL/chave publicável para o novo ambiente e revisar capacidades disponíveis                                                          |
| Edge Functions    | Nenhuma publicada no inventário consultado; pta-api e automation-dispatcher são código pendente                                              |

### Storage atual

Bucket `task-attachments`, **privado**, limite de **26.214.400 bytes (25 MiB)**. A lista exata de MIME types está no inventário. As políticas dependem do workspace e da autorização da tarefa/equipe. Links assinados expiram: não os use como identificadores permanentes nem como backup dos arquivos.

### Primeiro usuário e workspace

Migrations não recriam automaticamente os dados da equipe Operação nem o antigo contexto teste. Esses vínculos são **dados**, preservados por backup. A criação dos workspaces, memberships e catálogos deve respeitar as RPCs e seus invariantes.

`supabase/seed.sql` habilita `allow_self_bootstrap` **somente para desenvolvimento local**. Não publique esse seed no hospedado e não use `--include-seed` para clonar produção. Um clone com dados restaura os vínculos existentes; uma instalação hospedada vazia exige provisionamento administrativo do primeiro workspace/owner e catálogos, verificado separadamente. Não há seed de produção certificado neste pacote.

## P01 — API e automações, fora da reprodução atual

Arquivo: [20260927130000_api_automation_foundation.sql](../../supabase/migrations/20260927130000_api_automation_foundation.sql).

Adiciona APIs, integrações, outbox e processamento de entregas. Exige configuração própria de Vault, extensões, segredos e Edge Functions. Publicá-la é uma evolução do produto, não uma etapa necessária para reproduzir o banco funcional observado. Procedimento separado em [API_AUTOMATIONS.md](../API_AUTOMATIONS.md).

## Verificação após reconstrução

1. Compare tabelas, colunas, defaults, constraints, índices, enums, funções, grants, RLS, triggers, bucket e publicações com os snapshots. Não valide apenas contagens.
2. Verifique `workspace_id` e FKs compostas; datas sem horário devem continuar `date`.
3. Teste membro da equipe, membro externo à equipe, owner externo à equipe e usuário de outro workspace. O papel owner não libera equipes das quais não participa.
4. Teste RPCs de criação/edição, concorrência `version`, checklist, tarefas delegadas, campos personalizados, perfil, configurações, convites e colunas dos quadros.
5. Teste datas, duração, drag and drop, fases/marcos, retorno do modal ao cronograma e isolamento das leituras por RPC.
6. Teste upload, edição de descrição, preview, download, exclusão e negação de anexos sem acesso; confirme Realtime privado.
7. Rode os testes de `supabase/tests/database` em ambiente de teste. Arquivos `*.rollback.sql` e `team-mutation-privacy.sql` não são migrations e podem precisar de fixtures próprias; nunca substitua IDs para apontar a registros reais por conveniência.
8. Valide pelo navegador antes dos checks finais da aplicação; depois execute lint, typecheck, testes e build.

Somente registre `replay_verified: true` após aplicar do zero e passar essa verificação. Até lá, o manifesto mantém `false` explicitamente.

## Manutenção

```powershell
node scripts/document-migrations.mjs
node scripts/audit-migrations.mjs docs/audits/migrations-2026-09-28.json
```

O primeiro gera catálogo/manifesto sem tocar no banco. O segundo compara nomes e versões e **retorna 1 neste estado**, devido às 18 divergências e P01. Isso é o resultado esperado da auditoria, não uma autorização para corrigir o histórico automaticamente.

Para a próxima mudança, use `supabase migration new`, descreva seu propósito, atualize o snapshot após publicação no projeto correto e acrescente a nova etapa. Não renumere SQLs antigos: 001–047 são rótulos documentais; timestamps continuam sendo os identificadores reais.

## Referências

- [Migrations — Supabase](https://supabase.com/docs/guides/deployment/database-migrations)
- [Backup e restauração — Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Mudanças do PostgreSQL 17.11](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)
