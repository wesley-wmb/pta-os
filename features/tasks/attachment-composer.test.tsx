import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LinksSection } from './task-collaboration';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock('./task-media', () => ({
  TaskMedia: ({
    creating,
    initialDescription,
  }: {
    creating: boolean;
    initialDescription: string;
  }) =>
    creating ? <div data-testid="media-draft">{initialDescription}</div> : null,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderComposer() {
  render(
    <LinksSection
      workspaceId="workspace"
      taskId="task"
      links={[]}
      canAdd
      onRefresh={async () => {}}
    />,
  );
}

describe('integrated attachment composer', () => {
  it('preserves the comment between attachment choices and submits it with the link', async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    renderComposer();
    const comment = screen.getByRole('textbox', {
      name: 'Comentário sobre o link ou arquivo',
    });
    fireEvent.change(comment, { target: { value: 'Contexto da referência' } });
    fireEvent.click(screen.getByRole('button', { name: 'Inserir link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(comment).toHaveValue('Contexto da referência');
    fireEvent.click(screen.getByRole('button', { name: 'Inserir link' }));
    fireEvent.change(screen.getByLabelText('Endereço HTTPS'), {
      target: { value: 'https://example.com/briefing' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar link' }));
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith(
        'save_task_link_with_description',
        expect.objectContaining({
          p_task_id: 'task',
          p_description: 'Contexto da referência',
          p_url: 'https://example.com/briefing',
        }),
      ),
    );
    await waitFor(() => expect(comment).toHaveValue(''));
  });

  it('keeps the draft on error and passes the same comment to media upload', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'offline' } });
    renderComposer();
    const comment = screen.getByRole('textbox', {
      name: 'Comentário sobre o link ou arquivo',
    });
    fireEvent.change(comment, { target: { value: 'Contexto preservado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Inserir link' }));
    fireEvent.change(screen.getByLabelText('Endereço HTTPS'), {
      target: { value: 'https://example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar link' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Anexar mídia' }),
      ).toBeEnabled(),
    );
    expect(comment).toHaveValue('Contexto preservado');
    fireEvent.click(screen.getByRole('button', { name: 'Anexar mídia' }));
    expect(screen.getByTestId('media-draft')).toHaveTextContent(
      'Contexto preservado',
    );
    expect(screen.queryByLabelText('Endereço HTTPS')).not.toBeInTheDocument();
  });
});
