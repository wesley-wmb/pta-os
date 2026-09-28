import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamEditorButton, TeamMembersPanel } from './operating-team-controls';
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const team = {
  id: 'team',
  name: 'Captação',
  description: null,
  color: 'blue',
  version: 4,
};
describe('operating team controls', () => {
  it('creates an operational workspace and opens the resulting team', async () => {
    mocks.rpc.mockResolvedValue({
      error: null,
      data: { team: { id: 'new-team' } },
    });
    render(<TeamEditorButton workspaceId="workspace" compact />);
    fireEvent.click(screen.getByRole('button', { name: 'Nova equipe' }));
    fireEvent.change(screen.getByLabelText('Nome da equipe'), {
      target: { value: 'Comercial' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar equipe' }));
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith('/equipes/new-team'),
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      'create_operating_team_workspace',
      expect.objectContaining({
        p_workspace_id: 'workspace',
        p_name: 'Comercial',
      }),
    );
  });
  it('keeps the form and reports concurrent updates without discarding the draft', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'PTA_VERSION_CONFLICT' } });
    render(<TeamEditorButton workspaceId="workspace" team={team} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar equipe' }));
    fireEvent.change(screen.getByLabelText('Nome da equipe'), {
      target: { value: 'Vendas' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('outra sessão'),
    );
    expect(screen.getByLabelText('Nome da equipe')).toHaveValue('Vendas');
    expect(mocks.rpc).toHaveBeenCalledWith(
      'update_operating_team',
      expect.objectContaining({ p_expected_version: 4, p_team_id: 'team' }),
    );
  });
  it('requires confirmation and sends membership version when removing', async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    render(
      <TeamMembersPanel
        workspaceId="workspace"
        teamId="team"
        members={[]}
        currentMembers={[
          {
            user_id: 'person',
            full_name: 'Pessoa',
            team_role: 'member',
            version: 7,
            is_primary_team: false,
          },
        ]}
        canManage
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Remover Pessoa da equipe' }),
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remover da equipe' }));
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith('remove_team_member', {
        p_team_id: 'team',
        p_user_id: 'person',
        p_expected_version: 7,
      }),
    );
  });
});
