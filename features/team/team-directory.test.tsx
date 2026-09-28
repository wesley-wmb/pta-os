import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { TeamDirectory } from './team-directory';
afterEach(cleanup);
it('opens a team directly and filters without a project selection step', () => {
  render(
    <TeamDirectory
      teams={[
        {
          id: 'team-id',
          name: 'Operação',
          description: 'Produção',
          color: 'blue',
          version: 2,
          member_count: 3,
          project_count: 1,
          task_count: 8,
          workspace_event_id: 'context-id',
        },
      ]}
    />,
  );
  expect(screen.getByRole('link', { name: /Operação/ })).toHaveAttribute(
    'href',
    '/equipes/team-id',
  );
  expect(screen.getByText('8 tarefas')).toBeInTheDocument();
  expect(screen.queryByText(/projeto/i)).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Buscar equipes' }), {
    target: { value: 'Financeiro' },
  });
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.getByText('Nenhuma equipe encontrada.')).toBeInTheDocument();
});
