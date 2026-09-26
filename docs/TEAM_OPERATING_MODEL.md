# Modelo operacional de equipes

## Estado desta decisão

Este documento define como workspaces, equipes, funções e linhas de produção devem funcionar no PTA OS.

O contrato correspondente está em `features/team/operating-model.ts` e possui testes unitários. A visão informativa está disponível em `/equipe?visao=modelo`. A migration `20260824090000_team_operating_model_foundation.sql` publicou a primeira fundação de equipes, funções, dependências, aprovações e handoffs no Supabase hospedado. Portanto:

- a gestão atual de memberships e os papéis `owner`, `admin`, `manager`, `member` e `viewer` continuam sendo a autorização efetiva;
- equipes internas, funções profissionais, dependências, aprovações e handoffs possuem persistência, RPCs e RLS verificadas;
- nenhuma regra futura descrita aqui deve ser tratada como autorização antes de ter controle correspondente na interface e validação de domínio;
- a tela atual explica o modelo; os controles operacionais serão conectados progressivamente ao contrato já hospedado;
- `tasks` permanece a entidade central. A futura linha de produção agrupa e conecta tarefas, sem criar uma segunda unidade de trabalho concorrente.

## Decisão principal

### Workspace

Workspace é a fronteira de segurança, dados e operação. Ele normalmente representa uma empresa, marca, unidade de negócio ou cliente.

Uma equipe interna não deve virar um workspace separado. Dividir Copy, Design, Mídia e Web em workspaces diferentes impediria o fluxo entre funções e duplicaria produtos, eventos e tarefas.

Use workspaces separados quando houver necessidade real de isolamento:

- marcas ou clientes não podem visualizar dados uns dos outros;
- pessoas, identidade, calendário ou regras operacionais são diferentes;
- a operação precisa ser transferida, arquivada ou auditada de forma independente.

Em uma agência, a recomendação é um workspace por cliente ou operação isolada. Pessoas da agência podem participar de vários workspaces e alternar entre eles. Relações de tarefas entre workspaces ficam fora da primeira versão.

### Equipe

Equipe é uma unidade de colaboração dentro do workspace. Exemplos:

- Growth
- Criativos
- Mídia
- Web
- CRM

Um workspace pode ter várias equipes. Uma pessoa pode pertencer a mais de uma equipe e deve possuir uma equipe principal para carga e roteamento padrão.

### Pessoa

Uma pessoa pode participar de vários workspaces e de várias equipes dentro de cada workspace. Toda leitura e escrita continua limitada pela membership ativa e pelo `workspace_id` selecionado.

## Acesso não é função profissional

Papéis de acesso controlam autorização. Funções profissionais descrevem o trabalho. As duas dimensões não devem ser misturadas.

### Papéis de acesso

| Papel técnico | Nome do produto | Responsabilidade de acesso                                              |
| ------------- | --------------- | ----------------------------------------------------------------------- |
| `owner`       | Proprietário    | Titular do workspace e único papel capaz de transferir propriedade      |
| `admin`       | Administrador   | Configura workspace, acessos e memberships                              |
| `manager`     | Coordenador     | Organiza operação, prioridade, equipes e modelos, sem gerir memberships |
| `member`      | Colaborador     | Cria e executa trabalho dentro das regras operacionais                  |
| `viewer`      | Observador      | Consulta sem mutar o domínio                                            |

### Funções profissionais padrão

| Função                        | Responsabilidade principal                                 |
| ----------------------------- | ---------------------------------------------------------- |
| Head de Marketing ou Growth   | Objetivos, orçamento, prioridades e decisões de alto risco |
| Líder de Operação ou Campanha | Triagem, sequência, prazos, capacidade e escalonamentos    |
| Estrategista                  | Público, oferta, canais, hipótese e briefing               |
| Copywriter                    | Mensagens, anúncios, páginas e roteiros                    |
| Designer                      | Peças visuais e adaptações de formato                      |
| Motion ou Vídeo               | Animação, edição e acabamento audiovisual                  |
| Gestor de Tráfego             | Plano de mídia, configuração, publicação e otimização      |
| Web Designer ou Desenvolvedor | Páginas, formulários, responsividade e publicação web      |
| CRM ou Lifecycle              | E-mail, WhatsApp, automações e segmentação                 |
| Conteúdo ou Social            | Calendário editorial, publicação e comunidade              |
| Dados ou Analytics            | Tracking, UTMs, eventos e leitura de performance           |
| QA ou Revisor                 | Marca, links, tracking, formatos e critérios de aceite     |

