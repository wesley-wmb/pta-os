# Design system — PTA OS

## Comparação direta com Asana — 26/09/2026

Escopo solicitado: visual e interações de Kanban, cronograma e Projetos. A
referência foi inspecionada na conta de avaliação aberta no Chrome. O shell e
a identidade PTA permanecem próprios. As decisões abaixo substituem as medidas
anteriores desses componentes:

- Colunas compartilhadas têm 304 px (320 px em `xl`), cabeçalho de no mínimo
  48 px, contagem sem cápsula, raio de 8 px e superfície de conteúdo separada.
  O fundo termina após o conteúdo; a área de rolagem permanece independente.
- Recolher uma coluna reduz sua largura a 56 px e mantém nome vertical e
  contagem. O botão funciona com Enter/Espaço, preserva o foco e mantém os
  filhos montados e ocultos. Essa escolha é temporária na visão atual.
- Cards do Kanban usam raio de 8 px, preservando preferências pessoais de
  conteúdo e densidade. A composição também atende às colunas da Semana.
- Projetos apresenta lista com divisórias, linhas de no mínimo 64 px e sem
  subtítulos vazios. A barra do projeto reúne criação contextual, contagem,
  busca e responsável logo abaixo das abas.
- O cronograma usa barras neutras com faixa de prioridade, menu para fase e
  marco, acesso à fila sem data em todas as larguras e ação Hoje que reposiciona
  a rolagem. A coluna de títulos mede 152 px no mobile e 240 px no desktop;
  zoom e recentralização usam sua largura real.

As alterações não adicionam entidades nem mudam autorização, RLS ou RPCs.

Atualizado em 24 de setembro de 2026.

## Direção e escopo

Apple orienta legibilidade, hierarquia, materiais, consistência dos controles e movimento. Asana orienta projetos, responsabilidade e fluxo de tarefas. Notion orienta as múltiplas visões dos mesmos registros e a abertura do detalhe no centro. A interface prioriza leitura, organização e execução; Kanban e cards são elementos centrais.

A implementação é web, em HTML, React e CSS. Os valores deste documento são decisões do PTA OS adaptadas das referências, não medidas oficiais da Apple. Não utilizamos componentes nativos Apple nem reproduzimos o material Liquid Glass nativo. Nenhuma fonte Apple é redistribuída.

A fonte de verdade dos tokens é `app/globals.css`; controles reutilizáveis ficam em `components/ui`. Novas telas devem consumir essas definições antes de introduzir valores locais.

## Tipografia

O stack de texto é `-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif`. O stack de display troca a variante Text por Display. No Windows, a renderização usa a família Segoe disponível; declarar o stack não fornece SF Pro ao navegador.

| Papel                                     | Tamanho / entrelinha                 | Peso habitual |
| ----------------------------------------- | ------------------------------------ | ------------- |
| Título de página compartilhado            | 30 px / 1,2; 34 px a partir de `sm`  | 600           |
| Saudação do Início                        | 28 px / 1,25; 32 px a partir de `sm` | 600           |
| Título de seção                           | 20 px / 28 px                        | 600           |
| Título de card                            | 16 px / 24 px                        | 600           |
| Corpo, descrição e formulários            | 16 px / 24 px                        | 400           |
| Navegação, abas e controles (`text-sm`)   | 15 px / 22 px                        | 500           |
| Metadados e conteúdo auxiliar (`text-xs`) | 13 px / 18 px                        | 400–500       |

Os tokens `text-xs`, `text-sm` e `text-base` foram ajustados globalmente para essa escala. Cards usam 13 px / 20 px nos metadados para comportar ícones e linhas de contexto. O editor de texto rico usa 16 px com entrelinha 1,7.

Títulos recebem tracking discreto, em geral entre -0,015 em e -0,025 em; corpo e labels preservam o espaçamento normal. Números tabulares são aplicados a contagens e datas que precisam de alinhamento, não ao documento inteiro. Labels operacionais não devem voltar a 10 ou 11 px. Texto secundário usa o token sem redução adicional de opacidade.

