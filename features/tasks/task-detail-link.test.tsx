import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TaskDetailLink } from './task-detail-link';

const { fetchDetail } = vi.hoisted(() => ({
  fetchDetail: vi.fn(async () => ({ task: { id: 'task-1' } })),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/demandas',
  useSearchParams: () => new URLSearchParams('visao=kanban'),
}));
vi.mock('next/link', () => ({
  default: ({
    scroll: _scroll,
    ...props
  }: ComponentProps<'a'> & { scroll?: boolean }) => {
    void _scroll;
    return <a {...props} />;
  },
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock('./queries', () => ({
  taskDetailQueryOptions: (workspaceId: string, taskId: string) => ({
    queryKey: ['task', workspaceId, taskId],
    queryFn: fetchDetail,
    staleTime: 30_000,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TaskDetailLink', () => {
  it('warms only on intent and shares the fresh workspace-scoped cache', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <TaskDetailLink workspaceId="workspace-1" taskId="task-1">
          Abrir tarefa
        </TaskDetailLink>
      </QueryClientProvider>,
    );
    const link = screen.getByRole('link', { name: 'Abrir tarefa' });
    expect(fetchDetail).not.toHaveBeenCalled();
    expect(link.getAttribute('href')).toContain('retorno=');
    fireEvent.focus(link);
    await waitFor(() =>
      expect(
        client.getQueryData(['task', 'workspace-1', 'task-1']),
      ).toBeDefined(),
    );
    fireEvent.pointerEnter(link);
    expect(fetchDetail).toHaveBeenCalledTimes(1);
    client.clear();
  });

  it('preserves a cancelled intent handler', () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <TaskDetailLink
          workspaceId="workspace-1"
          taskId="task-1"
          onFocus={(event) => event.preventDefault()}
        >
          Abrir tarefa
        </TaskDetailLink>
      </QueryClientProvider>,
    );
    fireEvent.focus(screen.getByRole('link'));
    expect(fetchDetail).not.toHaveBeenCalled();
    client.clear();
  });
});
