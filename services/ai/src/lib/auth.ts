import type { MiddlewareHandler } from "hono";

export type AuthUser = { id: string; email: string; name?: string };
export type TokenVerifier = (token: string) => Promise<AuthUser | null>;

export type AuthVariables = { user: AuthUser };

/**
 * Verifies a PocketBase user token by asking PocketBase to refresh it.
 * Cheap, needs no shared secret, and respects the server's own auth rules.
 */
export function createPocketBaseVerifier(pocketbaseUrl: string): TokenVerifier {
  const url = `${pocketbaseUrl.replace(/\/$/, "")}/api/collections/users/auth-refresh`;
  return async (token) => {
    try {
      const res = await fetch(url, { method: "POST", headers: { Authorization: token } });
      if (!res.ok) return null;
      const data = (await res.json()) as { record?: { id: string; email: string; name?: string } };
      if (!data.record) return null;
      return { id: data.record.id, email: data.record.email, name: data.record.name };
    } catch {
      return null;
    }
  };
}

export function requireAuth(
  verify: TokenVerifier,
): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    const header = c.req.header("Authorization") ?? "";
    const token = header.replace(/^Bearer\s+/i, "").trim();
    if (!token) return c.json({ error: "Missing Authorization header" }, 401);
    const user = await verify(token);
    if (!user) return c.json({ error: "Invalid or expired session" }, 401);
    c.set("user", user);
    await next();
    return undefined;
  };
}
