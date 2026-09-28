import { afterEach, describe, expect, it, vi } from 'vitest';

import { coalesceRefresh, retainRealtime } from './shared-realtime';

afterEach(() => vi.useRealTimers());

describe('shared realtime subscriptions', () => {
  it('keeps one subscription until its last consumer leaves', () => {
    const owner = {};
    const cleanup = vi.fn();
    const subscribe = vi.fn(() => cleanup);
    const first = retainRealtime(owner, 'workspace-a', subscribe);
    const second = retainRealtime(owner, 'workspace-a', subscribe);
    expect(subscribe).toHaveBeenCalledTimes(1);
    first();
    first();
    expect(cleanup).not.toHaveBeenCalled();
    second();
    expect(cleanup).toHaveBeenCalledTimes(1);
    retainRealtime(owner, 'workspace-a', subscribe)();
    expect(subscribe).toHaveBeenCalledTimes(2);
  });

  it('isolates workspaces and query clients', () => {
    const owner = {};
    const subscribe = vi.fn(() => vi.fn());
    const releases = [
      retainRealtime(owner, 'a', subscribe),
      retainRealtime(owner, 'b', subscribe),
      retainRealtime({}, 'a', subscribe),
    ];
    expect(subscribe).toHaveBeenCalledTimes(3);
    releases.forEach((release) => release());
  });
});

describe('realtime refresh bursts', () => {
  it('batches bursts and refetches again after an in-flight event', async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const queue = coalesceRefresh(refresh, vi.fn());
    queue.schedule();
    queue.schedule();
    await vi.advanceTimersByTimeAsync(80);
    expect(refresh).toHaveBeenCalledTimes(1);
    queue.schedule();
    queue.schedule();
    await vi.advanceTimersByTimeAsync(1000);
    expect(refresh).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(80);
    expect(refresh).toHaveBeenCalledTimes(2);
    finish();
    queue.dispose();
  });

  it('marks missed events stale when the final view unmounts', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn(async () => undefined);
    const stale = vi.fn();
    const queue = coalesceRefresh(refresh, stale);
    queue.schedule();
    queue.dispose();
    queue.schedule();
    await vi.advanceTimersByTimeAsync(500);
    expect(refresh).not.toHaveBeenCalled();
    expect(stale).toHaveBeenCalledTimes(1);
  });
});
