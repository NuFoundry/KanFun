export type RateLimit = { max: number; windowMs: number };

/**
 * Fixed-window counter per key (a user, a connection, an address). `hit` counts one request and
 * says whether it is still within `max` for the current window, or how many seconds until it is.
 * Counts live in this process only: with several machines a key gets `max` per machine, which is
 * fine for stopping runaway agents and scripts.
 */
export function createLimiter({ max, windowMs }: RateLimit, now: () => number = Date.now) {
  const windows = new Map<string, { start: number; count: number }>();
  return function hit(key: string): { ok: true } | { ok: false; retryAfter: number } {
    const t = now();
    let entry = windows.get(key);
    if (!entry || t - entry.start >= windowMs) {
      // Drop finished windows now and then so the map stays small.
      if (windows.size > 10_000) {
        for (const [k, w] of windows) if (t - w.start >= windowMs) windows.delete(k);
      }
      entry = { start: t, count: 0 };
      windows.set(key, entry);
    }
    entry.count += 1;
    if (entry.count <= max) return { ok: true };
    return { ok: false, retryAfter: Math.ceil((entry.start + windowMs - t) / 1000) };
  };
}
