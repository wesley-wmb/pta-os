import { describe, expect, it } from 'vitest';

import { authFormSchema, signUpSchema } from '@/features/auth/schemas';

import { newTaskSchema } from './schemas';

describe('newTaskSchema', () => {
  const valid = {
    title: 'Revisar página de vendas',
    priority: 'medium' as const,
    dueDate: '2026-08-24',
    dueTime: '14:30',
    primaryAssigneeId: 'none',
  };

  it('accepts a date-only task', () => {
    expect(newTaskSchema.safeParse({ ...valid, dueTime: '' }).success).toBe(
      true,
    );
  });

  it('rejects time without date', () => {
    const result = newTaskSchema.safeParse({ ...valid, dueDate: '' });
    expect(result.success).toBe(false);
  });

  it('rejects malformed dates and times', () => {
    expect(
      newTaskSchema.safeParse({ ...valid, dueDate: '24/08/2026' }).success,
    ).toBe(false);
    expect(
      newTaskSchema.safeParse({ ...valid, dueTime: '25:90' }).success,
    ).toBe(false);
  });
});

describe('auth schemas', () => {
  it('requires a valid e-mail and an eight-character password', () => {
    expect(
      authFormSchema.safeParse({
        fullName: '',
        email: 'invalido',
        password: '123',
      }).success,
    ).toBe(false);
  });

  it('requires a name only for sign-up', () => {
    expect(
      signUpSchema.safeParse({
        fullName: '',
        email: 'user@example.com',
        password: '12345678',
      }).success,
    ).toBe(false);
  });
});
