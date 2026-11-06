import { z } from "zod";
import { fetchPublicJson } from "./safe-fetch";
import type { RegisteredClient, Store } from "./types";

/**
 * Who an agent is. Two ways, both from the MCP authorization spec:
 *  - Client ID Metadata Document: the client id is an https URL where the agent's maker publishes
 *    its name and redirect URIs. Only the owner of that domain can publish there, so the consent
 *    page can name the domain (`verified`).
 *  - Dynamic Client Registration (deprecated, still used by some agents): the agent registers
 *    itself at /mcp/oauth/register and gets a random id. Its name is self-chosen (`verified:
 *    false`, the consent page warns).
 */
export type Client = {
  id: string;
  name: string;
  /** The domain shown on the consent page. */
  host: string;
  verified: boolean;
  redirectUris: string[];
};

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
/** Schemes that run code or read files when the browser follows them. */
const BLOCKED_SCHEMES = new Set([
  "javascript:",
  "data:",
  "vbscript:",
  "file:",
  "blob:",
  "about:",
  "filesystem:",
  "ws:",
  "wss:",
  "ftp:",
  "mailto:",
  "tel:",
]);

/**
 * A redirect URI the consent page may send the browser to: https, http on the user's own machine
 * (command-line agents), or an app's own scheme (cursor://, vscode://), never a fragment.
 */
export function isAllowedRedirect(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash || uri.includes("#") || url.username || url.password) return false;
  if (url.protocol === "https:") return url.hostname !== "";
  if (url.protocol === "http:") return LOOPBACK.has(url.hostname);
  return /^[a-z][a-z0-9+.-]*:$/.test(url.protocol) && !BLOCKED_SCHEMES.has(url.protocol);
}

/** A redirect to the user's own machine (a command-line agent), never to someone's website. */
export function isLoopbackRedirect(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.protocol === "http:" && LOOPBACK.has(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Exact match, except that a loopback redirect may use any port (RFC 8252 7.3): a command-line
 * agent picks a free port each time it logs in.
 */
export function redirectMatches(registered: string, requested: string): boolean {
  if (registered === requested) return true;
  try {
    const a = new URL(registered);
    const b = new URL(requested);
    return (
      a.protocol === "http:" &&
      b.protocol === "http:" &&
      LOOPBACK.has(a.hostname) &&
      a.hostname === b.hostname &&
      a.pathname === b.pathname &&
      a.search === b.search
    );
  } catch {
    return false;
  }
}

const redirectUris = z.array(z.string().max(500).refine(isAllowedRedirect)).min(1).max(10);
/** Public clients only: an agent cannot keep a secret on a user's machine. */
const publicClient = z.enum(["none"]).optional();

const metadataDocument = z.object({
  client_id: z.string(),
  client_name: z.string().trim().min(1).max(100).optional(),
  redirect_uris: redirectUris,
  token_endpoint_auth_method: publicClient,
});

export const registrationRequest = z.object({
  client_name: z.string().trim().min(1).max(100).optional(),
  redirect_uris: redirectUris,
  token_endpoint_auth_method: publicClient,
  grant_types: z.array(z.enum(["authorization_code", "refresh_token"])).optional(),
  response_types: z.array(z.literal("code")).optional(),
});

/** A client id that is a metadata document's URL: https, a path, nothing that could be rewritten. */
export function isMetadataDocumentUrl(clientId: string): boolean {
  if (!clientId.startsWith("https://")) return false;
  try {
    const url = new URL(clientId);
    return (
      url.href === clientId &&
      url.pathname !== "/" &&
      !url.hash &&
      !url.username &&
      !url.password &&
      !url.pathname.split("/").some((part) => part === "." || part === "..")
    );
  } catch {
    return false;
  }
}

export type ClientResolver = (clientId: string) => Promise<Client | null>;

/**
 * Looks a client up: metadata documents are fetched (cached for `ttlMs`), registrations come from
 * the store. Null for anything unknown or invalid.
 */
export function createClientResolver(
  store: Pick<Store, "findClient">,
  {
    fetchJson = fetchPublicJson,
    ttlMs = 10 * 60_000,
    now = Date.now,
  }: { fetchJson?: (url: string) => Promise<unknown>; ttlMs?: number; now?: () => number } = {},
): ClientResolver {
  const cache = new Map<string, { client: Client; expires: number }>();
  return async (clientId) => {
    if (isMetadataDocumentUrl(clientId)) {
      const hit = cache.get(clientId);
      if (hit && hit.expires > now()) return hit.client;
      const document = metadataDocument.safeParse(await fetchJson(clientId).catch(() => null));
      // The document must name itself, or anyone could publish a copy of another app's.
      if (!document.success || document.data.client_id !== clientId) return null;
      const host = new URL(clientId).host;
      const client: Client = {
        id: clientId,
        name: document.data.client_name ?? host,
        host,
        verified: true,
        redirectUris: document.data.redirect_uris,
      };
      cache.set(clientId, { client, expires: now() + ttlMs });
      if (cache.size > 500) cache.delete(cache.keys().next().value!);
      return client;
    }
    if (clientId.length > 100) return null;
    const registered = await store.findClient(clientId);
    return registered ? fromRegistration(registered) : null;
  };
}

function fromRegistration(client: RegisteredClient): Client {
  const first = new URL(client.redirectUris[0]!);
  return {
    id: client.clientId,
    name: client.name,
    host:
      first.protocol === "http:" || first.protocol === "https:" ? first.hostname : first.protocol,
    verified: false,
    redirectUris: client.redirectUris,
  };
}
