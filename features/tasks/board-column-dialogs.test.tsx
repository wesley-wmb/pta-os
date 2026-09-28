import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  ColumnLifecycleDialog,
  WeekConnectionDialog,
  WeekColumnDeleteDialog,
} from './board-column-dialogs';
import { createTaskBoardConfigurationFallback } from './board-configuration';

const { manage, connect, deleteWeek } = vi.hoisted(() => ({
  manage: vi.fn(),
  deleteWeek: vi.fn(),
  connect: vi.fn(),
}));
vi.mock('./board-configuration', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./board-configuration')>()),
  useDeleteWeekBoardColumn: () => ({
    mutateAsync: deleteWeek,
    isPending: false,
  }),
  useManageTaskBoardColumn: () => ({ mutateAsync: manage, isPending: false }),
  useConnectWeekBoardColumn: () => ({ mutateAsync: connect, isPending: false }),
}));
const configuration = createTaskBoardConfigurationFallback('workspace', [
  {
    id: 'todo',
    name: 'A fazer',
    category: 'todo',
    color: 'stone',
    position: 0,
  },
  {
    id: 'progress',
    name: 'Produção',
    category: 'in_progress',
    color: 'blue',
    position: 10,
  },
]);
configuration.source = 'remote';
configuration.status_board.version = 5;
afterEach(cleanup);
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});
beforeEach(() => {
  vi.clearAllMocks();
  manage.mockResolvedValue(configuration);
  deleteWeek.mockResolvedValue(configuration);
  connect.mockResolvedValue(configuration);
});

describe('ações das colunas', () => {
  it('cria a coluna com o nome informado', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(
      <ColumnLifecycleDialog
        configuration={configuration}
        columnId={null}
        onClose={close}
      />,
    );
    await user.click(screen.getByLabelText('Nome da coluna'));
    await user.paste('Aprovação');
    await user.click(screen.getByRole('button', { name: 'Adicionar coluna' }));
    await waitFor(() =>
      expect(manage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          name: 'Aprovação',
          version: 5,
        }),
      ),
    );
    expect(close).toHaveBeenCalled();
  });
  it('exige destino antes de remover uma coluna e preservar seus cards', async () => {
    const user = userEvent.setup();
    render(
      <ColumnLifecycleDialog
        configuration={configuration}
        columnId="todo"
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Mover cards e excluir coluna' }),
    ).toBeDisabled();
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Produção' }));
    await user.click(
      screen.getByRole('button', { name: 'Mover cards e excluir coluna' }),
    );
    await waitFor(() =>
      expect(manage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          columnId: 'todo',
          destinationId: 'progress',
        }),
      ),
    );
  });
  it('conecta a Semana diretamente e mostra o resultado nos dois sentidos', async () => {
    const user = userEvent.setup();
    render(
      <WeekConnectionDialog
        configuration={configuration}
        lane="ideas"
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Produção' }));
    expect(
      screen.getByText(/Ao mover uma tarefa para “Ideias criativas”/),
    ).toHaveTextContent('no Quadro');
    await user.click(screen.getByRole('button', { name: 'Salvar conexão' }));
    await waitFor(() =>
      expect(connect).toHaveBeenCalledWith({
        lane: 'ideas',
        statusId: 'progress',
        version: 5,
      }),
    );
  });
  it('mantém o editor aberto e explica conflitos', async () => {
    connect.mockRejectedValue(new Error('PTA_VERSION_CONFLICT'));
    const user = userEvent.setup();
    const close = vi.fn();
    render(
      <WeekConnectionDialog
        configuration={configuration}
        lane="ideas"
        onClose={close}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Salvar conexão' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O quadro mudou',
    );
    expect(close).not.toHaveBeenCalled();
  });
});

describe('exclusão de coluna da Semana', () => {
  it('exige destino e envia a versão da Semana, preservando o diálogo até confirmar', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(
      <WeekColumnDeleteDialog
        configuration={configuration}
        lane="emergency"
        onClose={close}
      />,
    );
    const button = screen.getByRole('button', {
      name: 'Mover cards e excluir coluna',
    });
    expect(button).toBeDisabled();
    await user.click(screen.getByRole('combobox'));
    const destination = configuration.week_board.columns.find(
      (column) => column.key === 'backlog',
    )!;
    await user.click(screen.getByRole('option', { name: destination.name }));
    await user.click(button);
    await waitFor(() =>
      expect(deleteWeek).toHaveBeenCalledWith({
        lane: 'emergency',
        destination: 'backlog',
        version: configuration.week_board.version,
      }),
    );
    expect(close).toHaveBeenCalled();
  });
  it('mantém o diálogo aberto após conflito de versão', async () => {
    deleteWeek.mockRejectedValueOnce(new Error('PTA_VERSION_CONFLICT'));
    const user = userEvent.setup();
    const close = vi.fn();
    render(
      <WeekColumnDeleteDialog
        configuration={configuration}
        lane="backlog"
        onClose={close}
      />,
    );
    await user.click(screen.getByRole('combobox'));
    const destination = configuration.week_board.columns.find(
      (column) => column.key === 'important',
    )!;
    await user.click(screen.getByRole('option', { name: destination.name }));
    await user.click(
      screen.getByRole('button', { name: 'Mover cards e excluir coluna' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O quadro mudou',
    );
    expect(close).not.toHaveBeenCalled();
  });
});
