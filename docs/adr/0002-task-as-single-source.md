# ADR 0002 — Tarefa como fonte única

Status: aceito em 22 de agosto de 2026.

## Decisão

Central, Semana, contextos de Produto/Evento e detalhe exibem a mesma linha de `tasks`. Não existem cópias por visão.

## Consequências

- Alterações aparecem em todas as visões por invalidação/Reatime.
- Datas permanecem separadas entre dia e hora.
- A URL `/tarefa/[taskId]` é canônica e pode ser renderizada em página completa ou peek interceptado.
