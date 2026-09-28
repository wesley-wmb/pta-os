import { describe, expect, it } from 'vitest';

import { authFormSchema, signUpSchema } from '@/features/auth/schemas';

import { newTaskSchema } from './schemas';
import { createEmptyTaskDescription } from './rich-text';

describe('newTaskSchema', () => {
  const valid = {
    title: 'Revisar página de vendas',
    priority: 'medium' as const,
    dueDate: '2026-08-24',
    dueTime: '14:30',
    primaryAssigneeId: 'none',
    typeId: 'none',
    productId: 'none',
    eventId: 'none',
    description: createEmptyTaskDescription(),
    blockedReason: '',
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

  it.each(['2026-02-29', '2026-02-31', '2026-13-01', '2026-00-10'])(
    'rejects impossible calendar date %s before calling the backend',
    (dueDate) => {
      expect(newTaskSchema.safeParse({ ...valid, dueDate }).success).toBe(
        false,
      );
    },
  );

  it('accepts a real leap day without timezone conversion', () => {
    const result = newTaskSchema.parse({ ...valid, dueDate: '2028-02-29' });
    expect(result.dueDate).toBe('2028-02-29');
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