Uma pessoa pode ter uma função principal e competências secundárias. Equipes pequenas podem concentrar várias funções na mesma pessoa. Função profissional nunca concede privilégio no banco.

## Ownership da tarefa

Cada tarefa deve distinguir:

- solicitante: quem pediu o trabalho;
- responsável principal: exatamente uma pessoa, o DRI da tarefa;
- colaboradores: pessoas que ajudam a executar;
- revisor: pessoa nomeada para conferir um gate;
- aprovador: pessoa nomeada para uma decisão formal;
- seguidores: pessoas informadas sem responsabilidade de execução.

O responsável principal coordena o resultado e responde pela movimentação da tarefa, mas não precisa executar tudo sozinho. Uma tarefa sem responsável só pode permanecer em uma fila explícita de equipe.

## Criação e atribuição

| Papel         | Criar tarefa | Atribuição permitida                                       | Confirmar prioridade |
| ------------- | ------------ | ---------------------------------------------------------- | -------------------- |
| Proprietário  | sim          | qualquer membro ativo                                      | sim                  |
| Administrador | sim          | qualquer membro ativo                                      | sim                  |
| Coordenador   | sim          | qualquer membro ativo                                      | sim                  |
| Colaborador   | sim          | si, fila da própria equipe ou próximo responsável previsto | não                  |
| Observador    | não          | nenhuma                                                    | não                  |

Todos os colaboradores podem registrar trabalho. O Head não deve ser gargalo de criação. Um colaborador propõe prioridade; Proprietário, Administrador ou Coordenador confirma a prioridade efetiva.

O handoff previsto no template pode atribuir o próximo responsável sem conceder ao colaborador poder geral para distribuir trabalho pelo workspace.

## Linha de produção

Uma linha de produção é uma execução de template composta por tarefas reais. Cada etapa tem sua própria tarefa, responsável, prazo e evidência de conclusão.

Não se deve passar uma única tarefa por dez responsáveis. Essa prática apaga ownership, mistura prazos e torna revisões difíceis de medir.

### Fluxo padrão de campanha paga

```text
Entrada e triagem
  -> Briefing estratégico
       -> Copy
            -> Revisão de copy
                 -> Design -> Revisão criativa
                 -> Web
       -> Plano de mídia

Revisão criativa + Web + Plano de mídia
  -> Configuração de campanha
       -> QA de publicação
            -> Aprovação final
                 -> Publicação
                      -> Monitoramento inicial
```

Design e Web podem iniciar em paralelo após a copy aprovada. O plano de mídia pode iniciar após o briefing. A configuração da campanha só fica pronta para começar quando criativo, página e plano de mídia estiverem concluídos.

### Pronto para começar

Uma etapa fica pronta quando:

- todas as dependências foram concluídas;
- existe responsável ou fila de equipe definida;
- os insumos obrigatórios estão anexados ou relacionados;
- a etapa não está cancelada nem bloqueada por uma decisão anterior.

Concluir uma predecessora notifica o próximo responsável. Quando há várias dependências, a notificação de início ocorre somente após a última conclusão necessária.

## Handoff

Um handoff válido precisa conter:

- link externo do entregável, quando existir;
- contexto e objetivo;
- critérios de aceite;
- prazo;
- próximo responsável ou fila;
- dependências concluídas;
- pendências conhecidas.

Ações devem indicar o resultado:

- Enviar copy para revisão
- Aprovar copy e liberar produção
- Solicitar ajustes
- Liberar para tráfego
- Aprovar publicação

Se faltarem evidências obrigatórias, a RPC futura deve recusar o avanço. A interface poderá explicar exatamente o item ausente, mas não poderá substituir a validação do banco.

## Revisões e aprovações

Revisão valida qualidade técnica ou criativa. Aprovação concede autorização de negócio. Elas não são equivalentes.

