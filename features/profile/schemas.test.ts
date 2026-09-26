import { describe, expect, it } from 'vitest';

import {
  initialsFor,
  profileFormSchema,
  profileResponseSchema,
} from './schemas';

describe('profile schemas', () => {
  it('aceita identidade profissional concisa e avatar HTTPS', () => {
    expect(
      profileFormSchema.parse({
        fullName: '  Bruna Martins  ',
        pronouns: 'ela/dela',
        jobTitle: 'Diretora de arte',
        department: 'Criação',
        bio: 'Transformo objetivos em sistemas visuais.',
        avatarUrl: 'https://images.example.com/bruna.jpg',
      }),
    ).toMatchObject({ fullName: 'Bruna Martins' });
  });

  it('rejeita avatar sem HTTPS e campos excessivos', () => {
    expect(
      profileFormSchema.safeParse({
        fullName: 'Wesley',
        pronouns: '',
        jobTitle: '',
        department: '',
        bio: 'x'.repeat(501),
        avatarUrl: 'http://example.com/avatar.jpg',
      }).success,
    ).toBe(false);
  });

  it('normaliza o contrato do banco e calcula iniciais quando necessário', () => {
    const parsed = profileResponseSchema.parse({
      id: '55b9c7a7-11a8-45d4-9f75-fac6f2f6c4c4',
      full_name: 'Ana Clara Souza',
      email: 'ana@pta.test',
      initials: null,
      avatar_path: null,
      pronouns: null,
      job_title: 'Designer',
      department: 'Criação',
      bio: null,
      locale: 'pt-BR',
      updated_at: '2026-09-25T10:30:00+00:00',
    });

    expect(parsed).toMatchObject({
      fullName: 'Ana Clara Souza',
      initials: 'AC',
    });
    expect(initialsFor('Wesley')).toBe('W');
  });
});
