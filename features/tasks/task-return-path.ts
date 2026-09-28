const TASKS_FALLBACK_PATH = '/demandas';
const contextPathPattern =
  /^\/(?:projetos|equipes)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    target.pathname === '/semana' ||
    target.pathname === '/busca' ||
    target.pathname === '/historico' ||
    target.pathname === '/produtos' ||
    target.pathname === '/projetos' ||
    target.pathname === '/equipes' ||
    contextPathPattern.test(target.pathname)
  ) {
    return `${target.pathname}${target.search}`;
  }

  return fallback;
}

/** Nested task navigation keeps the original view rather than the parent modal. */
export function taskReturnContext(pathname: string, search: string) {
  if (pathname.startsWith('/tarefa/')) {
    return safeTaskReturnPath(new URLSearchParams(search).get('retorno'));
  }
  return safeTaskReturnPath(`${pathname}${search ? `?${search}` : ''}`);
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
