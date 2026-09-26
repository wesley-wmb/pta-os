import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceSwitcher } from './workspace-switcher';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  selectActiveWorkspace: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

vi.mock('./actions', () => ({
  selectActiveWorkspace: mocks.selectActiveWorkspace,
}));

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError },
}));

const workspaceA = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'PTA Principal',
  role: 'owner' as const,
};
const workspaceB = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'PTA Conteúdo',
  role: 'member' as const,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WorkspaceSwitcher', () => {
  it('clears cached workspace data and navigates safely after selection', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient();
    queryClient.setQueryData(['tasks', workspaceA.id], [{ title: 'Privado' }]);
    mocks.selectActiveWorkspace.mockResolvedValue({ ok: true });
    const onNavigate = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceSwitcher
          currentWorkspaceId={workspaceA.id}
          workspaces={[workspaceA, workspaceB]}
          collapsed={false}
          mobile={false}
          onNavigate={onNavigate}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Trocar workspace' }));
    await user.click(screen.getByText(workspaceB.name));

    await waitFor(() => {
      expect(mocks.selectActiveWorkspace).toHaveBeenCalledWith(workspaceB.id);
    });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(mocks.replace).toHaveBeenCalledWith('/inicio');
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it('keeps the current cache and route when authorization fails', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient();
    queryClient.setQueryData(['tasks', workspaceA.id], [{ title: 'Privado' }]);
    mocks.selectActiveWorkspace.mockResolvedValue({
      ok: false,
      message: 'Você não possui acesso ativo a este workspace.',
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceSwitcher
          currentWorkspaceId={workspaceA.id}
          workspaces={[workspaceA, workspaceB]}
          collapsed={false}
          mobile={false}
          onNavigate={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Trocar workspace' }));
    await user.click(screen.getByText(workspaceB.name));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalled();
    });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('does not render a switch action for a single workspace', () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceSwitcher
          currentWorkspaceId={workspaceA.id}
          workspaces={[workspaceA]}
          collapsed={false}
          mobile={false}
          onNavigate={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText(workspaceA.name)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Trocar workspace' }),
    ).not.toBeInTheDocument();
  });
});
