import { describe, expect, it } from 'vitest';

import {
  automationSettingsInputSchema,
  createApiKeyInputSchema,
  integrationInputSchema,
} from './schemas';

describe('developer platform schemas', () => {
  it('accepts a least-privilege API key request', () => {
    expect(
      createApiKeyInputSchema.parse({
        name: 'Leitura operacional',
        scopes: ['tasks:read'],
        expiresAt: null,
      }),
    ).toEqual({
      name: 'Leitura operacional',
      scopes: ['tasks:read'],
      expiresAt: null,
    });
  });

  it('rejects unknown API scopes', () => {
    expect(
      createApiKeyInputSchema.safeParse({
        name: 'Acesso total',
        scopes: ['workspace:admin'],
        expiresAt: null,
      }).success,
    ).toBe(false);
  });

  it('normalizes and validates the corporate domain', () => {
    const result = automationSettingsInputSchema.parse({
      version: 0,
      slackEnabled: false,
      emailEnabled: false,
      webhookEnabled: false,
      corporateEmailDomain: ' PTADIGITAL.COM.BR ',
      notifyOnAssignment: true,
      notifyOnStatusChange: true,
      notifyOnDueChange: true,
      notifyOnPriorityChange: true,
      notifyOnContentChange: true,
      notifyOnComment: true,
      collapseWindowSeconds: 60,
    });
    expect(result.corporateEmailDomain).toBe('ptadigital.com.br');
  });

  it('accepts only bot tokens and verified-style sender addresses', () => {
    expect(
      integrationInputSchema.safeParse({
        provider: 'slack',
        credential: ['xoxb', '123456789012345', 'abcdefghijklmnop'].join('-'),
        version: 0,
        teamName: 'PTA Digital',
      }).success,
    ).toBe(true);
    expect(
      integrationInputSchema.safeParse({
        provider: 'resend',
        credential: 're_1234567890abcdefghij',
        version: 0,
        fromAddress: 'Cláudio <notificacoes@ptadigital.com.br>',
      }).success,
    ).toBe(true);
    expect(
      integrationInputSchema.safeParse({
        provider: 'slack',
        credential: 'token-generico',
        version: 0,
        teamName: 'PTA Digital',
      }).success,
    ).toBe(false);
  });
});
