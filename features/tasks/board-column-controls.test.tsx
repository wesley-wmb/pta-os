import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BoardColumnControls,
  type BoardColumnEditableValues,
} from './board-column-controls';

const value: BoardColumnEditableValues = {
  name: 'A fazer',
  color: 'stone',
  icon: 'circle',
  weekLink: 'none',
};

afterEach(cleanup);

describe('BoardColumnControls', () => {
  it('exposes typed movement and automation actions', async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    const onOpenAutomations = vi.fn();

    render(
      <BoardColumnControls
        columnId="todo"
        value={value}
        onUpdate={vi.fn()}
        onOpenAutomations={onOpenAutomations}
        onMove={onMove}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Ações da coluna A fazer' }),
    );
    await user.click(screen.getByText('Automações'));
    expect(screen.getByRole('dialog')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await user.click(
      screen.getByRole('button', { name: 'Ações da coluna A fazer' }),
    );
    await user.click(screen.getByText('Mover para a direita'));
    expect(onMove).toHaveBeenCalledWith('todo', 'right');
  });

  it('edits and saves column metadata', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);

    render(
      <BoardColumnControls
        columnId="todo"
        value={value}
        onUpdate={onUpdate}
        onOpenAutomations={vi.fn()}
        onMove={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Ações da coluna A fazer' }),
    );
    await user.click(screen.getByText('Editar coluna'));
    const name = screen.getByLabelText('Nome');
    await user.clear(name);
    await user.type(name, 'Próximas');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith('todo', {
        ...value,
        name: 'Próximas',
      }),
    );
  });
  it('saves a cover and allows removing it', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <BoardColumnControls
        columnId="todo"
        value={{ ...value, coverUrl: 'https://example.com/cover.jpg' }}
        onUpdate={onUpdate}
        onOpenAutomations={vi.fn()}
        onMove={vi.fn()}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: 'Ações da coluna A fazer' }),
    );
    await user.click(screen.getByText('Editar coluna'));
    const cover = screen.getByLabelText('Imagem de capa');
    await user.clear(cover);
    await user.paste('https://example.com/new.jpg');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith('todo', {
        ...value,
        coverUrl: 'https://example.com/new.jpg',
      }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Ações da coluna A fazer' }),
    );
    await user.click(screen.getByText('Editar coluna'));
    await user.clear(screen.getByLabelText('Imagem de capa'));
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() =>
      expect(onUpdate).toHaveBeenLastCalledWith('todo', {
        ...value,
        coverUrl: null,
      }),
    );
  });
  it('rejects insecure cover URLs', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <BoardColumnControls
        columnId="todo"
        value={value}
        onUpdate={onUpdate}
        onOpenAutomations={vi.fn()}
        onMove={vi.fn()}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: 'Ações da coluna A fazer' }),
    );
    await user.click(screen.getByText('Editar coluna'));
    await user.click(screen.getByLabelText('Imagem de capa'));
    await user.paste('http://example.com/image.jpg');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(screen.getByRole('alert')).toHaveTextContent('HTTPS');
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
