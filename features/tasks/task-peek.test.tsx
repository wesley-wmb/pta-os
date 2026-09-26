import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskPeek } from './task-peek';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  search: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.search,
}));

describe('TaskPeek return context', () => {
  beforeEach(() => {
    mocks.replace.mockReset();
    mocks.search = new URLSearchParams();
  });

  it('closes back to the project timeline that opened the task', async () => {
    const user = userEvent.setup();
    const projectPath =
      '/projetos/0cbbeb33-dfa5-48e2-a71a-28dd154b6264?visao=timeline';
    mocks.search = new URLSearchParams({ retorno: projectPath });

    render(
      <TaskPeek taskId="task-1">
        <p>Conteúdo da tarefa</p>
      </TaskPeek>,
    );

    await user.click(screen.getByRole('button', { name: 'Fechar detalhes' }));

    expect(mocks.replace).toHaveBeenCalledWith(projectPath, { scroll: false });
  });

  it('closes with Escape to the same project timeline URL', async () => {
    const user = userEvent.setup();
    const projectPath =
      '/projetos/0cbbeb33-dfa5-48e2-a71a-28dd154b6264?visao=timeline';
    mocks.search = new URLSearchParams({ retorno: projectPath });

    render(
      <TaskPeek taskId="task-1">
        <p>Conteúdo da tarefa</p>
      </TaskPeek>,
    );

    await user.keyboard('{Escape}');

    expect(mocks.replace).toHaveBeenCalledWith(projectPath, { scroll: false });
  });

  it('falls back to the task board when the return target is unsafe', async () => {
    const user = userEvent.setup();
    mocks.search = new URLSearchParams({ retorno: 'https://example.com' });

    render(
      <TaskPeek taskId="task-1">
        <p>Conteúdo da tarefa</p>
      </TaskPeek>,
    );

    await user.click(screen.getByRole('button', { name: 'Fechar detalhes' }));

    expect(mocks.replace).toHaveBeenCalledWith('/demandas', {
      scroll: false,
    });
  });
});
