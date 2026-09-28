# Equipes como área de trabalho

Decisão final do usuário em 28/09/2026, substituindo a proposta inicial equipe → projetos.

## Fluxo

- Operação → Equipes apresenta somente as equipes das quais a pessoa participa.
- Escolher uma equipe abre diretamente visão geral, quadro, lista, cronograma e calendário. Não existe etapa de criar ou escolher projetos.
- Criar equipe prepara sua área de trabalho atomicamente e abre essa área.
- Gestão → Pessoas administra pessoas e convites do workspace; /equipe preserva parâmetros e redireciona para /pessoas.
- URLs antigas de projetos com contexto de equipe redirecionam para /equipes/id, preservando a visão. /projetos redireciona ao diretório.
- O usuário autorizou reaproveitar o projeto teste como área da equipe Operação. IDs das tarefas, marcos, fases e anexos foram preservados.

## Compatibilidade de dados

teams.workspace_event_id referencia um único contexto events do mesmo workspace. events.primary_team_id identifica a equipe. O contexto interno mantém as RPCs e relações existentes, sem expor cadastro de projeto ao usuário. O nome interno acompanha o nome da equipe. Novas tarefas desse contexto recebem team_id correspondente; tarefas avulsas preservam as regras anteriores.

Não duplicar tarefas, nem migrar anexos. O contexto é protegido contra desvinculação e arquivamento independente. Arquivar equipe valida trabalho e participações antes de arquivar o contexto na mesma transação.

## Privacidade

Participação ativa na equipe é obrigatória, inclusive para proprietário, administrador e coordenador. O papel do workspace não concede visibilidade automática. Criadores entram na equipe como líderes; edição mantém os limites anteriores mais a exigência de participação.

Helpers can_read_team/event/task, RLS restritiva, filtros em RPCs SECURITY DEFINER, gatilhos de mutação, Storage e Realtime aplicam a regra. Busca e agregações filtram antes de calcular resultados. Pessoas continua sendo uma administração transversal do workspace. URLs de mídia já assinadas expiram no prazo original; novas emissões são negadas após remoção.

## Validação

Testes transacionais com rollback em supabase/tests/database verificam criação, contexto único, arquivo, versões concorrentes, RLS autenticada, proprietário não membro, leitura de detalhes, busca, anexos, mutações e atribuição da equipe em tarefas. Fixtures do teste visual foram arquivadas; registros reais foram preservados.

## Referências da pesquisa inicial

- [Linear — Teams](https://linear.app/docs/teams)
- [Linear — Projects](https://linear.app/docs/projects)
- [Asana — Project privacy](https://help.asana.com/s/article/project-privacy-settings)

A decisão final simplifica esses padrões conforme o fluxo solicitado para o PTA OS.
