import { z } from 'zod';

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum, `Use no máximo ${maximum} caracteres.`);

export const profileFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Informe seu nome.')
    .max(120, 'Use no máximo 120 caracteres.'),
  pronouns: optionalText(50),
  jobTitle: optionalText(100),
  department: optionalText(100),
  bio: optionalText(500),
  avatarUrl: z
    .string()
    .trim()
    .max(2048, 'O endereço da imagem é muito longo.')
    .refine(
      (value) => !value || /^https:\/\/\S+$/i.test(value),
      'Use um endereço HTTPS válido.',
    ),
});

export const profileResponseSchema = z
  .object({
    id: z.uuid(),
    full_name: z.string().min(2).max(120),
    email: z.email(),
    initials: z.string().nullable(),
    avatar_path: z.string().nullable(),
    pronouns: z.string().nullable(),
    job_title: z.string().nullable(),
    department: z.string().nullable(),
    bio: z.string().nullable(),
    locale: z.string(),
    updated_at: z.iso.datetime({ offset: true }),
  })
  .transform((profile) => ({
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    initials: profile.initials || initialsFor(profile.full_name),
    avatarUrl: profile.avatar_path,
    pronouns: profile.pronouns,
    jobTitle: profile.job_title,
    department: profile.department,
    bio: profile.bio,
    locale: profile.locale,
    updatedAt: profile.updated_at,
  }));

export type ProfileFormInput = z.infer<typeof profileFormSchema>;

export function initialsFor(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('pt-BR'))
    .join('');
}
