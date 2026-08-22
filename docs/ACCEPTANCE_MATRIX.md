# Matriz de aceite

| ID  | Cenário                         | Evidência esperada                                              |
| --- | ------------------------------- | --------------------------------------------------------------- |
| A01 | Cadastrar/entrar localmente     | sessão e redirecionamento para Início                           |
| A02 | Bootstrap inicial               | workspace e catálogos criados uma única vez                     |
| A03 | Criar demanda                   | número sequencial e registro no Postgres                        |
| A04 | Ver na Central                  | mesma tarefa, filtros e estado vazio corretos                   |
| A05 | Ver na Semana                   | tarefa aparece no dia de `due_date` sem deslocamento de fuso    |
| A06 | Abrir side peek                 | URL canônica, fundo preservado, fecha com Escape/Voltar         |
| A07 | Editar status/responsável/prazo | RPC valida `version`, lista atualiza e persiste após reload     |
| A08 | Histórico/notificação           | eventos append-only e notificação do responsável                |
| A09 | Isolamento                      | usuário externo ao workspace recebe zero linhas/erro autorizado |
| A10 | Viewer                          | leitura permitida e todas as mutações negadas                   |
| A11 | Responsivo                      | login, shell, Central, Semana e detalhe operáveis em 390 px     |
| A12 | Acessibilidade                  | navegação por teclado, foco e Axe sem violações críticas        |
