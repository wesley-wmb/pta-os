/** Read-only comparison. Input: { project_id, migrations: [{ version, name }] }. */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const projectId = 'cmrufxuwrracarokrcif';
const source = process.argv[2];
if (!source) {
  console.error('Uso: node scripts/audit-migrations.mjs <export-remoto.json>');
  process.exit(2);
}
const snapshot = JSON.parse(await readFile(source, 'utf8'));
if (snapshot.project_id !== projectId || !Array.isArray(snapshot.migrations)) {
  throw new Error(
    'O export deve identificar o projeto PTA OS e incluir migrations.',
  );
}
const remote = snapshot.migrations;
if (
  remote.some(
    (item) =>
      !/^\d{14}$/.test(String(item.version)) || typeof item.name !== 'string',
  )
) {
  throw new Error('Formato inválido de migration remota.');
}
const directory = fileURLToPath(
  new URL('../supabase/migrations/', import.meta.url),
);
const local = (await readdir(directory)).flatMap((file) => {
  const match = /^(\d{14})_(.+)\.sql$/.exec(file);
  return match ? [{ version: match[1], name: match[2] }] : [];
});
const report = {
  project_id: projectId,
  local_count: local.length,
  remote_count: remote.length,
  duplicate_local_names: local.filter(
    (item, index) =>
      local.findIndex((other) => other.name === item.name) !== index,
  ),
  duplicate_remote_names: remote.filter(
    (item, index) =>
      remote.findIndex((other) => other.name === item.name) !== index,
  ),
  remote_missing_locally: remote.filter(
    (item) => !local.some((other) => other.name === item.name),
  ),
  local_not_remote: local.filter(
    (item) => !remote.some((other) => other.name === item.name),
  ),
  version_mismatch: remote.flatMap((item) => {
    const match = local.find((other) => other.name === item.name);
    return match && match.version !== String(item.version)
      ? [
          {
            name: item.name,
            local_version: match.version,
            remote_version: String(item.version),
          },
        ]
      : [];
  }),
};
console.log(JSON.stringify(report, null, 2));
if (
  Object.values(report).some(
    (value) => Array.isArray(value) && value.length > 0,
  )
) {
  process.exitCode = 1;
}