## Cores e superfícies

| Papel / token                           | Claro     | Escuro    |
| --------------------------------------- | --------- | --------- |
| Canvas / `background`                   | `#f6f7f9` | `#191b1f` |
| Texto / `foreground`                    | `#20242c` | `#f3f5f8` |
| Card / `card`                           | `#ffffff` | `#24272c` |
| Menu e popover / `popover`              | `#ffffff` | `#2d3036` |
| Superfície suave / `muted`              | `#eef1f5` | `#22252a` |
| Texto secundário / `muted-foreground`   | `#626a77` | `#b4bbc6` |
| Divisória / `border`                    | `#dfe3e9` | `#41464e` |
| Limite do campo / `input`               | `#a0a8b5` | `#727c8b` |
| Ação / `primary`                        | `#0066cc` | `#75b7ff` |
| Texto sobre ação / `primary-foreground` | `#ffffff` | `#08131c` |
| Sidebar / `sidebar`                     | `#eef1f5` | `#202328` |

A superfície do card deve vir de `card`, inclusive no tema escuro. Não criar uma segunda cor de card em um override por página. Conteúdo é opaco; translucidez é reservada à navegação e a elementos sobrepostos. A toolbar usa fundo com 92% de opacidade e blur de 16 px; a sidebar usa seu token com 90% e blur de 22 px. Esses efeitos são discretos para manter leitura estável.

Azul identifica ação e seleção. Sucesso, atenção, revisão e erro usam tokens semânticos; cor acompanha texto ou ícone. Sombras curtas distinguem cards; a elevação mais forte pertence a menus, modais e preview de arraste. Evitar cartões decorativos em volta de cada número ou seção.

## Medidas e controles

- Ritmo de espaçamento: 4, 8, 12, 16, 24 e 32 px. Elementos relacionados ficam mais próximos que grupos independentes.
- Margens principais: 16 px em telas pequenas, 24 px nos layouts maiores. Títulos, ferramentas e conteúdo devem compartilhar o alinhamento.
- Raios semânticos: `sm` 6 px, `md` 10 px, `lg` 12 px, `xl` 16 px e `2xl` 20 px. Sidebar de 18 px e modal de tarefa de 22 px são exceções explícitas de composição.
- Botão, input e select padrão: 40 px. Variante pequena: 36 px. Controles auxiliares extra pequenos: 32 px.
- Em dispositivos com ponteiro grosso, controles interativos recebem altura mínima de 44 px; botões de ícone também recebem largura mínima de 44 px.
- Ícones comuns de ação: 18 px. Ícones de metadados podem ser menores, acompanhados por texto legível.
- A ação principal tem a mesma família de medidas dos controles ao redor. O destaque vem da cor e da posição, sem aumentar arbitrariamente o botão.

## Estrutura da aplicação

O canvas é contínuo. A sidebar flutua com margem de 8 px, seleção persistente e grupos curtos. A barra global oferece contexto e ações globais. Ferramentas específicas pertencem ao cabeçalho da área. Busca global e busca local não devem competir com dois campos grandes simultâneos.

No mobile, o dock inferior reúne os destinos principais e o acesso às demais áreas. A área de conteúdo reserva espaço para esse dock e respeita a área segura.

Tarefas reúne Quadro, Lista, Semana e Calendário como visões da mesma entidade. A seleção da visão permanece na URL. O cabeçalho organiza identidade e ação principal, seguidas das visões e ferramentas, sem reconstruir a hierarquia a cada aba.

Início começa pelo trabalho atribuído à pessoa: resumo em faixa, prioridades e atividade à esquerda; semana e projeto em foco à direita. Prazos vencidos e tarefas de hoje vêm antes das demais abertas. A semana resume datas e contagens reais, com acesso ao planejamento; não usa gráfico decorativo. Em telas menores, os grupos formam uma única coluna.

Projetos reúne o trabalho da equipe no contexto do projeto. O escopo pessoal de Início e Tarefas não transforma as tarefas do projeto em cópias. Recursos, responsáveis e informações do projeto continuam vinculados aos registros existentes.

