type JsonObject = Record<string, unknown>;

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const secretKey = resolveSecretKey();

if (!supabaseUrl || !secretKey) {
  throw new Error('PTA_API_SERVER_CONFIGURATION_MISSING');
}

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();

  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    const token = readBearerToken(request);
    if (!token) {
      return apiError(401, 'unauthorized', 'Chave de API ausente.', requestId);
    }

    const url = new URL(request.url);
    const segments = apiSegments(url.pathname);
    if (segments[0] !== 'v1' || segments[1] !== 'tasks') {
      return apiError(404, 'not_found', 'Endpoint não encontrado.', requestId);
    }

    if (request.method === 'GET' && segments.length === 2) {
      const limit = parseLimit(url.searchParams.get('limit'));
      const cursor = parseCursor(url.searchParams.get('cursor'));
      const result = await callRpc('api_list_tasks', {
        p_token: token,
        p_limit: limit,
        p_before_updated_at: cursor?.updated_at ?? null,
        p_before_id: cursor?.id ?? null,
      });
      const nextCursor = isRecord(result) ? result.next_cursor : null;
      return apiResponse(
        {
          ...asObject(result),
          next_cursor: nextCursor ? encodeCursor(nextCursor) : null,
        },
        200,
        requestId,
        request,
      );
    }

    const taskId = segments[2];
    if (request.method === 'GET' && taskId && segments.length === 3) {
      return apiResponse(
        await callRpc('api_get_task', { p_token: token, p_task_id: taskId }),
        200,
        requestId,
        request,
      );
    }

    if (request.method === 'POST' && segments.length === 2) {
      const body = await readJson(request);
      const result = await callRpc('api_create_task', {
        p_token: token,
        p_title: body.title,
        p_status_id: body.status_id ?? null,
        p_priority: body.priority ?? 'medium',
        p_due_date: body.due_date ?? null,
        p_due_time: body.due_time ?? null,
        p_primary_assignee_id: body.primary_assignee_id ?? null,
        p_type_id: body.type_id ?? null,
        p_product_id: body.product_id ?? null,
        p_event_id: body.project_id ?? null,
        p_description: body.description ?? null,
        p_blocked_reason: body.blocked_reason ?? null,
      });
      return apiResponse({ data: result }, 201, requestId, request);
    }

    if (request.method === 'PATCH' && taskId && segments.length === 3) {
      const body = await readJson(request);
      requireInteger(body.expected_version, 'expected_version');
      const result = await callRpc('api_update_task', {
        p_token: token,
        p_task_id: taskId,
        p_expected_version: body.expected_version,
        p_patch: body.patch,
      });
      return apiResponse({ data: result }, 200, requestId, request);
    }

    if (
      request.method === 'PUT' &&
      taskId &&
      segments[3] === 'assignee' &&
      segments.length === 4
    ) {
      const body = await readJson(request);
      requireInteger(body.expected_version, 'expected_version');
      const result = await callRpc('api_set_task_assignee', {
        p_token: token,
        p_task_id: taskId,
        p_user_id: body.user_id ?? null,
        p_expected_version: body.expected_version,
      });
      return apiResponse({ data: result }, 200, requestId, request);
    }

    if (
      request.method === 'POST' &&
      taskId &&
      segments[3] === 'comments' &&
      segments.length === 4
    ) {
      const body = await readJson(request);
      const result = await callRpc('api_add_task_comment', {
        p_token: token,
        p_task_id: taskId,
        p_body: body.body,
        p_parent_comment_id: body.parent_comment_id ?? null,
      });
      return apiResponse({ data: result }, 201, requestId, request);
    }

    return apiError(
      405,
      'method_not_allowed',
      'Método não permitido.',
      requestId,
    );
  } catch (error) {
    return mapError(error, requestId, request);
  }
});

