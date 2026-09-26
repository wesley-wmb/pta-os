const TASKS_FALLBACK_PATH = '/demandas';
const projectPathPattern =
  /^\/projetos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Keeps task overlays inside the workspace route that opened them without
 * allowing an arbitrary URL to become a client-side redirect target.
 */
export function safeTaskReturnPath(
  value: string | null,
  fallback = TASKS_FALLBACK_PATH,
) {
  const target = parseInternalPath(value);
  if (!target) return fallback;

  if (
    target.pathname === '/demandas' ||
    target.pathname === '/inicio' ||
    projectPathPattern.test(target.pathname)
  ) {
    return `${target.pathname}${target.search}`;
  }

  return fallback;
}

export function taskHrefWithReturn(taskId: string, returnPath: string) {
  const safeReturnPath = safeTaskReturnPath(returnPath);
  return `/tarefa/${encodeURIComponent(taskId)}?retorno=${encodeURIComponent(safeReturnPath)}`;
}

function parseInternalPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\\')) return null;

  try {
    const target = new URL(value, 'https://pta.internal');
    return target.origin === 'https://pta.internal' ? target : null;
  } catch {
    return null;
  }
}
