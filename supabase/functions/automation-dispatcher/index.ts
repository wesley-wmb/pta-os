type Delivery = {
  delivery_id: string;
  channel: 'slack' | 'email';
  event_type: string;
  attempt_count: number;
  payload: {
    task_id: string;
    task_title: string;
    project_name: string;
    status_name: string;
    due_date: string | null;
    recipient_email: string;
  };
  credential: string;
  public_config: Record<string, unknown>;
  previous_destination_id: string | null;
  previous_message_id: string | null;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const secretKey = resolveSecretKey();
const dispatchSecret = Deno.env.get('PTA_DISPATCH_SECRET');
const appBaseUrl = Deno.env.get('PTA_APP_BASE_URL');

if (!supabaseUrl || !secretKey || !dispatchSecret || !appBaseUrl) {
  throw new Error('PTA_DISPATCHER_CONFIGURATION_MISSING');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST')
    return Response.json({ error: 'method' }, { status: 405 });
  if (request.headers.get('x-dispatch-secret') !== dispatchSecret) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const deliveries = (await rpc('claim_automation_deliveries', {
    p_limit: 25,
  })) as Delivery[];
  let sent = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    try {
      const receipt =
        delivery.channel === 'slack'
          ? await sendSlack(delivery)
          : await sendEmail(delivery);
      await complete(delivery, true, receipt);
      sent += 1;
    } catch (error) {
      const code = sanitizeError(error);
      await complete(delivery, false, { errorCode: code });
      failed += 1;
    }
  }

  return Response.json({ claimed: deliveries.length, sent, failed });
});

async function sendSlack(delivery: Delivery) {
  const text = formatMessage(delivery);
  if (delivery.previous_destination_id && delivery.previous_message_id) {
    try {
      const updated = await slackApi(delivery.credential, 'chat.update', {
        channel: delivery.previous_destination_id,
        ts: delivery.previous_message_id,
        text,
      });
      return {
        destinationId: delivery.previous_destination_id,
        messageId: String(updated.ts ?? delivery.previous_message_id),
        responseCode: 200,
      };
    } catch (error) {
      if (!isMissingSlackMessage(error)) throw error;
    }
  }

  const user = await slackApi(delivery.credential, 'users.lookupByEmail', {
    email: delivery.payload.recipient_email,
  });
  const userId = asRecord(user.user).id;
  if (typeof userId !== 'string') throw new Error('SLACK_USER_NOT_FOUND');
  const conversation = await slackApi(
    delivery.credential,
    'conversations.open',
    {
      users: userId,
    },
  );
  const channelId = asRecord(conversation.channel).id;
  if (typeof channelId !== 'string') throw new Error('SLACK_DM_NOT_AVAILABLE');
  const posted = await slackApi(delivery.credential, 'chat.postMessage', {
    channel: channelId,
    text,
    client_msg_id: delivery.delivery_id,
  });
  return {
    destinationId: channelId,
    messageId: String(posted.ts ?? ''),
    responseCode: 200,
  };
}

async function sendEmail(delivery: Delivery) {
  const from = delivery.public_config.from;
  if (typeof from !== 'string' || !from) throw new Error('EMAIL_FROM_MISSING');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${delivery.credential}`,
      'content-type': 'application/json',
      'idempotency-key': delivery.delivery_id,
    },
    body: JSON.stringify({
      from,
      to: [delivery.payload.recipient_email],
      subject: `PTA OS | ${actionLabel(delivery.event_type)}`,
      text: formatMessage(delivery),
    }),
  });
  const body = asRecord(await response.json().catch(() => ({})));
  if (!response.ok) throw new Error(`EMAIL_${response.status}`);
  return {
    destinationId: delivery.payload.recipient_email,
    messageId: typeof body.id === 'string' ? body.id : null,
    responseCode: response.status,
  };
}

async function slackApi(
  token: string,
  method: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });
  const payload = asRecord(await response.json());
  if (!response.ok || payload.ok !== true) {
    const error =
      typeof payload.error === 'string'
        ? payload.error
        : `HTTP_${response.status}`;
    throw new Error(`SLACK_${error}`);
  }
  return payload;
}

function formatMessage(delivery: Delivery) {
  const taskUrl = `${appBaseUrl!.replace(/\/$/u, '')}/tarefa/${delivery.payload.task_id}`;
  const due = delivery.payload.due_date
    ? delivery.payload.due_date.split('-').reverse().join('/')
    : 'Sem prazo';
  return [
    `PTA OS | ${actionLabel(delivery.event_type)}`,
    '',
    `Tarefa: ${delivery.payload.task_title}`,
    `Projeto: ${delivery.payload.project_name}`,
    `Etapa: ${delivery.payload.status_name}`,
    `Prazo: ${due}`,
    '',
    `Abrir tarefa: ${taskUrl}`,
  ].join('\n');
}

function actionLabel(eventType: string) {
  const labels: Record<string, string> = {
    'task.assigned': 'Nova tarefa atribuída',
    'task.updated': 'Tarefa atualizada',
    'task.status_changed': 'Etapa alterada',
    'task.completed': 'Tarefa concluída',
    'task.reopened': 'Tarefa reaberta',
    'task.comment_added': 'Novo comentário',
    'task.archived': 'Tarefa arquivada',
  };
  return labels[eventType] ?? 'Tarefa atualizada';
}

async function complete(
  delivery: Delivery,
  success: boolean,
  receipt: {
    destinationId?: string | null;
    messageId?: string | null;
    responseCode?: number | null;
    errorCode?: string | null;
  },
) {
  await rpc('complete_automation_delivery', {
    p_delivery_id: delivery.delivery_id,
    p_success: success,
    p_external_destination_id: receipt.destinationId ?? null,
    p_external_message_id: receipt.messageId ?? null,
    p_response_code: receipt.responseCode ?? null,
    p_error_code: receipt.errorCode ?? null,
  });
}

async function rpc(name: string, body: Record<string, unknown>) {
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
  if (!response.ok) throw new Error(`DATABASE_${response.status}`);
  return payload;
}

function resolveSecretKey() {
  const current = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (current) {
    try {
      const parsed = JSON.parse(current) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch {
      // Legacy local projects use the fallback below.
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
}

function sanitizeError(error: unknown) {
  const value = error instanceof Error ? error.message : 'UNKNOWN';
  return value.replace(/[^A-Z0-9_:-]/giu, '_').slice(0, 120);
}

function isMissingSlackMessage(error: unknown) {
  if (!(error instanceof Error)) return false;
  return [
    'SLACK_message_not_found',
    'SLACK_cant_update_message',
    'SLACK_channel_not_found',
  ].includes(error.message);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
