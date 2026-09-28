import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskMedia } from './task-media';

const mocks = vi.hoisted(() => ({
  sign: vi.fn(async () => ({
    data: { signedUrl: 'https://example.com/private-test' },
    error: null,
  })),
  rpc: vi.fn(async () => ({
    data: {
      attachments: [
        {
          id: 'file-a',
          object_path: 'workspace-a/tasks/task-a/file-a.pdf',
          file_name: 'Plano.pdf',
          mime_type: 'application/pdf',
          file_size: 1000,
          state: 'ready',
          can_remove: false,
          description: '',
          version: 1,
        },
      ],
      capabilities: { can_upload_attachment: false },
    },
    error: null,
  })),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: mocks.rpc,
    storage: { from: () => ({ createSignedUrl: mocks.sign }) },
  }),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mocks.sign.mockClear();
  mocks.rpc.mockClear();
});

describe('media request budget', () => {
  it('loads an image larger than 512 KiB only when its preview approaches the viewport', async () => {
    let reveal: (() => void) | undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(
          callback: (entries: { isIntersecting: boolean }[]) => void,
        ) {
          reveal = () => callback([{ isIntersecting: true }]);
        }
        observe() {}
        disconnect() {}
      },
    );
    mocks.rpc.mockResolvedValueOnce({
      data: {
        attachments: [
          {
            id: 'image-a',
            object_path: 'workspace-a/tasks/task-a/image.png',
            file_name: 'Imagem.png',
            mime_type: 'image/png',
            file_size: 2300000,
            state: 'ready',
            can_remove: false,
            description: '',
            version: 1,
          },
        ],
        capabilities: { can_upload_attachment: false },
      },
      error: null,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <TaskMedia
          taskId="task-a"
          workspaceId="workspace-a"
          creating={false}
          onClose={() => {}}
          onRefresh={async () => {}}
        />
      </QueryClientProvider>,
    );
    await screen.findByRole('button', { name: 'Abrir Imagem.png' });
    expect(mocks.sign).not.toHaveBeenCalled();
    const { act } = await import('@testing-library/react');
    act(() => reveal?.());
    expect(
      await screen.findByAltText('Prévia de Imagem.png'),
    ).toBeInTheDocument();
    expect(mocks.sign).toHaveBeenCalledTimes(1);
    const openWindow = vi.spyOn(window, 'open');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Imagem.png' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(openWindow).not.toHaveBeenCalled();
    const downloadClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Baixar Imagem.png' }).at(-1)!,
    );
    await waitFor(() =>
      expect(mocks.sign).toHaveBeenCalledWith(
        'workspace-a/tasks/task-a/image.png',
        60,
        { download: 'Imagem.png' },
      ),
    );
    await waitFor(() => expect(downloadClick).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    fireEvent.error(screen.getByAltText('Prévia de Imagem.png'));
    expect(
      screen.getByText('Prévia indisponível. Clique para abrir.'),
    ).toBeInTheDocument();
  });
  it('does not sign documents before intent and reuses an unexpired URL', async () => {
    const target = {
      opener: {},
      location: { replace: vi.fn() },
      close: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(target as unknown as Window);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <TaskMedia
          taskId="task-a"
          workspaceId="workspace-a"
          creating={false}
          onClose={() => {}}
          onRefresh={async () => {}}
        />
      </QueryClientProvider>,
    );
    const button = await screen.findByRole('button', {
      name: 'Abrir Plano.pdf',
    });
    expect(mocks.sign).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(() =>
      expect(target.location.replace).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() =>
      expect(target.location.replace).toHaveBeenCalledTimes(2),
    );
    expect(mocks.sign).toHaveBeenCalledTimes(1);
    expect(target.opener).toBeNull();
  });
});
