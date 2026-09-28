# Auditoria visual e de acessibilidade — 27/09/2026

## Escopo e critério

Revisão estática de `components/ui`, shell de navegação, tokens de `app/globals.css` e amostra das telas de configurações, projetos e tarefas. Aplicação das regras de `docs/DESIGN_SYSTEM.md` e `docs/skills/apple-design/SKILL.md`. A identidade PTA, as dimensões operacionais e os componentes existentes foram preservados. Não houve redesenho decorativo nem instalação de bibliotecas.

Esta revisão não certifica conformidade WCAG nem substitui inspeção no navegador, leitores de tela ou medição de contraste sobre os estados renderizados. O responsável pela auditoria integrada executará a validação visual no navegador antes do build.

## Problemas encontrados e correções

| Prioridade | Evidência                                                                                                                                                 | Correção                                                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1         | `DialogContent` tinha posição central fixa, mas nenhuma altura máxima ou rolagem própria; formulário alto ou zoom podia posicionar botões fora da janela. | Altura limitada a `100dvh - 2rem`, rolagem vertical e contenção de overscroll. Classes específicas do consumidor continuam podendo sobrescrever o padrão. |
| P1         | `AlertDialogContent` tinha o mesmo risco de altura e largura integral em viewport inferior a 320 px.                                                      | Margem horizontal de 1rem, altura disponível e rolagem local.                                                                                             |
| P2         | Menu contextual usava `overflow-hidden`, sem limite da área disponível do Radix.                                                                          | Altura disponível do Radix, limite de largura da janela e rolagem vertical. Ações finais não dependem de caberem todas no viewport.                       |
| P2         | Popover tinha largura fixa e nenhum limite de altura.                                                                                                     | Limites de viewport e altura disponível fornecida pelo Radix; rolagem local.                                                                              |
| P2         | `CommandDialog` montava `DialogTitle`/`DialogDescription` fora de `DialogContent`, expondo a rotulagem fora do portal modal.                              | Título e descrição movidos para dentro do conteúdo. Padrões traduzidos para português e posição adaptada à altura da janela.                              |
| P2         | `PopoverTitle` declarava props de heading, mas renderizava `div`.                                                                                         | Renderiza `h2`, mantendo estilo.                                                                                                                          |
| P2         | Regras de alvo de 44 px cobriam dropdown/select, mas não itens do menu contextual.                                                                        | Incluído `context-menu-item` na regra mobile/ponteiro grosso.                                                                                             |
| P2         | Shell possuía destino do link global de pular navegação sem foco programático explícito.                                                                  | `tabIndex=-1` no main, sem incluí-lo na ordem normal de Tab. O link existente em `app/layout.tsx` foi preservado.                                         |

Foi comunicado à auditoria principal o `main` e `id="conteudo-principal"` duplicado na página de perfil, dentro do main do shell. O arquivo da página está fora da propriedade desta frente.

## Pontos positivos preservados

- Tokens de cores semânticas, raios, espaçamento e movimento já centralizados.
- Controles comuns de 40 px e alvos móveis de 44 px.
- Tratamento global de movimento reduzido, transparência reduzida e contraste aumentado.
- Navegação principal com nomes acessíveis, estados ativos e foco visível.
- Radix para diálogos e menus, preservando Escape, foco e navegação por teclado.
- Configurações com coluna de navegação adaptada a rolagem horizontal em telas menores.

## Validação desta frente

`pnpm exec vitest run components/ui/command.test.tsx --maxWorkers=1`: 1 teste aprovado. Verifica nome acessível e descrição dentro do portal modal, evitando regressão da estrutura semântica. Prettier aplicado apenas nos arquivos alterados. Lint, typecheck e build pertencem à validação integrada, após a revisão no navegador.

Roteiro visual necessário: abrir formulário longo em janela baixa e zoom de 200%; alcançar última ação e fechar por teclado; abrir menu contextual perto da borda inferior; verificar filtros popover no viewport estreito; testar Tab inicial e link de pular navegação; revisar temas claro/escuro. Cronograma e Kanban são superfícies bidimensionais que podem manter rolagem horizontal local; isso não autoriza overflow horizontal na página inteira.

## Referências oficiais

