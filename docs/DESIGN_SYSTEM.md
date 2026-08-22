# Design system

## Direção

Interface editorial e operacional: canvas branco, sidebar cinza-quente, texto quase preto e lima usado com parcimônia. Evitar aparência de dashboard genérico, gradientes decorativos e excesso de cartões.

## Tokens

- Espaçamento base: 4 px; ritmo principal 8/12/16/24/32.
- Raio: 8–12 px em controles; 16 px apenas em superfícies maiores.
- Tipografia: stack nativa do sistema, títulos compactos, texto de interface 13–14 px.
- Acento lima: ação principal, foco e estado selecionado; nunca grandes fundos.
- Foco: anel de 2 px com contraste visível.
- Motion: 120–180 ms e respeita `prefers-reduced-motion`.

## Padrões

- Side peek no desktop; sheet quase integral no mobile.
- Tabelas se convertem em lista com rótulos no mobile.
- Estados vazio incluem explicação e uma ação principal.
- Ícones Lucide sempre têm texto visível ou `aria-label`.
