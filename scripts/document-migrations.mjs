/** Generates documentation only; never connects to or changes a database. */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { format } from 'prettier';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const snapshot = JSON.parse(
  await read('docs/audits/migrations-2026-09-28.json'),
);
const descriptions = {
  p0_core:
    'Núcleo multiworkspace: perfis, membros, catálogos, tarefas, responsáveis, histórico, notificações, RLS, RPCs e bootstrap local.',
  history_rpc_hardening:
    'Restringe a leitura do histórico pela sessão e pelo workspace.',
  workspace_members_hardening:
    'Restringe colunas e leitura de memberships do workspace.',
  task_due_at_overview:
    'Inclui o horário de conclusão na visão operacional de tarefas.',
  task_collaboration:
    'Checklists, itens, comentários, links e colaboração autorizada.',
  task_collaboration_followup:
    'Evolui comentários e operações de colaboração existentes.',
  resources_search:
    'Central de recursos e busca global com isolamento por workspace.',
  task_collaboration_review_fixes:
    'Corrige contratos e autorização das leituras de colaboração.',
  task_collaboration_realtime_hardening:
    'Fortalece vínculos de colaboração e notificações Realtime.',
  resources_permissions_categories:
    'Protege recursos restritos e criação de categorias.',
  search_prefix: 'Busca textual por prefixo dentro do workspace autorizado.',
  resource_relations_categories:
    'Relações de recursos com tarefas, produtos, eventos e tags; gestão de categorias.',
  task_attachments_storage:
    'Anexos privados, bucket task-attachments e autorização de upload/leitura.',
  events_products_operational:
    'Produtos, eventos, participantes, marcos e RPCs operacionais versionadas.',
  workspace_team_activation:
    'Convites seguros e ciclo administrativo de membros do workspace.',
  global_task_context:
    'Criação global de tarefa e contexto de leitura das visões operacionais.',
  team_operating_model_foundation:
    'Equipes, funções, participantes, dependências, aprovações e handoffs.',
  external_media_links_rich_text:
    'Descrição rica e política histórica de mídia externa; uploads são reativados posteriormente.',
  task_overview_card_metrics:
    'Contadores de colaboração usados nos cards de tarefas.',
  task_overview_description_preview:
    'Resumo textual curto de descrição na visão de tarefas.',
  week_board_operational_lanes:
    'Faixas operacionais persistentes e movimentação no quadro semanal.',
  task_context_updates:
    'Edição do contexto da tarefa mantendo isolamento e versão.',
  task_custom_fields: 'Definições, opções e valores de campos personalizados.',
  task_steps_and_subtasks: 'Passos de checklist e tarefas delegadas completas.',
  profile_identity: 'Edição do próprio perfil com controle de concorrência.',
  workspace_settings: 'Preferências e identidade do workspace versionadas.',
  task_board_ordering: 'Ordenação manual persistente no Kanban por status.',
  task_steps_management:
    'Edição/exclusão de passos e desvinculação segura de tarefas delegadas.',
  project_timeline_planning:
    'Fases, intervalos de datas e movimentação/redimensionamento no cronograma.',
  project_timeline_milestone_management:
    'Criação, edição, exclusão e posicionamento de marcos versionados.',
  link_board_week_special_lanes:
    'Sincronização inicial de faixas especiais entre Kanban e Semana.',
  configurable_task_boards:
    'Colunas configuráveis, chaves semânticas e conexões entre quadros.',
  task_card_archive: 'Arquivamento e restauração de tarefa pela ação do card.',
  board_connection_conflicts:
    'Impede conexões conflitantes entre status e faixas semanais.',
  security_advisor_hardening:
    'Revoga execução cliente de public.rls_auto_enable; exige essa função do ambiente.',
  task_board_column_lifecycle:
    'Cria/edita/remove colunas transferindo tarefas para um destino.',
  restore_configured_board_sync:
    'Restaura sincronização por configurações em vez de nomes legados.',
  week_column_lifecycle:
    'Exclusão de faixas semanais com destino de redirecionamento.',
  api_automation_foundation:
    'Fundação NÃO publicada: chaves de API, Vault, outbox, entregas, Cron e integrações.',
  task_media_descriptions:
    'Descrições em links/anexos e reativação de upload de mídia privada.',
  task_media_description_realtime:
    'Emite atualização privada ao editar descrição do anexo.',
  team_project_navigation: 'Vínculo equipe–evento e diretório de equipes.',
  team_workspace_context:
    'Área de trabalho interna por equipe e criação/arquivamento atômicos.',
  team_context_name_sync: 'Sincroniza nome da equipe com seu contexto interno.',
  team_membership_visibility:
    'Visibilidade apenas para participantes, inclusive administradores.',
  team_private_read_rpcs:
    'Filtra RPCs SECURITY DEFINER antes de agregação e paginação.',
  team_operating_model_visibility:
    'Restringe o modelo operacional às equipes permitidas.',
  team_mutation_privacy:
    'Protege escritas, Storage e Realtime pela participação na equipe.',
};

const files = (await readdir(new URL('supabase/migrations/', root)))
  .filter((f) => /^\d{14}_.+\.sql$/.test(f))
  .sort();