- revisões de copy, design e QA podem ser obrigatórias pelo template;
- aprovação final deve ser usada quando houver risco de marca, gasto relevante, impacto legal ou compromisso externo;
- trabalho rotineiro não deve depender sempre do Head;
- um gate possui uma pessoa nomeada e prazo de decisão;
- o aprovador deve ser diferente do executor sempre que a equipe permitir;
- aprovação libera dependentes;
- solicitação de ajustes devolve a tarefa ao mesmo responsável e exige feedback;
- recusa preserva histórico, versão e evidências anteriores.

No futuro, um Observador externo poderá receber capacidade limitada para decidir somente um gate nomeado. Isso exige política própria e não faz parte das permissões atuais.

## Bloqueios

Motivos padrão:

- aguardando informação;
- aguardando aprovação;
- falta de ativo;
- dependência técnica;
- capacidade da equipe;
- terceiro ou cliente;
- mudança de escopo.

Todo bloqueio deve informar responsável pelo desbloqueio, previsão de retorno e contexto. O tempo de execução pode pausar em bloqueio externo, mas o tempo bloqueado continua visível e auditável.

Um bloqueio não pode funcionar como estacionamento silencioso. Ao vencer a previsão de retorno, o dono do fluxo recebe escalonamento.

## SLA

SLA possui duas medidas:

- tempo de resposta: quanto tempo a pessoa tem para aceitar, devolver ou pedir contexto;
- tempo de execução: quanto tempo a etapa deve levar depois de pronta para começar.

Defaults iniciais, ajustáveis por workspace e template:

| Evento                      | Alvo inicial   |
| --------------------------- | -------------- |
| Triagem e aceite do handoff | 4 horas úteis  |
| Revisão simples             | 4 horas úteis  |
| Ajuste simples              | 8 horas úteis  |
| Copy de porte médio         | 16 horas úteis |
| Design de porte médio       | 16 horas úteis |
| Web de porte médio          | 32 horas úteis |
| Configuração de mídia       | 8 horas úteis  |
| QA final                    | 4 horas úteis  |

O calendário usa fuso e dias úteis do workspace. Datas de prazo continuam como `date` quando não possuem horário. Horas úteis de SLA precisam de campos próprios e não devem converter uma data pura para meia-noite UTC.

Ao consumir 75% do SLA, a etapa entra em risco. No vencimento, o Líder de Operação é notificado. Trabalho urgente exige justificativa explícita.

## Limite de trabalho em andamento

O valor inicial é duas tarefas em andamento por colaborador. O limite começa como aviso e não como bloqueio rígido.

- o colaborador puxa a próxima tarefa da fila `Pronto para mim` quando possui capacidade;
- tarefa bloqueada não conta como execução ativa, mas permanece visível no painel de impedimentos;
- ultrapassar o limite exige decisão consciente do Coordenador;
- o workspace poderá ajustar o limite após observar lead time e capacidade reais.

O objetivo é melhorar fluxo e reduzir troca de contexto, não manter todas as pessoas ocupadas o tempo inteiro.

## Templates iniciais

1. Lançamento de campanha paga
2. Criativo estático
3. Vídeo ou motion
4. Landing page
5. Sequência de CRM
6. Publicação orgânica

Cada template deve definir:

- etapas e dependências;
- função esperada por etapa;
- responsável ou fila padrão;
- evidência de conclusão;
- SLA de resposta e execução;
- gate de revisão ou aprovação;
- checklist de pronto.

Ao iniciar uma execução, a RPC deve criar todas as tarefas em uma única transação. Somente etapas sem dependências pendentes começam prontas.

## Aprendizado progressivo

O primeiro uso não deve exigir que a equipe desenhe um workflow do zero.

1. Escolher o propósito da equipe.
2. Definir líder e funções presentes.
3. Selecionar um template.
4. Ajustar responsáveis padrão.
5. Executar antes de abrir configurações avançadas.

A visão pessoal deve priorizar três grupos:

- Para fazer
- Aguardando minha revisão
- Aguardando outros

Cada equipe mantém um acordo curto com missão, entradas aceitas, entregas, SLA, decisão e escalonamento. O acordo deve ser revisado trimestralmente ou após mudança relevante na equipe.

## Contrato de persistência

As seguintes entidades já fazem parte da fundação local, ainda não publicada no banco hospedado:

