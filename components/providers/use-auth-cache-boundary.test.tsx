import { QueryClient } from '@tanstack/react-query';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAuthCacheBoundary } from './use-auth-cache-boundary';

const mocks = vi.hoisted(() => ({
  configured: true,
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock('@/lib/supabase/config', () => ({
  isSupabaseConfigured: () => mocks.configured,
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { onAuthStateChange: mocks.subscribe } }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.configured = true;
});

function setup() {
  let listener!: (event: AuthChangeEvent, session: Session | null) => void;
  mocks.subscribe.mockImplementation((callback) => {
    listener = callback;
    return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
  });
  const client = new QueryClient();
  const view = renderHook(() => useAuthCacheBoundary(client));
  const emit = (event: AuthChangeEvent, id: string | null) =>
    act(() => listener(event, id ? ({ user: { id } } as Session) : null));
  return { client, emit, ...view };
}

describe('auth cache boundary', () => {
  it('preserves hydrated data and warm cache on repeated sign-in and refresh', () => {
    const { client, emit } = setup();
    client.setQueryData(['workspace', 'tasks'], ['private task']);
    emit('INITIAL_SESSION', 'alice');
    emit('SIGNED_IN', 'alice');
    emit('TOKEN_REFRESHED', 'alice');
    expect(client.getQueryData(['workspace', 'tasks'])).toEqual([
      'private task',
    ]);
  });

  it('clears cached data on direct identity replacement even in the same workspace', () => {
    const { client, emit } = setup();
    emit('INITIAL_SESSION', 'alice');
    client.setQueryData(['workspace', 'tasks'], ['private task']);
    emit('SIGNED_IN', 'bob');
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('clears on sign-out before an initial session and unsubscribes on unmount', () => {
    const { client, emit, unmount } = setup();
    client.setQueryData(['workspace', 'tasks'], ['private task']);
    emit('SIGNED_OUT', null);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });

  it('does not initialize Supabase when configuration is absent', () => {
    mocks.configured = false;
    setup();
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });
});
