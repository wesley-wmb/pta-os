import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Link from 'next/link';
import { TaskCardActions } from './task-card-actions';
import type { TaskOverview } from './types';
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/demandas',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));
const task = {
  id: 'task',
  workspace_id: 'workspace',
  title: 'Campanha',
  event_id: 'project',
  version: 2,
} as TaskOverview;
afterEach(cleanup);
describe('menu contextual dos cards', () => {
  it('abre diretamente com botão direito sem botão de ações permanente', () => {
    render(
      <TaskCardActions task={task}>
        <article data-testid="card">
          <Link href="/tarefa/task">Campanha</Link>
        </article>
      </TaskCardActions>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByTestId('card'), {
      clientX: 100,
      clientY: 120,
    });
    expect(
      screen.getByRole('menuitem', { name: 'Editar tarefa' }),
    ).toBeVisible();
    expect(
      screen.getByRole('menuitem', { name: 'Excluir card' }),
    ).toBeVisible();
    expect(
      screen.getByRole('menuitem', { name: 'Abrir equipe vinculada' }),
    ).toHaveAttribute('href', '/projetos/project?visao=board');
  });
  it('abre com Shift+F10 no link do card', () => {
    render(
      <TaskCardActions task={task}>
        <article>
          <Link href="/tarefa/task">Campanha</Link>
        </article>
      </TaskCardActions>,
    );
    fireEvent.keyDown(screen.getByRole('link'), { key: 'F10', shiftKey: true });
    expect(screen.getByRole('menu')).toBeVisible();
  });
  it('não oferece ações quando a edição está bloqueada', () => {
    render(
      <TaskCardActions task={task} disabled>
        <article data-testid="card">Campanha</article>
      </TaskCardActions>,
    );
    fireEvent.contextMenu(screen.getByTestId('card'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