- `teams`: equipe, propósito, líder, estado e versão;
- `team_members`: pessoa, equipe e indicação de equipe principal;
- `job_functions`: catálogo funcional do workspace;
- `team_member_functions`: funções principal e secundárias da pessoa;
- `task_dependencies`: relações de bloqueio entre tarefas;
- `task_approval_requests`: aprovador, decisão, feedback e timestamps;
- `task_handoffs`: passagem de responsabilidade, evidências e aceite.

As seguintes entidades continuam planejadas para as próximas fases:

- `workflow_templates`: template versionado;
- `workflow_template_steps`: etapas, SLA e evidências;
- `workflow_template_dependencies`: grafo entre etapas;
- `workflow_runs`: execução ligada a produto, evento e DRI;
- `task_followers`: pessoas informadas.

Campos adicionados pela fundação local em `tasks`:

- `team_id`;
- `requester_id`;

Campos planejados para a fase de templates:

- `workflow_run_id`;
- `workflow_step_id`.

As tabelas da fundação repetem `workspace_id`, usam FKs compostas, mantêm RLS forçada e reservam mutações para RPCs versionadas. A migration preserva o responsável principal existente em `task_assignees`. Essa proteção só passa a valer para a aplicação depois da publicação e da verificação no Supabase hospedado.

## Fases de implementação

### Fase 1: equipes e funções

- persistir equipes, funções e memberships internas;
- permitir uma equipe principal por pessoa;
- filtrar Central, Semana e carga por equipe;
- manter gestão de membership restrita a Proprietário e Administrador.

### Fase 2: dependências e gates

- criar dependências entre tarefas;
- calcular prontidão no banco;
- criar solicitações de revisão e aprovação;
- validar handoff e notificar o próximo responsável.

### Fase 3: templates e execuções

- versionar templates;
- criar linhas de produção transacionalmente;
- mostrar a execução em tarefa, produto e evento;
- impedir alterações retroativas em execuções já iniciadas.

### Fase 4: operação assistida

- calcular SLA em horas úteis;
- sinalizar WIP e risco;
- medir lead time, tempo bloqueado e retrabalho;
- sugerir ajustes com base no histórico real.

## Critérios de aceite futuros

- uma pessoa participa de vários workspaces sem vazamento de cache ou banco;
- uma pessoa participa de várias equipes, com somente uma equipe principal por workspace;
- toda tarefa possui responsável principal ou fila explícita;
- a próxima etapa só fica pronta após todas as dependências;
- somente o aprovador nomeado ou moderador autorizado decide o gate;
- handoff incompleto não avança;
- pedido de ajuste preserva responsável, feedback e histórico;
- função profissional não concede permissão de banco;
- tarefa, evento e produto mostram a mesma execução sem duplicar trabalho;
- o caminho básico funciona sem configurar SLA, WIP ou grafo manualmente.

## Referências

- [Linear, Workspaces](https://linear.app/docs/workspaces)
- [Linear, Teams](https://linear.app/docs/teams)
- [Linear, Members and roles](https://linear.app/docs/members-roles)
- [Notion, Teamspaces](https://www.notion.com/help/guides/how-workspace-owners-can-set-up-teamspaces-for-their-organization)
- [Jira, Workflows overview](https://www.atlassian.com/software/jira/guides/workflows/overview)
- [Asana, Approvals](https://help.asana.com/s/article/approvals)
- [GitLab, Directly Responsible Individuals](https://handbook.gitlab.com/handbook/people-group/directly-responsible-individuals/)
- [Atlassian, Roles and Responsibilities](https://www.atlassian.com/team-playbook/plays/roles-and-responsibilities)
- [Atlassian, Working Agreements](https://www.atlassian.com/team-playbook/plays/working-agreements)
- [Kanban University, Official Kanban Guide](https://kanban.university/kanban-guide/)
- [Asana, Task Dependencies](https://help.asana.com/s/article/task-dependencies)
- [Atlassian, Set up approvals in Jira](https://support.atlassian.com/jira-software-cloud/docs/set-up-approvals-in-jira/)
- [Asana, Creative Production](https://asana.com/resources/asana-on-asana-creative-production)
- [Supabase, Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
