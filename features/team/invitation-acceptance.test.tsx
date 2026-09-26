import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InvitationAcceptance } from './invitation-acceptance';

const mocks = vi.hoisted(() => ({
  acceptWorkspaceInvitation: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  selectActiveWorkspace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));

vi.mock('./api', () => ({
  acceptWorkspaceInvitation: mocks.acceptWorkspaceInvitation,
}));

vi.mock('@/features/workspace/actions', () => ({
  selectActiveWorkspace: mocks.selectActiveWorkspace,
}));

const token = 'a'.repeat(64);
const workspaceId = '3d2acb70-91c3-4b96-8eb4-aea1f856ff92';
const pendingState = {
  authStatus: 'authenticated' as const,
  currentEmail: 'pessoa@pta.com.br',
  invitation: {
    status: 'pending' as const,
    workspaceId,
    workspaceName: 'PTA Conteúdo',
    role: 'member' as const,
    expiresAt: '2026-08-29T12:00:00+00:00',
  },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('InvitationAcceptance', () => {
  it('selects the accepted workspace, clears the cache and navigates from the final button', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      ['tasks', 'workspace-anterior'],
      [{ title: 'Dado reservado' }],
    );
    mocks.acceptWorkspaceInvitation.mockResolvedValue({
      workspaceId,
      workspaceName: 'PTA Conteúdo',
    });
    mocks.selectActiveWorkspace.mockResolvedValue({ ok: true });

    render(
      <QueryClientProvider client={queryClient}>
        <InvitationAcceptance
          token={token}
          state={pendingState}
          signUpEnabled
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));

    await waitFor(() => {
      expect(mocks.selectActiveWorkspace).toHaveBeenCalledWith(workspaceId);
      expect(screen.getByText('Acesso confirmado')).toBeInTheDocument();
    });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(mocks.replace).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: 'Entrar no workspace' }),
    );

    expect(mocks.replace).toHaveBeenCalledWith('/inicio');
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it('does not navigate or clear data when workspace selection fails', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      ['tasks', 'workspace-anterior'],
      [{ title: 'Dado reservado' }],
    );
    mocks.acceptWorkspaceInvitation.mockResolvedValue({
      workspaceId,
      workspaceName: 'PTA Conteúdo',
    });
    mocks.selectActiveWorkspace.mockResolvedValue({
      ok: false,
      message: 'Você não possui acesso ativo a este workspace.',
    });

    render(
      <QueryClientProvider client={queryClient}>
        <InvitationAcceptance
          token={token}
          state={pendingState}
          signUpEnabled
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));

    expect(
      await screen.findByText('Você não possui acesso ativo a este workspace.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tentar abrir o workspace' }),
    ).toBeInTheDocument();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