function resolveSecretKey() {
  const current = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (current) {
    try {
      const parsed = JSON.parse(current) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch {
      // The legacy fallback below keeps local projects usable during key migration.
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
}

async function callRpc(name: string, body: JsonObject) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: secretKey!,
      authorization: `Bearer ${secretKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const rpcError = new Error(
      isRecord(payload) && typeof payload.message === 'string'
        ? payload.message
        : 'PTA_API_RPC_FAILED',
    );
    Object.assign(rpcError, {
      code: isRecord(payload) ? payload.code : undefined,
      status: response.status,
    });
    throw rpcError;
  }
  return payload;
}

function apiSegments(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  const functionIndex = parts.indexOf('pta-api');
  return functionIndex >= 0 ? parts.slice(functionIndex + 1) : parts;
}

function readBearerToken(request: Request) {
  const value = request.headers.get('authorization');
  if (!value?.startsWith('Bearer ')) return null;
  const token = value.slice(7).trim();
  return /^pta_live_[a-f0-9]{10}_[a-f0-9]{64}$/.test(token) ? token : null;
}

async function readJson(request: Request): Promise<JsonObject> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    throw Object.assign(new Error('PTA_API_JSON_REQUIRED'), { status: 415 });
  }
  const body = await request.json();
  if (!isRecord(body)) {
    throw Object.assign(new Error('PTA_API_BODY_INVALID'), { status: 422 });
  }
  return body;
}

function parseLimit(value: string | null) {
  if (!value) return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw Object.assign(new Error('PTA_API_LIMIT_INVALID'), { status: 422 });
  }
  return parsed;
}

function parseCursor(value: string | null) {
  if (!value) return null;
  try {
    const decoded = JSON.parse(atob(fromBase64Url(value)));
    if (
      !isRecord(decoded) ||
      typeof decoded.updated_at !== 'string' ||
      typeof decoded.id !== 'string'
    ) {
      throw new Error('invalid');
    }
    return { updated_at: decoded.updated_at, id: decoded.id };
  } catch {
    throw Object.assign(new Error('PTA_API_CURSOR_INVALID'), { status: 422 });
  }
}

function encodeCursor(value: unknown) {
  return toBase64Url(btoa(JSON.stringify(value)));
}

function toBase64Url(value: string) {
  return value.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  return normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
}

function requireInteger(value: unknown, field: string) {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw Object.assign(new Error(`PTA_API_${field.toUpperCase()}_INVALID`), {
      status: 422,
    });
  }
}

function mapError(error: unknown, requestId: string, request: Request) {
  const value = error instanceof Error ? error : new Error('PTA_API_UNKNOWN');
  const code = String((value as Error & { code?: string }).code ?? '');
  const explicitStatus = Number((value as Error & { status?: number }).status);
  const status =
    explicitStatus >= 400 && explicitStatus < 600
      ? explicitStatus
      : value.message === 'PTA_API_KEY_INVALID' || code === '28000'
        ? 401
        : value.message === 'PTA_FORBIDDEN' || code === '42501'
          ? 403
          : value.message === 'PTA_TASK_NOT_FOUND' || code === 'P0002'
            ? 404
            : value.message === 'PTA_VERSION_CONFLICT' || code === '40001'
              ? 409
              : code === '22023' || code === '23514'
                ? 422
                : 500;
  const publicCode =
    status === 401
      ? 'unauthorized'
      : status === 403
        ? 'forbidden'
        : status === 404
          ? 'not_found'
          : status === 409
            ? 'version_conflict'
            : status === 422 || status === 415
              ? 'invalid_request'
              : 'internal_error';
  const message =
    status === 500
      ? 'Não foi possível processar a solicitação.'
      : humanizeError(value.message);
  return apiError(status, publicCode, message, requestId, request);
}

function humanizeError(message: string) {
  const messages: Record<string, string> = {
    PTA_API_KEY_INVALID:
      'Chave inválida, expirada, revogada ou sem o escopo necessário.',
    PTA_FORBIDDEN: 'A credencial não pode executar esta operação.',
    PTA_TASK_NOT_FOUND: 'Tarefa não encontrada.',
    PTA_VERSION_CONFLICT:
      'A tarefa foi alterada. Leia a versão atual e tente novamente.',
    PTA_API_JSON_REQUIRED: 'Envie o corpo como application/json.',
    PTA_API_BODY_INVALID: 'O corpo da solicitação é inválido.',
    PTA_API_LIMIT_INVALID: 'O limite deve estar entre 1 e 100.',
    PTA_API_CURSOR_INVALID: 'O cursor informado é inválido.',
  };
  return messages[message] ?? 'Revise os dados enviados.';
}

function apiResponse(
  body: unknown,
  status: number,
  requestId: string,
  request: Request,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...jsonHeaders,
      ...corsHeaders(request),
      'x-request-id': requestId,
    },
  });
}

function apiError(
  status: number,
  code: string,
  message: string,
  requestId: string,
  request?: Request,
) {
  return new Response(
    JSON.stringify({ error: { code, message, request_id: requestId } }),
    {
      status,
      headers: {
        ...jsonHeaders,
        ...(request ? corsHeaders(request) : {}),
        'x-request-id': requestId,
      },
    },
  );
}

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin');
  const allowedOrigins = (Deno.env.get('PTA_API_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const allowedOrigin =
    origin && allowedOrigins.includes(origin) ? origin : 'null';
  return {
    'access-control-allow-origin': allowedOrigin,
    'access-control-allow-headers':
      'authorization, content-type, idempotency-key',
    'access-control-allow-methods': 'GET, POST, PATCH, PUT, OPTIONS',
    vary: 'Origin',
  };
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asObject(value: unknown): JsonObject {
  return isRecord(value) ? value : {};
}
