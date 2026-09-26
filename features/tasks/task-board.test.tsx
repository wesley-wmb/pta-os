import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Link from 'next/link';
import { afterEach, describe, expect, it } from 'vitest';

import { TaskBoardColumn } from './task-board';

afterEach(cleanup);

describe('board column disclosure', () => {
  it('collapses by keyboard and restores content and focus without losing a draft', async () => {
    const user = userEvent.setup();
    render(
      <TaskBoardColumn
        ref={null}
        id="todo"
        title="A fazer"
        count={1}
        isOver={false}
      >
        <input aria-label="Rascunho da tarefa" defaultValue="Entrega" />
      </TaskBoardColumn>,
    );
    const draft = screen.getByRole('textbox', { name: 'Rascunho da tarefa' });
    await user.type(draft, ' revisada');
    const toggle = screen.getByRole('button', {
      name: 'Recolher coluna A fazer',
    });
    toggle.focus();
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveFocus();
    expect(screen.getByRole('textbox')).toHaveValue('Entrega revisada');
  });

  it('only collapses the selected column and keeps counts available', async () => {
    const user = userEvent.setup();
    render(
      <>
        <TaskBoardColumn
          ref={null}
          id="todo"
          title="A fazer"
          count={2}
          isOver={false}
        >
          <Link href="/tarefa/1">Preparar entrega</Link>
        </TaskBoardColumn>
        <TaskBoardColumn
          ref={null}
          id="done"
          title="Concluído"
          count={1}
          isOver={false}
        >
          <Link href="/tarefa/2">Entrega concluída</Link>
        </TaskBoardColumn>
      </>,
    );
    await user.click(
      screen.getByRole('button', { name: 'Recolher coluna A fazer' }),
    );
    expect(
      screen.getByRole('link', { name: 'Entrega concluída' }),
    ).toBeVisible();
    expect(screen.getByLabelText('2 tarefas')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Expandir coluna A fazer' }),
    ).toHaveAttribute('aria-controls', 'todo-content');
  });
});
