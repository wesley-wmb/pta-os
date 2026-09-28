type Subscription = {
  users: number;
  release: () => void;
};

const subscriptions = new WeakMap<object, Map<string, Subscription>>();

/** Share transport work between consumers of the same cache and workspace. */
export function retainRealtime(
  owner: object,
  key: string,
  subscribe: () => () => void,
) {
  let entries = subscriptions.get(owner);
  if (!entries) {
    entries = new Map();
    subscriptions.set(owner, entries);
  }
  let entry = entries.get(key);
  if (!entry) {
    entry = { users: 0, release: subscribe() };
    entries.set(key, entry);
  }
  entry.users += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    entry.users -= 1;
    if (entry.users === 0) {
      entries.delete(key);
      entry.release();
    }
  };
}

/** Batch bursts, preserving a trailing refresh when events arrive in flight. */
export function coalesceRefresh(
  refresh: () => Promise<unknown>,
  markStale: () => void,
  delay = 80,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let dirty = false;
  let disposed = false;

  async function flush() {
    timer = undefined;
    if (disposed || running || !dirty) return;
    dirty = false;
    running = true;
    try {
      await refresh();
    } finally {
      running = false;
      if (dirty && !disposed) schedule();
    }
  }

  function schedule() {
    if (disposed) return;
    dirty = true;
    if (!running && timer === undefined)
      timer = setTimeout(() => void flush().catch(markStale), delay);
  }

  return {
    schedule,
    dispose() {
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      if (dirty) markStale();
    },
  };
}
