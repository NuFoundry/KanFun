import type { MiddlewareHandler } from "hono";
import type { AuthVariables } from "./auth";

export type RateLimit = { max: number; windowMs: number };

/**
 * Per-user fixed-window limit (after requireAuth). Answers 429 with Retry-After once a user made
 * `max` requests in the current window. Counts live in this process only: with several machines
 * a user gets `max` per machine, which is fine for stopping runaway scripts.
 */
export function rateLimit(
  { max, windowMs }: RateLimit,
  now: () => number = Date.now,
): MiddlewareHandler<{ Variables: AuthVariables }> {
  const windows = new Map<string, { start: number; count: number }>();
  return async (c, next) => {
    const t = now();
    const key = c.get("user").id;
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
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.start + windowMs - t) / 1000);
      return c.json({ error: "Too many requests" }, 429, { "Retry-After": String(retryAfter) });
    }
    await next();
    return undefined;
  };
}