- [W3C — Reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow): conteúdo ampliado deve continuar legível e operável; superfícies bidimensionais têm exceção específica.
- [W3C — Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum): foco não pode ficar totalmente coberto por conteúdo criado pelo autor.
- [W3C — Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum): tamanho e espaçamento dos alvos; 44 px é a decisão do design system PTA, acima do mínimo AA de 24 px com exceções.
- [IBM Carbon — Keyboard accessibility](https://v10.carbondesignsystem.com/guidelines/accessibility/keyboard/): operação previsível por Tab, Enter e Espaço.
- [IBM Carbon — Modal accessibility](https://v10.carbondesignsystem.com/components/modal/accessibility/): contexto do diálogo, foco e operação por teclado.
- [Apple — Layout](https://developer.apple.com/design/human-interface-guidelines/layout): hierarquia, adaptação e alinhamento, conforme a referência local do projeto.

## Segunda passada — superfícies complementares

Revisão somente leitura dos fluxos de perfil, configurações, equipe, recursos, histórico e produtos, seguida apenas pela correção autorizada da exportação CSV do histórico. A integração/API em desenvolvimento não foi editada nem validada por esta frente.

| Área | O que foi verificado no código | Resultado e limite |
| --- | --- | --- |
| Perfil | Formulário, validação, prévia, RPC `update_own_profile`, token `updated_at`, estados desabilitados. | Fluxo real com conflito otimista. `canEdit=false` vem do fallback de schema antigo, com aviso visível; não é botão dummy. Disponibilidade remota deve ser confirmada pela auditoria de banco. |
| Configurações | Temas, densidade, movimento, notificações, sessão e links administrativos. | Tema/densidade/movimento têm consumidores. **Confirmado:** `browserNotifications` e `notificationSounds` são persistidos mas nenhum consumidor de notificação usa esses valores. Os switches prometem efeitos ausentes. Encaminhado ao responsável principal, sem edição concorrente. Permissões administrativas têm explicação junto aos links bloqueados. |
| Equipe | Busca, filtros, convite, suspensão, reativação, remoção e transferência. | Handlers usam API/RPC reais; mutações de membro carregam versão esperada. Desabilitação corresponde a busy, papel, owner e estado do membro. Nenhum handler vazio encontrado nesta amostra. Convites não foram enviados durante a auditoria. |
| Recursos | Listagem, favoritos, categorias, relações, edição, arquivamento e visita. | Fluxos reais. Paginação de 50 itens e detalhe sob demanda, chaves de cache por workspace. A central é de recursos externos por decisão atual; upload recente é da tarefa. Gestão de categoria desabilita ações durante mutação ou no limite da ordenação. |
| Histórico | Filtros locais, abertura de tarefa e CSV. | RPC limita 50 atividades. Texto 'Todo o período' é ambíguo: consulta só a amostra carregada, apesar dos contadores corretamente dizerem 'carregados'. Link da tarefa sem origem foi encaminhado à frente de lógica. **Corrigido:** exportação agora neutraliza fórmulas usando a mesma função já presente na exportação de tarefas. |
| Produtos | Galeria/lista/tabela, filtros, criar/editar e detalhe. | Ações reais ligadas aos editores de portfólio. Tabela usa rolagem horizontal local. Galeria tem altura mínima de 340 px e cabeçalho de 96 px, densidade inferior à linguagem atual dos cards operacionais; é oportunidade de consistência, não falha funcional comprovada. |

### Lacunas remanescentes desta inspeção

- Histórico continua exibindo identificador técnico PTA no título, contrariando a orientação atual do design system; sua apresentação também usa mais caixas que as telas novas. Prioridade visual P3, sem redesign nesta rodada.
- Produtos e histórico usam margens `px-5 sm:px-8`, divergentes do padrão principal 16/24 px. Padronizar em revisão visual conjunta, evitando mudar largura isoladamente sem inspecionar cabeçalho e conteúdo.
- Filtros de Equipe usam colunas fixas de 220+150+150 px a partir de `sm`; o código adapta para coluna única abaixo disso. Necessário verificar janela estreita em zoom, nomes longos e menus reais antes de afirmar alinhamento completo.
- Perfil exibe foto por URL; não oferece upload próprio. Isso é uma limitação funcional de escopo, não um botão de upload quebrado.
- Não houve validação de entrega real de e-mails/convites nem alterações destrutivas em membros ou recursos.

### Teste adicional

`features/operations/history-export.test.tsx` exercita a ação Exportar e lê o Blob gerado, confirmando proteção contra fórmulas tanto no nome da pessoa quanto no título da tarefa. A exportação de tarefas já aplicava `sanitizeSpreadsheetCell`; sua lógica foi preservada.

## Correção orientada pela inspeção real do perfil

A auditoria principal observou a 1280 px que Pronomes e Imagem do perfil não alinhavam os inputs: o helper da URL disputava a mesma linha do label, aumentando sua altura. O componente `Field` agora mantém label acima, controle e helper abaixo; descrições têm associação `aria-describedby`. O rodapé deixa de manter 'Alterações não salvas' no DOM com apenas opacidade zero: passa a representar explicitamente o estado (sem alterações, pendente ou somente leitura). Teste `features/profile/profile-form.test.tsx` aprovado, verificando estado inicial, alteração, botão e descrição acessível. A confirmação visual posterior permanece com a auditoria principal.
