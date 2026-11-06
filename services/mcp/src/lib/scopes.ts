/**
 * The permissions an agent can be given. Every tool names one (src/tools); the consent page and
 * Settings show them with the labels in the client's `mcp.scopes` strings. Keep the list short:
 * one read, one write and, for anything that loses data, a separate scope that starts unticked.
 */
export const SCOPES = ["posts:read", "posts:write", "posts:delete"] as const;
export type Scope = (typeof SCOPES)[number];

/** Unticked on the consent page until the user ticks them. */
export const OPT_IN_SCOPES: readonly Scope[] = ["posts:delete"];

export function isScope(value: string): value is Scope {
  return (SCOPES as readonly string[]).includes(value);
}

/** The known scopes in an OAuth `scope` string (space-separated), in their canonical order. */
export function parseScopes(value: string | undefined | null): Scope[] {
  const asked = new Set((value ?? "").split(" ").filter(Boolean));
  return SCOPES.filter((scope) => asked.has(scope));
}
