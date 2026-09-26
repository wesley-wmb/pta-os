# Pesquisa de design — Apple, Notion e Kanban

24 de setembro de 2026. Pesquisa aplicada ao redesign, com frentes independentes para Apple HIG, referências/repositórios, cards e acessibilidade de Kanban.

## Fontes e decisões

- [Apple Design](https://developer.apple.com/design/): ponto de partida para HIG, recursos e vídeos de design.
- [Apple Materials](https://developer.apple.com/design/human-interface-guidelines/materials): separar camada funcional translúcida do conteúdo opaco. Aplicação: sidebar/dock, sem vidro nas tarefas.
- [Apple Layout](https://developer.apple.com/design/human-interface-guidelines/layout): hierarquia por alinhamento, agrupamento e revelação progressiva. Aplicação: dias primeiro, fluxos abaixo, inspector sob demanda.
- [Apple Typography](https://developer.apple.com/design/human-interface-guidelines/typography): hierarquia legível e poucas famílias. Aplicação: stack de sistema, título de página expressivo, card16px.
- [Apple Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility): percepção por múltiplos sinais, adaptação e contraste. Aplicação: status/atraso textuais, foco, redução de efeitos e alvos móveis.
- [Apple Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars): categorias estáveis e navegação adaptativa. Aplicação: sidebar flutuante e dock/menu móvel.
- [Apple Color](https://developer.apple.com/design/human-interface-guidelines/color): funções semânticas e adaptação claro/escuro. Aplicação: tokens centralizados.
- [Apple Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles): clareza e utilidade preservando o contexto. Aplicação: inspector junto ao quadro.
- [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) e [Get to know the new design system](https://developer.apple.com/videos/play/wwdc2025/356/): materiais moderados, toolbar por grupos e conteúdo contínuo.
- [Landmarks oficial](https://developer.apple.com/documentation/swiftui/landmarks-building-an-app-with-liquid-glass): referência visual de navegação elevada sobre conteúdo contínuo.
- [Reminders](https://support.apple.com/guide/reminders/welcome/mac) e [Calendar](https://support.apple.com/guide/calendar/use-reminders-icl873b9a527/mac): execução diária e hierarquia temporal. Não foi criada uma grade horária artificial para demandas que possuem somente data.
- [Notion sidebar](https://www.notion.com/help/navigate-with-the-sidebar): contexto de workspace, navegação e busca.
- [Notion views](https://www.notion.com/help/views-filters-and-sorts) e [Boards](https://www.notion.com/help/boards): várias visões da mesma base e propriedades úteis no card. Aplicação: Kanban central com preview real, prazo, responsável e progresso.

## Referências fornecidas pelo usuário

- [getdesign Apple](https://getdesign.md/apple/design-md), [arquivo público completo](https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/apple/DESIGN.md).
- [getdesign Notion](https://getdesign.md/notion/design-md), [arquivo público completo](https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/notion/DESIGN.md).

São análises independentes de sites de marketing. Os resumos do catálogo e o conteúdo completo não são equivalentes em todos os detalhes; por isso não foram tratados como especificação literal de um aplicativo. A inspiração visual complementa o HIG e a documentação operacional do Notion.

## Repositórios consultados como referência

- [shadcn-ui/ui](https://github.com/shadcn-ui/ui): composição de controles e navegação.
- [radix-ui/primitives](https://github.com/radix-ui/primitives): semântica, teclado e gestão de foco.
- [radix-ui/colors](https://github.com/radix-ui/colors): cores organizadas por função.
- [cmdk](https://github.com/dip/cmdk): busca e comandos agrupados.

Não houve instalação de template, cópia de ativos Apple ou introdução de backend/provedor. Foram mantidas as bibliotecas existentes.

## Pontos encontrados na auditoria do quadro

O card anterior tinha handle de 20px com símbolo semelhante a conclusão, indicadores redundantes, descrição reduzida a ícone e risco de recorte durante arraste. A revisão usa grip explícito, alvo maior, conteúdo rico reutilizável e preview fora dos contêineres de rolagem. O detalhe lateral também passou a restaurar foco sem corrida entre efeito React e foco automático do Radix.

## Organização inspirada no Asana

O Asana foi usado como referência de arquitetura de interação, sem copiar sua identidade visual. A área **Tarefas** reúne Quadro, Lista, Semana e Calendário como visualizações dos mesmos registros. “Minhas” permanece um filtro de responsável, e o painel lateral preserva o contexto da visualização aberta.

- [Visualização em quadro do Asana](https://help.asana.com/s/article/board-view?language=pt_BR): colunas representam etapas ou seções, os cards variam naturalmente conforme as propriedades exibidas e a tarefa pode ser movida entre colunas.
- [My Tasks do Asana](https://help.asana.com/s/article/my-tasks): o trabalho atribuído à pessoa é uma visão filtrada e organizável, não uma cópia dos registros.
- [Recursos da plataforma Asana](https://help.asana.com/s/article/all-asana-features): lista, quadro e calendário são visualizações complementares do mesmo trabalho.

No PTA OS, status continua sendo a dimensão do Quadro; data e `week_lane` continuam sendo dimensões de planejamento da Semana. Emergência e Alterações são as duas exceções compartilhadas: mover uma tarefa para essas classificações atualiza as duas visões. As demais decisões de agenda não alteram implicitamente o status.