## Quadro, Semana e cards

`features/tasks/task-board.tsx` fornece `TaskBoardViewport`, `TaskBoardColumn` e `TaskBoardEmpty`. Quadro e Semana usam esses mesmos componentes; mudam o agrupamento e os rótulos, mantendo a geometria.

- Coluna com largura de 320 px, ampliada para 336 px a partir de `xl`; gap de 16 px entre colunas.
- Cabeçalho de coluna com altura mínima de 72 px, padding horizontal de 16 px, título de 15 px, descrição opcional de 13 px e contagem.
- Colunas com superfície suave, borda discreta e raio de 20 px. A coluna de hoje e o destino de um arraste recebem destaque sem alterar suas dimensões.
- Cards com padding de 16 px e raio de 16 px; conteúdo separado por 10 px na lista de cada coluna.
- O viewport ocupa a altura disponível usando flex e `min-height: 0`. A rolagem horizontal fica na base dessa área; cada coluna rola verticalmente quando necessário. Não posicionar a barra horizontal logo depois do último card nem fixar alturas calculadas para um único tamanho de cabeçalho.
- A rolagem horizontal pertence ao quadro, nunca ao documento inteiro. O viewport é uma região identificada e recebe foco de teclado.

Semana é um quadro contínuo: Emergência, Links importantes e Para planejar antecedem os dias; as demais faixas operacionais ficam na mesma sequência. Não há um segundo Kanban abaixo dos dias. A data aparece como marcador no cabeçalho, mantendo a mesma estrutura das outras colunas.

Quadro e Semana compartilham duas classificações excepcionais: Emergência aparece
antes de A fazer no Quadro, e Alterações ocupa o lugar do antigo Em revisão. Mover
uma tarefa para Emergência ou Alterações em qualquer visão atualiza a outra; ao
sair dessas classificações pela Semana, a tarefa retorna ao status padrão A fazer.

`TaskCardContent` compartilha a anatomia visual: título primeiro; prioridade e contexto; descrição opcional de até duas linhas; status e indicadores existentes; prazo e responsável no rodapé. O título usa 16 px / 24 px e comporta até três linhas. A altura é natural conforme o conteúdo. Valores opcionais ausentes não criam linhas vazias nem contadores fictícios.

Chaves técnicas como `PTA-000006` não aparecem no card ou no título do detalhe. Permanecem internas quando necessárias à identificação e à infraestrutura. Atrasos têm indicação textual e ícone; o status também não depende apenas de cor.

O card abre o detalhe. O botão de arraste é separado e nomeado, com alvo de 44 px em telas pequenas e 36 px em desktop. O preview de arraste é renderizado em portal no `body` para atravessar colunas sem recorte. Escape cancela, e leitores de tela recebem orientações e anúncios em português.

Arrastar altera status, dia ou faixa operacional conforme a visão. A interface não promete reordenação manual livre dentro da mesma coluna. Status e prazo também podem ser alterados no detalhe, sem depender de arraste.

## Detalhe da tarefa

O detalhe abre em modal centralizado de até 1040 px de largura. No desktop, respeita as margens da janela e a altura disponível; no mobile ocupa a tela. O quadro permanece como contexto visual ao fundo, sem interação enquanto o modal está aberto. A rota canônica permite abrir a tarefa como página completa.

Título, status e prioridade formam o início do conteúdo. A descrição permanece apresentada como editor quando a pessoa tem permissão: clicar entra diretamente no conteúdo, sem trocar uma visualização estática por outra tela. O salvamento informa seu estado.

Organização da tarefa usa linhas com labels e controles alinhados. Solicitante é um valor fixo derivado de quem criou a tarefa; Responsável é um campo distinto e editável conforme as permissões. Campos personalizados seguem os tipos e permissões disponíveis no backend. Checklist, links, arquivos, comentários e atividade têm seções próprias e consistentes.

O modal leva o foco para seu contexto ao abrir e o devolve ao card ao fechar. Se uma atualização substituir o card original, a restauração procura o link correspondente à mesma tarefa.

## Movimento e acessibilidade

