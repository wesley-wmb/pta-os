import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTasks, useTaskDetail } from './queries';

const mocks = vi.hoisted(() => {
  const eq = vi.fn();
  const callbacks: Record<string, () => void> = {};
  const channel = { on: vi.fn(), subscribe: vi.fn() };
  return {
    eq,
    callbacks,
    channel,
    makeChannel: vi.fn(),
    removeChannel: vi.fn(),
  };
});
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    const request = {
      select: vi.fn(),
      eq: mocks.eq,
      order: vi.fn(),
      abortSignal: vi.fn(async () => ({ data: [], error: null })),
    };
    request.select.mockReturnValue(request);
    request.eq.mockReturnValue(request);
    request.order.mockReturnValue(request);
    mocks.channel.on.mockImplementation((_kind, filter, callback) => {
      mocks.callbacks[filter.event === '*' ? filter.table : filter.event] =
        callback;
      return mocks.channel;
    });
    mocks.channel.subscribe.mockReturnValue(mocks.channel);
    mocks.makeChannel.mockReturnValue(mocks.channel);
    return {
      from: () => request,
      channel: mocks.makeChannel,
      removeChannel: mocks.removeChannel,
      rpc: () => ({ abortSignal: () => new Promise(() => {}) }),
    };
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});
function context() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
describe('query efficiency and isolation', () => {
  it('filters project tasks on the server and isolates the cache', async () => {
    const { client, wrapper } = context();
    const { result } = renderHook(() => useTasks('workspace-a', 'project-a'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.eq).toHaveBeenCalledWith('workspace_id', 'workspace-a');
    expect(mocks.eq).toHaveBeenCalledWith('event_id', 'project-a');
    expect(
      client.getQueryData(['tasks', 'workspace-a', 'project', 'project-a']),
    ).toEqual([]);
    expect(client.getQueryData(['tasks', 'workspace-a'])).toBeUndefined();
  });
  it('shares the exact private broadcast topic and batches detail events', async () => {
    vi.useFakeTimers();
    const { client, wrapper } = context();
    const invalidate = vi
      .spyOn(client, 'invalidateQueries')
      .mockResolvedValue();
    const first = renderHook(() => useTaskDetail('workspace-a', 'task-a'), {
      wrapper,
    });
    const second = renderHook(() => useTaskDetail('workspace-a', 'task-a'), {
      wrapper,
    });
    expect(mocks.makeChannel).toHaveBeenCalledTimes(1);
    expect(mocks.makeChannel).toHaveBeenCalledWith('task:task-a', {
      config: { private: true },
    });
    act(() => {
      mocks.callbacks.link_removed();
      mocks.callbacks.link_removed();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(80);
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
    first.unmount();
    expect(mocks.removeChannel).not.toHaveBeenCalled();
    second.unmount();
    expect(mocks.removeChannel).toHaveBeenCalledTimes(1);
  });
});
