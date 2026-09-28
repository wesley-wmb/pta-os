# Auditoria de lógica e funcionalidades — 27/09/2026

## Escopo e método

Revisão de código e testes de tarefas, criação, navegação contextual, datas, permissões de interface, cronograma e perfil. Consultados AGENTS, ARCHITECTURE, DATA_MODEL, PERMISSIONS, STATUS e o guia instalado de Next.js Link. A verificação visual e o smoke autenticado são conduzidos separadamente pela auditoria principal; testes unitários não certificam todo o backend nem todos os papéis.

Referência de arquitetura: [Next.js — Intercepting Routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes). O modal preserva o contexto de origem; por isso o sistema usa uma URL interna permitida como retorno, em vez de depender de um histórico que pode conter outras tarefas.

## Defeitos confirmados e corrigidos

| Prioridade | Evidência anterior | Correção |
| --- | --- | --- |
| P1 | NewTaskDialog navegava para `/tarefa/id` sem retorno após criar no projeto. Fechar direcionava a Demandas. | A criação mantém caminho e filtros do projeto. |
| P1 | Links de tarefa pai/filha e calendário do projeto omitiam o retorno. | Propagação do contexto original, inclusive ao atravessar tarefas vinculadas. |
| P2 | Histórico abria tarefa sem contexto de retorno. | Link retorna para `/historico`. |
| P2 | A lista segura aceitava somente início, demandas e detalhe de projeto. | Origens operacionais explícitas adicionadas; URLs externas continuam rejeitadas. |
| P1 | Criação em `scheduled` enviava `p_due_date: null` a `move_task_in_week`, cujo contrato exige data. | Envia a data informada no formulário. Teste comprova o argumento e a versão. |
| P2 | Schema de criação aceitava datas impossíveis como `2026-02-31` por validar apenas regex. | Validação de calendário real, incluindo ano bissexto, sem conversão UTC. |
| P2 | Início e Perfil adicionavam outro `main` dentro do `main` do shell; Perfil duplicava o ID do alvo de navegação. | Conteúdo interno usa `section`, mantendo um landmark principal. |

O cronograma passou a solicitar tarefas apenas do projeto, em conjunto com a alteração de consultas da auditoria principal. O cache continua segmentado por workspace.

## Contratos revisados sem falha reproduzida nesta amostra

- Edições de tarefa, responsável, campos, fases e marcos enviam versão esperada ou `updated_at`.
- Cronograma desfaz preview otimista após erro e mantém distinção entre data pura e horário.
- Testes cobrem arraste horizontal, movimento entre estados via teclado, redimensionamento, marco por data/fase, tarefa sem data, falha de agendamento, escala e zoom.
- Perfil valida sua própria identidade e trata conflito de versão na resposta.
- Permissões da interface não substituem autorização no Postgres; a análise RLS fica na auditoria do banco.

## Verificação executada

- 71 testes em 8 arquivos: retorno, criação, link de detalhe, modal, cronograma, escala, fase e schema de perfil.
- 53 testes em 7 arquivos: schema de tarefa, datas, permissões, estado/navegação do pipeline, schemas de portfólio e erros do cronograma.
- Após últimas correções, 32 testes em 3 arquivos (criação, retorno e schema) passaram novamente. Contagens se sobrepõem e não devem ser somadas como testes únicos.
- Lint, typecheck, suíte completa e build ficam na verificação consolidada da auditoria principal.

## Limites e próximos endurecimentos

### Cache e identidade (complemento)

A auditoria principal encontrou que o logout do shell limpava o QueryClient, mas outras superfícies de saída e mudanças de sessão não tinham a mesma garantia. Foi adicionada uma fronteira central em AppProviders: `SIGNED_OUT` ou troca efetiva do usuário limpa consultas e mutações; `INITIAL_SESSION`, novo `SIGNED_IN` e refresh do mesmo usuário preservam os dados aquecidos. Não inicializa Supabase sem configuração e remove a assinatura ao desmontar. Quatro testes passaram, incluindo troca direta de usuário dentro do mesmo workspace, saída antes da sessão inicial e ausência de configuração. Não foi encerrada a sessão real do navegador durante essa validação.

- Diversos handlers usam a resposta `{ error }` do SDK, mas não tratam exceções inesperadas de callbacks/refresh com `finally`. A perda de rede normal é convertida pelo SDK em erro; ainda convém testar falhas de transporte e callbacks de integração para impedir indicadores de salvamento persistentes.
- Alguns links de painéis legados (portfolio-detail-sheet/task-center/recursos/notificações) ainda usam URL canônica sem retorno. O fallback para Demandas é seguro, porém o contexto de origem deve ser padronizado quando esses caminhos forem ativados/percorridos no smoke.
- Não foi simulado conflito concorrente real entre dois usuários nesta frente, nem todos os papéis autenticados. A presença de testes e de versionamento não equivale a certificação integral de produção.
- A frase antiga sobre anexos desativados em DATA_MODEL foi corrigida pela auditoria principal. Há ainda referências históricas à fundação de equipes não publicada, em conflito com seções novas e STATUS. Reconciliar com o schema efetivamente hospedado, sem tratar texto desatualizado como prova de ausência da função.