| Token                  | Duração | Aplicação de referência                  |
| ---------------------- | ------- | ---------------------------------------- |
| `motion-duration-fast` | 120 ms  | Hover, pressionamento e foco             |
| `motion-duration-base` | 180 ms  | Seleção e feedback de controle           |
| `motion-duration-slow` | 220 ms  | Entrada de conteúdo e transições maiores |

O easing padrão é `cubic-bezier(0.2, 0.8, 0.2, 1)`; o enfatizado é `cubic-bezier(0.16, 1, 0.3, 1)`. A entrada da página usa fade. O arraste acompanha a manipulação diretamente e usa acomodação de 180 ms ao soltar. Movimento deve explicar uma mudança de estado, sem atrasar a operação.

- Foco visível, navegação por teclado e nomes acessíveis em português fazem parte do componente.
- `prefers-reduced-motion` reduz transições e animações e remove transformações de apresentação.
- `prefers-reduced-transparency` torna navegação e dock opacos.
- `prefers-contrast: more` reforça separadores, inputs e texto secundário.
- Validar temas claro e escuro, zoom de 200%, viewport estreito, textos longos, estados vazios, carregamento, foco e arraste.
- Ao ampliar texto, priorizar quebra de linha e adaptação do layout; truncamento não deve esconder a única forma de compreender uma ação.

## Regras de implementação

Mudanças visuais preservam workspace, RLS, permissões, RPCs e concorrência por versão. Componentes compartilhados concentram regras de tipografia, superfície, controles e quadros; uma tela nova não deve recriar essas regras com valores locais incompatíveis.

Revisões devem comparar Quadro e Semana lado a lado, conferir títulos e controles nas demais áreas e verificar a localização das barras de rolagem. Documentar explicitamente qualquer exceção necessária. Antes de concluir, executar lint, typecheck, testes afetados, build e validação visual dos fluxos alterados.

## Referências oficiais

