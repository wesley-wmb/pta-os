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

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type AuthFormInput = z.infer<typeof authFormSchema>;
