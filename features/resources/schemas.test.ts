import { describe, expect, it } from 'vitest';

import {
  isSafeHttpsUrl,
  resourceCategoryListPayloadSchema,
  resourceFormSchema,
} from './schemas';

describe('resource URL validation', () => {
  it('accepts normal HTTPS links', () => {
    expect(isSafeHttpsUrl('https://docs.example.com/guia?id=12')).toBe(true);
    expect(isSafeHttpsUrl('https://example.com:65535/guia')).toBe(true);
  });

  it.each([
    'http://example.com',
    'https://user:secret@example.com',
    'https://example.com:0/path',
    'https://example.com:65536/path',
    'https://[::1]/path',
    'javascript:alert(1)',
    'https://exa mple.com',
  ])('rejects an unsafe URL: %s', (value) => {
    expect(isSafeHttpsUrl(value)).toBe(false);
  });

  it('keeps the V1 payload limited to URL resources', () => {
    const result = resourceFormSchema.safeParse({
      title: 'Guia de campanha',
      externalUrl: 'https://example.com/guia',
      resourceType: 'document',
      description: '',
      categoryId: 'none',
      taskIds: [],
      productIds: [],
      eventIds: [],
      tagIds: [],
      isRestricted: false,
      permissions: [],
    });

    expect(result.success).toBe(true);
  });

  it('rejects duplicate or malformed relation identifiers', () => {
    const duplicatedId = '10000000-0000-4000-8000-000000000001';
    const result = resourceFormSchema.safeParse({
      title: 'Guia de campanha',
      externalUrl: 'https://example.com/guia',
      resourceType: 'document',
      description: '',
      categoryId: 'none',
      taskIds: [duplicatedId, duplicatedId],
      productIds: ['fora-do-formato'],
      eventIds: [],
      tagIds: [],
      isRestricted: false,
      permissions: [],
    });

    expect(result.success).toBe(false);
  });
});

describe('resource category snapshot validation', () => {
  it('requires the concurrency snapshot returned by the category list', () => {
    const payload = {
      snapshot: '0123456789abcdef0123456789abcdef',
      categories: [],
      can_manage: true,
    };

    expect(resourceCategoryListPayloadSchema.safeParse(payload).success).toBe(
      true,
    );
    expect(
      resourceCategoryListPayloadSchema.safeParse({
        categories: [],
        can_manage: true,
      }).success,
    ).toBe(false);
  });
});