const entries = [];
let sequence = 0;
for (const file of files) {
  const name = file.slice(15, -4);
  if (!descriptions[name])
    throw new Error(`Documente a nova migration: ${file}`);
  const sql = await read(`supabase/migrations/${file}`);
  const remote = snapshot.migrations.find((m) => m.name === name);
  const digest = (algorithm, text) =>
    createHash(algorithm).update(text).digest('hex');
  entries.push({
    step: remote ? String(++sequence).padStart(3, '0') : 'P01',
    name,
    file,
    description: descriptions[name],
    local_version: file.slice(0, 14),
    remote_version: remote?.version ?? null,
    remote_order: remote ? snapshot.migrations.indexOf(remote) + 1 : null,
    status: remote ? 'published' : 'pending',
    sha256_lf: digest('sha256', sql.replace(/\r\n/g, '\n')),
    comparison: !remote
      ? 'not_published'
      : !remote.normalized_md5
        ? 'history_sql_absent'
        : remote.sql_bytes < 100
          ? 'history_placeholder'
          : digest('md5', sql.replace(/\s/g, '')) === remote.normalized_md5
            ? 'matches_ignoring_whitespace'
            : 'different_text_review_required',
    objects: [
      ...new Set(
        [
          ...sql.matchAll(
            /create\s+(?:or\s+replace\s+)?(?:table|function|view|type)\s+(?:if\s+not\s+exists\s+)?([\w.]+)/gi,
          ),
        ].map((m) => m[1]),
      ),
    ],
  });
}
for (const remote of snapshot.migrations)
  if (!entries.some((e) => e.name === remote.name))
    throw new Error(`Migration remota sem arquivo: ${remote.name}`);
const manifest = {
  project_id: snapshot.project_id,
  checked_at: snapshot.checked_at,
  ordering: 'local_dependency_order_excluding_unpublished',
  replay_verified: false,
  entries,
};
await writeFile(
  new URL('docs/database/migration-manifest.json', root),
  await format(JSON.stringify(manifest), { parser: 'json' }),
);
const text = [
  '# Catálogo numerado de migrations',
  '',
  'Gerado por `node scripts/document-migrations.mjs`. Fonte: SQL versionado + histórico remoto consultado em 28/09/2026.',
  '',
  'Leia primeiro [o roteiro de reprodução](README.md). 000 é preparação do ambiente; 001–047 são a sequência local de dependências sem API pendente; P01 é opcional, não integra o banco publicado. A sequência local não é a ordem histórica de publicação. Nenhuma das duas equivale a um replay certificado.',
  '',
  '| Etapa | Migration | Versão remota | Objetivo |',
  '| --- | --- | --- | --- |',
  ...entries.map(
    (e) =>
      `| ${e.step} | [${e.name}](../../supabase/migrations/${e.file}) | ${e.remote_version ?? '**Não publicada**'} | ${e.description} |`,
  ),
  '',
  '## Contratos e rastreabilidade por migration',
  '',
  'Todos os passos publicados dependem do acumulado anterior na sequência local. Funções redefinidas posteriormente substituem versões antigas: não reaplique um passo isolado no banco atual. A lista de objetos abaixo é um índice textual dos CREATEs, não um parser SQL; ALTERs, grants e políticas devem ser lidos no arquivo completo.',
  '',
  ...entries.flatMap((e) => [
    `### ${e.step} — ${e.name}`,
    '',
    e.description,
    '',
    `- SQL: [${e.file}](../../supabase/migrations/${e.file}).`,
    `- Histórico: ${e.remote_version ? `publicada como \`${e.remote_version}\`, posição remota ${e.remote_order}` : 'não publicada; fora da reprodução do ambiente funcional'}.`,
    `- Comparação textual: \`${e.comparison}\`. Diferença textual pode ser comentário ou SQL; não implica equivalência nem divergência semântica.`,
    `- Objetos declarados: ${e.objects.length ? e.objects.map((o) => '`' + o + '`').join(', ') : 'ajustes em objetos existentes; consulte o SQL'}.`,
    '',
  ]),
  '## Atualização',
  '',
  'Após uma nova publicação, atualize o snapshot remoto e o script para sua data, inclua a descrição e regenere este catálogo e o manifesto. Preserve snapshots anteriores como evidência histórica. SHA-256 normaliza CRLF/LF; a comparação MD5 ignora whitespace e serve só para triagem, não para validar SQL semanticamente.',
  '',
].join('\n');
await writeFile(
  new URL('docs/database/MIGRATIONS.md', root),
  await format(text, { parser: 'markdown' }),
);
console.log(
  JSON.stringify(
    {
      published: sequence,
      pending: entries.filter((e) => e.status === 'pending').length,
      timestampDifferences: entries.filter(
        (e) => e.remote_version && e.remote_version !== e.local_version,
      ).length,
      comparison: Object.fromEntries(
        [...new Set(entries.map((e) => e.comparison))].map((k) => [
          k,
          entries.filter((e) => e.comparison === k).length,
        ]),
      ),
    },
    null,
    2,
  ),
);
