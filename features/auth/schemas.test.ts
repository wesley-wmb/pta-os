import { describe, expect, it } from 'vitest';

import { newPasswordSchema, passwordRecoverySchema } from './schemas';

describe('passwordRecoverySchema', () => {
  it('accepts a valid e-mail address', () => {
    expect(
      passwordRecoverySchema.safeParse({ email: 'wesley@example.com' }).success,
    ).toBe(true);
  });

  it.each([
    '',
    'wesley',
    'wesley@',
    '@example.com',
    'wesley example.com',
    ' wesley@example.com ',
  ])('rejects an invalid e-mail address: %s', (email) => {
    const result = passwordRecoverySchema.safeParse({ email });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['email']);
      expect(result.error.issues[0]?.message).toBe('Informe um e-mail válido.');
    }
  });
});

describe('newPasswordSchema', () => {
  it.each([8, 72])(
    'accepts matching passwords with %i characters',
    (length) => {
      const password = 'a'.repeat(length);

      expect(
        newPasswordSchema.safeParse({
          password,
          passwordConfirmation: password,
        }).success,
      ).toBe(true);
    },
  );

  it.each([
    [7, 'Use pelo menos 8 caracteres.'],
    [73, 'Use no máximo 72 caracteres.'],
  ])('rejects a password with %i characters', (length, message) => {
    const password = 'a'.repeat(length as number);
    const result = newPasswordSchema.safeParse({
      password,
      passwordConfirmation: password,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['password']);
      expect(result.error.issues[0]?.message).toBe(message);
    }
  });

  it('rejects passwords that do not match', () => {
    const result = newPasswordSchema.safeParse({
      password: 'senha-segura',
      passwordConfirmation: 'senha-diferente',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['passwordConfirmation'],
          message: 'As senhas não coincidem.',
        }),
      );
    }
  });

  it('compares passwords exactly', () => {
    const result = newPasswordSchema.safeParse({
      password: 'SenhaSegura',
      passwordConfirmation: 'senhasegura',
    });

    expect(result.success).toBe(false);
  });
});
