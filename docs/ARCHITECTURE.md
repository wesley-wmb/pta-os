# Arquitetura

## Fronteiras

```text
Browser → Next.js App Router → Supabase Data API/Auth
                          ↘ Postgres RPC + RLS
                          ↘ Realtime
Browser → serviços externos de mídia por URL HTTPS
```

- Server Components carregam identidade e contexto inicial.
- TanStack Query mantém dados operacionais no cliente e invalida após RPCs.
- Formulários usam React Hook Form + Zod.
- Nenhuma regra de autorização depende apenas de componentes ocultos; o banco decide.
- O frontend executado localmente aponta para o Supabase hospedado. Supabase CLI e Docker não fazem parte do caminho obrigatório de desenvolvimento.
- Arquivos, imagens, vídeos e áudios do usuário permanecem fora do Supabase. Demandas e recursos guardam somente links HTTPS compartilháveis.

## Rotas

- `/login`: entrar ou criar conta local.
- `/convite/[token]`: validar e aceitar um convite de uso único após autenticação.
- `/inicio`: foco do dia e atalhos.
- `/demandas`: Central de Demandas.
- `/semana`: visão semanal da mesma coleção de tarefas.
- `/projetos`: portfólio compartilhado para comparar, filtrar e planejar projetos.
- `/projetos/[projectId]`: workspace de página inteira do projeto, com visão geral, quadro, lista, cronograma, calendário, recursos, equipe e atividade. O parâmetro legado `/projetos?evento=id` redireciona para esta rota; `/eventos` permanece como redirecionamento de compatibilidade.
- `/produtos`: portfólio agregado de produtos, eventos e demandas.
- `/recursos`: Central de Recursos com URLs HTTPS, categorias, favoritos, recentes, filtros e detalhe interno.
- `/busca`: resultados globais agrupados e filtrados pelas permissões do usuário.
- `/equipe`: carga atribuída, membros, papéis e convites conforme o papel do usuário.
- `/historico`: atividade sanitizada por RPC, limitada a 50 registros.
- `/tarefa/[taskId]`: detalhe completo e URL canônica.
- `@peek/(.)tarefa/[taskId]`: interceptação do detalhe dentro do shell.

## Estado e consistência

- `workspace_id` é resolvido da membership ativa do usuário. O cookie HTTP only de seleção é tratado como entrada não confiável e sempre revalidado no servidor.
- Usuários com mais de uma membership ativa podem trocar de workspace pelo shell. A troca limpa todo o cache do TanStack Query antes de carregar o novo contexto.
- No onboarding local, cada usuário autenticado sem qualquer membership pode criar um workspace próprio uma única vez. Um convite aceito cria ou reativa a membership e seleciona o workspace no servidor.
- Convites armazenam somente SHA-256 do token. O valor bruto é devolvido uma vez ao administrador para compartilhamento e nunca entra em logs de atividade.
- RPCs criam/alteram tarefas em transação e geram atividade.
- `tasks.version` evita perda silenciosa em edições concorrentes.
- A configuração de Quadro e Semana é lida por
  `get_task_board_configuration`. Edição, reordenação e vínculo usam RPCs
  separadas com versão esperada do quadro e da coluna. O cliente mantém apenas
  um preview otimista durante o arraste e invalida a configuração após a RPC.
- Automações entre visões são resolvidas no Postgres por chaves semânticas e
  atualizam a mesma linha de `tasks`; rótulos editáveis nunca determinam regras
  de domínio.
- Realtime apenas sinaliza invalidação; a fonte da verdade continua Postgres.
- `due_date` e `due_time` são campos separados para preservar semântica de data pura.
- `due_at` é calculado pelo banco e usado para identificar atraso com precisão de horário.
- `activity_logs` não possui leitura direta pelo cliente; listas usam uma RPC sanitizada.
- `weekly_capacity_minutes` não possui leitura direta; a página Equipe usa uma RPC com escopo por papel.
- Gestão de equipe usa RPCs com locks por workspace, versões otimistas e remoção lógica. O banco exige exatamente um proprietário ativo em todo workspace não arquivado.
- Colaboração em demandas usa RPCs para descrição rica, checklists operacionais, comentários e links externos. O cliente recebe capacidades granulares e não escreve diretamente nas tabelas filhas.
- Campos personalizados de tarefas são definidos por workspace e persistidos em tabelas tipadas. Definições e valores são escritos somente por RPC; a alteração de valor participa da versão otimista da tarefa.
- Descrições são documentos JSON com uma lista segura de blocos e marcas. Parágrafos, títulos, listas, checks, citações, links, negrito, itálico, tachado e código inline não aceitam HTML nem nós de mídia.
- O navegador não oferece input de arquivo nem chama Supabase Storage. Um usuário publica a mídia no Drive ou em outro serviço, configura o acesso naquele serviço e cola o link compartilhável no PTA OS.
- O bucket e as RPCs antigas de anexos são legado de uma versão anterior. Novos uploads estão desabilitados e os registros existentes permanecem preservados até inventário e migração explícita.
- A Central de Recursos usa RPCs para listagem paginada, detalhe, criação, edição, arquivamento, favoritos, visitas, categorias e permissões.
- Relações de Recursos com demandas, produtos, eventos e tags são tabelas compostas por workspace. A atualização do vetor de busca ocorre no banco sob locks determinísticos.
- Projetos usam temporariamente o armazenamento físico e as RPCs versionadas de `events`; essa compatibilidade preserva relações existentes enquanto a interface adota o domínio de projetos. Datas de saúde respeitam o fuso configurado no workspace.
- Recursos V1 são referências externas HTTPS. Abrir o detalhe interno não registra visita; a ação externa separada registra a visita antes de abrir o endereço.
- A busca global consulta o banco com o `workspace_id` ativo e retorna somente entidades que o usuário pode abrir. O cliente agrupa os resultados por tipo.
- Consultas paginadas não reutilizam dados de outro workspace ou filtro enquanto a próxima resposta é carregada.

## Modelo operacional de equipes

- Workspace continua sendo a fronteira de isolamento. Equipes são unidades internas do mesmo workspace.
- Papéis de acesso controlam autorização; funções profissionais descrevem responsabilidade e nunca concedem privilégio no banco.
- A linha de produção planejada usa `tasks` conectadas por dependências. Cada etapa continua sendo uma tarefa com um responsável principal.
- O contrato puro local está em `features/team/operating-model.ts` e a decisão completa em `docs/TEAM_OPERATING_MODEL.md`.
- A visão informativa está em `/equipe?visao=modelo`. A fundação hospedada adiciona equipes, funções, dependências, aprovações e handoffs com RLS forçada e RPCs autenticadas.
- SLA, templates versionados e execuções completas continuam planejados. A autorização efetiva permanece sendo a dos papéis e guards verificados no banco hospedado.

## Decisões adiadas

Migração assistida dos anexos legados, integração direta com provedores externos, credenciais/Vault, automações com pg_cron e analytics avançado ficam atrás de decisões futuras. A execução do modelo operacional de equipes depende da publicação e verificação da fundação local antes de seus controles serem conectados à interface.