- [Apple — Typography](https://developer.apple.com/design/human-interface-guidelines/typography): legibilidade, hierarquia e adaptação ao tamanho do texto.
- [Apple — Layout](https://developer.apple.com/design/human-interface-guidelines/layout): alinhamento, organização e prioridade visual.
- [Apple — Materials](https://developer.apple.com/design/human-interface-guidelines/materials): separação entre controles e conteúdo; uso cuidadoso de translucidez.
- [Apple — Motion](https://developer.apple.com/design/human-interface-guidelines/motion): movimento breve, preciso e com propósito.
- [Apple — UI Design Tips](https://developer.apple.com/design/tips/): contraste, leitura e dimensionamento de controles.
- [Asana — Board View](https://help.asana.com/s/article/board-view): colunas, tarefas e propriedades dos cards.
- [Notion — Views, Filters, Sorts and Groups](https://www.notion.com/help/views-filters-and-sorts): visões da mesma coleção e abertura centralizada do detalhe.

A pesquisa anterior está em [DESIGN_RESEARCH_APPLE_NOTION.md](DESIGN_RESEARCH_APPLE_NOTION.md). Em caso de divergência com decisões antigas, prevalecem a implementação atual e este documento.

## Apple Design — aplicação no layout novo (25/09/2026)

Referência: [apple-design de Emil Kowalski](https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md), com cópia em `docs/skills/apple-design/SKILL.md` e instalação no Codex. A cópia é referência de design, não código executado em produção. A orientação se aplica ao shell atual e às novas telas React; protótipos HTML antigos não são o alvo.

- O shell e o dock oferecem foco explícito e feedback imediato ao pressionar. A ativação continua no clique, permitindo cancelar o toque antes da soltura.
- O Início usa título de 32–64 px (32–48 px em mobile), entrelinha 1,08 e tracking de -0,025 em. Metadados antes abaixo de 13 px passam a 0,8125 rem.
- Entradas do Início usam o token de 220 ms, sem cascatas de espera; luz ambiente e marcador de data permanecem estáticos. A decoração de Projetos também deixa de executar loops.
- Progresso diário e faixa de indicadores do Início usam superfície opaca. Translucidez fica na navegação sobreposta.
- Contraste aumentado e transparência reduzida preservam o par de cores da ação principal, tornam superfícies opacas e removem efeitos ambientais do Início. Movimento reduzido neutraliza deslocamentos no hover.
- A física do arraste continua sob responsabilidade do dnd-kit existente; esta aplicação não acrescenta gestos ou bibliotecas de animação.

## Acabamento de vidro do Início — 26/09/2026

O painel de saudação mantém sua composição e usa uma única superfície de vidro fosco escuro: blur de 24 px, saturação de 115%, base com 92% de opacidade, reflexo de borda e sombra curta. A marca d'água PTA / 25 e a grade decorativa foram removidas; a luz azul é estática e discreta. A faixa de indicadores compartilha o material do painel, sem blur adicional. O texto auxiliar usa cor explícita de alto contraste sobre o material.

Esta é uma adaptação web solicitada para o painel, não uma reprodução do Liquid Glass nativo. As referências [Materials](https://developer.apple.com/design/human-interface-guidelines/materials) e [Meet Liquid Glass, WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/) orientam hierarquia, legibilidade e a prevenção de vidro sobre vidro. A Apple reserva Liquid Glass principalmente à camada de controles; aqui o conteúdo recebe acabamento fosco contido. Transparência reduzida, contraste aumentado e navegadores sem backdrop-filter recebem superfície opaca.

Validação deste acabamento: inspeção autenticada em desktop e 390 px; `pnpm lint` sem erros (três avisos em Projetos), `pnpm typecheck` e `pnpm build` aprovados. Após timeouts de workers na execução padrão, `pnpm test --maxWorkers=2` concluiu com 245 testes aprovados e uma falha em `features/operations/project-timeline.test.ts`: fim de intervalo recebido `2027-01-04`, esperado `2027-01-03`. O cronograma não foi alterado neste ajuste de CSS.

## Colunas configuráveis — 26/09/2026

Quadro e Semana tratam a coluna como um componente operacional único: cabeçalho,
contagem, alça de arraste, ícone, cor, ação de edição e estado de destino seguem a
mesma anatomia. O preview de arraste usa elevação e translucidez somente enquanto
a coluna está em movimento. A ordem também pode ser alterada pelo menu, oferecendo
uma alternativa acessível ao gesto.

No Quadro, todas as colunas ativas podem ser reordenadas. Na Semana, as faixas
operacionais podem ser reordenadas dentro do grupo anterior ou posterior aos dias;
as datas permanecem cronológicas e não recebem edição visual. Nome, cor e ícone são
apresentação configurável. Regras entre Quadro e Semana usam chaves semânticas
imutáveis, portanto continuam válidas após uma renomeação.

O Kanban do portfólio de Projetos usa a mesma geometria e os mesmos controles de
coluna. Suas quatro chaves de ciclo permanecem fixas no domínio, enquanto nome,
cor, ícone e ordem são configuráveis por workspace.

As referências específicas desta decisão são [Apple — Drag and drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop),
[Apple — Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures),
[Atlassian — Pragmatic drag and drop design guidelines](https://atlassian.design/components/pragmatic-drag-and-drop/design-guidelines/)
e [W3C — Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements).

## Cards operacionais — 27/09/2026

- Ações do card ficam no menu contextual (botão direito, Shift+F10 ou toque prolongado). O arraste permanece disponível por mouse, teclado e controle de toque.
- No Kanban e Semana, título e tags têm prioridade; a descrição mantém sua prévia e o status redundante fica no detalhe. A altura permanece automática, sem altura mínima, acompanhando o conteúdo. Bloqueios continuam explícitos. Checklist aparece como contagem no rodapé, sem barra decorativa.
- Tags usam texto e cores por significado: prioridade urgente vermelha, projeto azul, tipo violeta, produto teal, com variantes claras/escuras. Não dependem apenas da cor.
- Referências: https://www.radix-ui.com/primitives/docs/components/context-menu e https://www.nngroup.com/articles/progressive-disclosure/.
