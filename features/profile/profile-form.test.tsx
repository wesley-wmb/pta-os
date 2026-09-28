import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { ProfileForm } from './profile-form';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));

afterEach(cleanup);

it('announces pending changes only after editing and exposes field hints', async () => {
  render(
    <ProfileForm
      profile={{
        canEdit: true,
        id: 'user-1',
        fullName: 'Pessoa Teste',
        email: 'teste@example.com',
        initials: 'PT',
        avatarUrl: null,
        pronouns: null,
        jobTitle: null,
        department: null,
        bio: null,
        locale: 'pt-BR',
        updatedAt: '2026-09-27T12:00:00Z',
      }}
    />,
  );
  expect(screen.queryByText('Alterações não salvas')).toBeNull();
  expect(screen.getByText('Nenhuma alteração pendente')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Salvar perfil' })).toBeDisabled();
  const avatar = screen.getByLabelText('Imagem do perfil');
  expect(avatar).toHaveAccessibleDescription(
    'URL HTTPS de uma imagem compartilhável',
  );
  fireEvent.change(screen.getByLabelText(/Nome/), {
    target: { value: 'Pessoa Alterada' },
  });
  await waitFor(() =>
    expect(screen.getByText('Alterações não salvas')).toBeDefined(),
  );
  expect(screen.getByRole('button', { name: 'Salvar perfil' })).toBeEnabled();
});
