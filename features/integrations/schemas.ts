import { z } from 'zod';

import { apiScopes } from './types';

export const apiKeySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(z.enum(apiScopes)),
  created_at: z.iso.datetime(),
  last_used_at: z.iso.datetime().nullable(),
  expires_at: z.iso.datetime().nullable(),
  revoked_at: z.iso.datetime().nullable(),
  version: z.number().int().positive(),
});

export const apiKeyListSchema = z.array(apiKeySchema);

export const createdApiKeySchema = apiKeySchema
  .omit({ last_used_at: true, revoked_at: true })
  .extend({ token: z.string().regex(/^pta_live_[a-f0-9]{10}_[a-f0-9]{64}$/) });

export const automationSettingsSchema = z.object({
  slack_enabled: z.boolean(),
  email_enabled: z.boolean(),
  webhook_enabled: z.boolean(),
  corporate_email_domain: z.string().nullable(),
  notify_on_assignment: z.boolean(),
  notify_on_status_change: z.boolean(),
  notify_on_due_change: z.boolean(),
  notify_on_priority_change: z.boolean(),
  notify_on_content_change: z.boolean(),
  notify_on_comment: z.boolean(),
  collapse_window_seconds: z.number().int().min(0).max(300),
  version: z.number().int().nonnegative(),
});

export const createApiKeyInputSchema = z.object({
  name: z.string().trim().min(3).max(80),
  scopes: z.array(z.enum(apiScopes)).min(1).max(8),
  expiresAt: z.iso.datetime().nullable(),
});

export const automationSettingsInputSchema = z.object({
  version: z.number().int().nonnegative(),
  slackEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  webhookEnabled: z.boolean(),
  corporateEmailDomain: z
    .string()
    .trim()
    .toLowerCase()
    .max(253)
    .regex(/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/)
    .nullable(),
  notifyOnAssignment: z.boolean(),
  notifyOnStatusChange: z.boolean(),
  notifyOnDueChange: z.boolean(),
  notifyOnPriorityChange: z.boolean(),
  notifyOnContentChange: z.boolean(),
  notifyOnComment: z.boolean(),
  collapseWindowSeconds: z.number().int().min(0).max(300),
});

export const integrationListSchema = z.array(
  z.object({
    provider: z.enum(['slack', 'resend']),
    status: z.enum(['active', 'attention', 'disconnected']),
    public_config: z.record(z.string(), z.unknown()),
    updated_at: z.iso.datetime(),
    version: z.number().int().positive(),
  }),
);

export const integrationInputSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('slack'),
    credential: z
      .string()
      .trim()
      .regex(/^xoxb-[A-Za-z0-9-]{15,}$/),
    version: z.number().int().nonnegative(),
    teamName: z.string().trim().min(2).max(100),
  }),
  z.object({
    provider: z.literal('resend'),
    credential: z
      .string()
      .trim()
      .regex(/^re_[A-Za-z0-9_]{15,}$/),
    version: z.number().int().nonnegative(),
    fromAddress: z
      .string()
      .trim()
      .min(6)
      .max(320)
      .regex(/^(?:[^<>]{1,100}\s<)?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/),
  }),
]);
