import { z } from 'zod';

export const signInSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
});

export const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().min(2, 'Informe seu nome.').max(120),
});

export const authFormSchema = signInSchema.extend({
  fullName: z.string(),
});

export const passwordRecoverySchema = z.object({
  email: z.email('Informe um e-mail válido.'),
});

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Use pelo menos 8 caracteres.')
      .max(72, 'Use no máximo 72 caracteres.'),
    passwordConfirmation: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    message: 'As senhas não coincidem.',
    path: ['passwordConfirmation'],
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type AuthFormInput = z.infer<typeof authFormSchema>;
export type PasswordRecoveryInput = z.infer<typeof passwordRecoverySchema>;
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
