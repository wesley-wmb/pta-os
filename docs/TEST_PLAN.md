# Plano de testes

## Unitários

- Schemas Zod: títulos, prioridades, data pura e payload de versão.
- Utilitários de data pt-BR sem conversão indevida para UTC.
- Mapeamento de status e agrupamento semanal.
- Retornos internos permitidos na autenticação e bloqueio de open redirect.
- Recuperação com e-mail válido e validação dos limites da nova senha.
- Descrição estruturada aceita a lista segura de blocos e marcas, preserva listas e checks e rejeita HTML, mídia embutida, nós desconhecidos e links inseguros.
- URL de demanda e recurso aceita somente HTTPS absoluto, sem credenciais, IPv6 ou porta 0 e fora do intervalo válido.
- Busca local de Recursos limita a entrada a 100 caracteres.
- Normalização de permissões remove memberships inativas e converte `edit` para `view` quando o papel não é manager.
- A política de mídia externa impede input de arquivo e chamadas ao Supabase Storage no código de aplicação.
- Seleção de workspace rejeita cookie inválido, membership suspensa e workspace arquivado e escolhe um fallback determinístico.
- Rotas de convite aceitam somente token hexadecimal de 64 caracteres e preservam retorno interno sem open redirect.
- Schemas de equipe normalizam e-mail, papéis, estados, versões e respostas de todos os RPCs administrativos.

## Integração Supabase

- Usuário anônimo, membro ativo, viewer, membership suspensa e cross-workspace.
- Criação concorrente mantém número único.
- Update com versão antiga retorna conflito.
- A policy de insert de anexos legados não existe e as RPCs antigas de preparar e concluir upload não executam para `public`, `anon` ou `authenticated`.
- A migration da nova política não apaga bucket, objeto ou metadata legada antes de inventário.
- Links de mídia externa obedecem à RLS de `task_links` e aceitam somente HTTPS absoluto.
- Atividade não pode ser inserida pelo cliente.
- Viewer lê colaboração, mas não executa nenhuma mutação.
- Member altera somente o que sua capacidade autoriza; IDs de outra workspace não são enumeráveis.
- A validação SQL da descrição aceita parágrafos, títulos, listas, checks, citações e marcas permitidas, e rejeita profundidade excessiva, mídia, HTML e protocolos diferentes de HTTPS.
- Comentário excluído não mantém o corpo no payload posterior.
- Comentários preservam paginação de 20 itens, respostas, edição pelo autor e tombstone após exclusão.
- Realtime invalida a colaboração após alteração e remoção de link sem conceder escrita direta às tabelas.
- Recursos não restritos são visíveis ao workspace; recursos restritos não vazam para usuários sem acesso explícito.
- Manager não cria recurso restrito, não altera a restrição e não gerencia permissões.
- Owner e admin configuram `view` para member e viewer e `view` ou `edit` para manager ativo.
- Permissões suspensas, inativas ou obsoletas não permanecem após uma edição válida.
- Criação concorrente de categorias preserva slug único e posição serializada dentro do workspace.
- Favorito, visita e filtro de recentes pertencem ao usuário autenticado.
- A listagem de Recursos pagina além dos primeiros 100 registros sem misturar filtros ou workspaces.
- Busca global agrupa demandas, eventos, produtos, recursos e pessoas sem expor entidades que o usuário não pode abrir.
- Busca por prefixo e termo parcial respeita limite, escopo do workspace e regras de visibilidade.
- Relações de recursos atualizam o vetor de busca sem incrementar a versão do recurso por uma alteração interna do índice.
- Reordenação de categorias rejeita snapshot obsoleto e serializa alterações concorrentes.
- Produtos, eventos, marcos e demandas contextuais usam somente RPCs, validam participantes ativos e rejeitam versão obsoleta.
- Saúde do evento considera atraso, bloqueio e datas no fuso do workspace.
- Convite persiste somente hash SHA-256, expira, cancela, aceita uma vez e não vaza e-mail, token ou hash na atividade.
- Aceite com o e-mail correto cria ou reativa membership; replay de token consumido não reativa membro removido.
- Alteração de papel, suspensão, reativação e remoção exigem versão atual e lock uniforme do workspace.
- Transferência de propriedade é atômica, preserva exatamente um owner ativo e rejeita destino suspenso, removido ou inativo.
- RPCs de equipe executam para `authenticated`, são negadas a `anon` e `public` e substituem toda escrita direta nas tabelas protegidas.
- A fundação de equipes força RLS em todas as tabelas novas, rejeita vínculo entre workspaces e reserva escrita às RPCs versionadas.
- O catálogo funcional contém exatamente as doze chaves canônicas usadas pelo contrato TypeScript.
- Uma pessoa pode participar de várias equipes, mas só possui uma equipe principal por workspace.

## E2E

- Fluxo vertical completo em Chromium desktop e Pixel 7.
- Deep link abre página completa; navegação suave abre peek.
- Reload conserva tarefas e alterações.
- Axe nas rotas principais e percurso integral por teclado.
- Central de Recursos cobre vazio, falha, filtros, busca local, criação, edição, detalhe interno, favorito, carregar mais e abertura externa registrada.
- Viewer e member abrem o detalhe interno de um recurso visível sem receber controles de edição.
- Busca por `Ctrl+K`, `Cmd+K` e `/busca` leva ao destino correto por grupo.
- Eventos e Produtos cobrem criação, edição, detalhe, marcos e demanda contextual em desktop e celular.
- A demanda salva um link compartilhável do Drive ou de outro host, abre o destino externo e preserva a formatação rica depois do reload.
- Equipe cobre convite, cópia do link, aceite autenticado, troca do workspace ativo e ações administrativas em desktop e celular.
- A aba Modelo de operação abre sem carregar a gestão de membros, preserva os nomes acessíveis das seções e funciona integralmente por teclado.
- A matriz de permissões usa semântica de tabela e mantém os cabeçalhos associados às células em 390 px, com rolagem restrita ao próprio componente.
- Troca entre workspaces limpa o cache anterior e não reaproveita consultas, detalhes ou links de outro workspace.

## Gates

`pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` são obrigatórios em toda entrega. O frontend e o E2E autenticado podem usar o Supabase hospedado sem Supabase CLI ou Docker. Uma pilha local isolada continua opcional para testes destrutivos de RLS com fixtures controladas. Depois de aplicar migrations novas no hospedado, repetir build, smoke autenticado e os cenários afetados antes de registrar a entrega como validada.
