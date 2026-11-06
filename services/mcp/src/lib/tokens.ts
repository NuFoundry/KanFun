import { createHash, randomBytes } from "node:crypto";

/**
 * Prefixes make a leaked token recognisable (scripts/check-security.sh refuses them in tracked
 * files) and tell the kinds apart in logs, without revealing anything.
 */
export const PREFIX = { access: "mcp_at_", refresh: "mcp_rt_", personal: "mcp_pat_" } as const;

/** 256 random bits, URL-safe. */
export function randomToken(prefix = ""): string {
  return prefix + randomBytes(32).toString("base64url");
}

/**
 * What the database keeps instead of a token or code. The secrets are random, so a plain SHA-256
 * is enough (nothing to brute-force), and lookups by hash need no constant-time compare.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** PKCE (RFC 7636), S256 only: the verifier is 43-128 unreserved characters. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}
