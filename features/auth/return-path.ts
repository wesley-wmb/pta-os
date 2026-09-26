const workspaceRoutes = new Set([
  '/inicio',
  '/semana',
  '/demandas',
  '/eventos',
  '/projetos',
  '/produtos',
  '/recursos',
  '/equipe',
  '/historico',
]);
const passwordRecoveryRoutes = new Set(['/nova-senha']);
const invitationRoutePattern = /^\/convite\/[0-9a-f]{64}$/i;

export function safeWorkspaceReturnPath(value: string | null) {
  const target = parseInternalPath(value);
  if (!target) return '/inicio';
  if (
    workspaceRoutes.has(target.pathname) ||
    /^\/tarefa\/[0-9a-f-]+$/i.test(target.pathname) ||
    invitationRoutePattern.test(target.pathname)
  ) {
    return `${target.pathname}${target.search}`;
  }
  return '/inicio';
}

export function safeAuthReturnPath(value: string | null) {
  const target = parseInternalPath(value);
  if (target && passwordRecoveryRoutes.has(target.pathname)) {
    return target.pathname;
  }
  return safeWorkspaceReturnPath(value);
}

export function safeRecoveryReturnPath(value: string | null) {
  const target = parseInternalPath(value);
  if (target && passwordRecoveryRoutes.has(target.pathname)) {
    return target.pathname;
  }
  return '/nova-senha';
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
