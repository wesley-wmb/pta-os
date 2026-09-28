# Visão geral e personalização de projetos — 27/09/2026

## Referências consultadas

- [Linear: Project Overview](https://linear.app/docs/project-overview): contexto e propriedades compactas, documentação e marcos no mesmo projeto.
- [Linear: The next generation of projects](https://linear.app/changelog/2024-05-02-the-next-generation-of-linear-projects): referência visual inspecionada no navegador; hierarquia editorial e organização das propriedades antes do conteúdo.
- [Asana: Projects](https://asana.com/features/project-management/projects): múltiplas visões do mesmo trabalho e contexto compartilhado. A página de ajuda da visão geral não carregou corretamente durante a pesquisa.
- [Basecamp: Hill Charts](https://basecamp.com/hill-charts): distinguir contagem de tarefas de percepção real de avanço. O PTA mostra explicitamente **entregas concluídas**, sem inventar projeções, tendências ou percentuais de esforço.

## Decisões aplicadas

Visão geral recomposta com metadados compactos, uma faixa de progresso e pendências, entregas por prazo, direção do projeto e uma sequência vertical de marcos. O estado vazio ocupa somente o espaço necessário. Cor semântica acompanha o texto; divisórias discretas preservam densidade. Os números vêm do backend existente.

Configurações separadas em identidade/organização, direção/resultado e equipe. A barra de ações permanece disponível, informa alterações pendentes e permite descartar. O mesmo RPC, validação e controle de versão foram mantidos.

Personalizar abre um painel próprio: visão inicial, visibilidade e ordem de abas. Preferências continuam locais, segregadas por usuário, workspace e projeto. Acesso disponível também para leitores. A última aba não pode ser ocultada. Escolher uma visão inicial restaura sua aba se estava oculta.

A navegação explícita para a visão geral usa `visao=overview` para não ser substituída pela preferência de abertura. Links de tarefa usam o componente compartilhado que preserva o retorno ao projeto.

## Verificação manual

- Visão geral inspecionada nos temas claro e escuro.
- Painel de personalização: abrir/fechar, mostrar/ocultar Atividade e reordenar Lista por teclado; ordem visível restaurada ao final.
- Configurações: nome vazio bloqueado antes da RPC, mensagem de erro, descarte restaura o nome e desabilita salvar.
- Tarefa aberta a partir da visão geral e fechada: retorno confirmado a `?visao=overview`.
- Não foram alterados dados de domínio no teste visual.
- O override de viewport do navegador não alterou a largura efetiva (1638 px); revisão móvel não foi confirmada nesta sessão.

## Checagens automatizadas

`pnpm lint` sem avisos; `pnpm typecheck` aprovado; suíte com 367 testes aprovados; quatro testes novos da visão geral aprovados novamente após limpeza do mock; `pnpm build` aprovado.
