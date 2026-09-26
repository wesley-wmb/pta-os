import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { NewTaskDialog } from './new-task-dialog';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  rpc: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ rpc: mocks.rpc }),
}));

vi.mock('./creation-context', () => ({
  useTaskCreationContext: () => ({
    data: { taskTypes: [], products: [], events: [] },
    isError: false,
    isPending: false,
  }),
}));

vi.mock('./rich-text-editor', () => ({
  RichTextEditor: () => <div aria-label="Editor de descrição" />,
}));

const workspaceId = '11111111-1111-4111-8111-111111111111';
const currentUserId = '22222222-2222-4222-8222-222222222222';
const createdTaskId = '33333333-3333-4333-8333-333333333333';
const teammateId = '44444444-4444-4444-8444-444444444444';

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

function renderDialog(
  props: Partial<React.ComponentProps<typeof NewTaskDialog>> = {},
) {
  render(
    <NewTaskDialog
      workspaceId={workspaceId}
      taskPrefix="PTA"
      members={[{ id: currentUserId, fullName: 'Wesley' }]}
      role="owner"
      currentUserId={currentUserId}
      {...props}
    />,
  );
}

async function submitTask(title = 'Revisar página de vendas') {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Nova tarefa' }));
  await user.type(screen.getByLabelText('Título'), title);
  await user.click(screen.getByRole('button', { name: 'Criar tarefa' }));
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('NewTaskDialog', () => {
  it('cria uma demanda básica pelo RPC legado quando a migration global ainda não existe', async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: null,
        error: {
          message:
            'Could not find the function public.create_global_task in the schema cache',
        },
      })
      .mockResolvedValueOnce({
        data: { id: createdTaskId, task_number: 7, version: 1 },
        error: null,
      });

    renderDialog();
    await submitTask();

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(2));
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      1,
      'create_global_task',
      expect.objectContaining({
        p_workspace_id: workspaceId,
        p_title: 'Revisar página de vendas',
      }),
    );
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      2,
      'create_task',
      expect.objectContaining({
        p_workspace_id: workspaceId,
        p_title: 'Revisar página de vendas',
      }),
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith('PTA-000007 criada.');
    expect(mocks.push).toHaveBeenCalledWith(`/tarefa/${createdTaskId}`, {
      scroll: false,
    });
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it('reproduz o aviso de migration ausente quando o contexto não cabe no RPC legado', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        message:
          'Could not find the function public.create_global_task in the schema cache',
      },
    });

    renderDialog({ initialBlocked: true });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Nova tarefa' }));
    await user.type(screen.getByLabelText('Título'), 'Aprovar nova campanha');
    await user.type(
      screen.getByLabelText('Motivo do bloqueio'),
      'Aguardando aprovação do líder',
    );
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        'A atualização de contexto do banco ainda não foi aplicada.',
      );
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('cria a demanda com contexto pelo RPC global quando a migration está disponível', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { id: createdTaskId, task_number: 8, version: 1 },
      error: null,
    });

    renderDialog({ initialBlocked: true });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Nova tarefa' }));
    await user.type(screen.getByLabelText('Título'), 'Aprovar nova campanha');
    await user.type(
      screen.getByLabelText('Motivo do bloqueio'),
      'Aguardando aprovação do líder',
    );
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }));

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledOnce());
    expect(mocks.rpc).toHaveBeenCalledWith(
      'create_global_task',
      expect.objectContaining({
        p_workspace_id: workspaceId,
        p_title: 'Aprovar nova campanha',
        p_blocked_reason: 'Aguardando aprovação do líder',
      }),
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith('PTA-000008 criada.');
    expect(mocks.push).toHaveBeenCalledWith(`/tarefa/${createdTaskId}`, {
      scroll: false,
    });
  });

  it('cria uma tarefa vinculada para outro membro sem abandonar a tarefa pai', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { id: createdTaskId, task_number: 9, version: 1 },
      error: null,
    });
    const onCreated = vi.fn();

    renderDialog({
      role: 'member',
      members: [
        { id: currentUserId, fullName: 'Wesley' },
        { id: teammateId, fullName: 'Bruna' },
      ],
      parentTaskId: '55555555-5555-4555-8555-555555555555',
      navigateAfterCreate: false,
      onCreated,
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Nova tarefa' }));
    await user.type(screen.getByLabelText('Título'), 'Produzir artes do site');
    await user.click(screen.getByLabelText('Responsável'));
    await user.click(await screen.findByRole('option', { name: 'Bruna' }));
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }));

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledOnce());
    expect(mocks.rpc).toHaveBeenCalledWith(
      'create_task_subtask',
      expect.objectContaining({
        p_parent_task_id: '55555555-5555-4555-8555-555555555555',
        p_primary_assignee_id: teammateId,
        p_title: 'Produzir artes do site',
      }),
    );
    expect(onCreated).toHaveBeenCalledOnce();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'Tarefa vinculada criada e atribuída.',
    );
  });
});
