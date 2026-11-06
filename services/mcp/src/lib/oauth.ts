import { isLoopbackRedirect, redirectMatches, type Client, type ClientResolver } from "./clients";
import { OPT_IN_SCOPES, parseScopes, SCOPES, type Scope } from "./scopes";
import { hashToken, PREFIX, randomToken, verifyPkce } from "./tokens";
import type { Grant, Store } from "./types";

export const LIFETIME = {
  codeMs: 60_000,
  accessMs: 60 * 60_000,
  refreshMs: 30 * 24 * 60 * 60_000,
};

/** The query string an agent opens the consent page with (OAuth 2.1 authorization request). */
export type AuthorizationRequest = {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  scope?: string;
  state?: string;
  resource?: string;
};

export type OAuthConfig = {
  /** The authorization server: the app's origin. */
  issuer: string;
  /** This MCP server (RFC 8707 resource indicator): `<app>/mcp`. */
  resource: string;
};

/** What the consent page shows, or why it cannot. */
export type CheckResult =
  | {
      ok: true;
      client: Client;
      redirectUri: string;
      scopes: Scope[];
      /** Scopes that start unticked. */
      optIn: Scope[];
    }
  /** A bad client or redirect URI: shown on the page, never redirected (it could be anyone's). */
  | { ok: false; error: string }
  /** Anything else goes back to the agent, as OAuth says (verified or loopback clients only). */
  | { ok: false; error: string; redirect: string };

/** `redirect_uri` with the response parameters, keeping a query it already has. */
export function redirectWith(redirectUri: string, params: Record<string, string | undefined>) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.href;
}

/** Validates an authorization request against the client it names. */
export async function checkAuthorization(
  request: AuthorizationRequest,
  resolveClient: ClientResolver,
  config: OAuthConfig,
): Promise<CheckResult> {
  const client = request.client_id ? await resolveClient(request.client_id) : null;
  if (!client) return { ok: false, error: "unknown_client" };
  const redirectUri = request.redirect_uri ?? "";
  if (!client.redirectUris.some((registered) => redirectMatches(registered, redirectUri))) {
    return { ok: false, error: "invalid_redirect_uri" };
  }

  // Errors go back to the agent without a click only where that cannot be abused as an open
  // redirect: a client known by its domain, or the user's own machine. A self-registered client
  // could name any website; its errors are shown on the page instead.
  const fail = (error: string) =>
    client.verified || isLoopbackRedirect(redirectUri)
      ? {
          ok: false as const,
          error,
          redirect: redirectWith(redirectUri, { error, state: request.state, iss: config.issuer }),
        }
      : { ok: false as const, error };
  if (request.response_type !== "code") return fail("unsupported_response_type");
  if (!request.code_challenge || request.code_challenge_method !== "S256") {
    return fail("invalid_request");
  }
  if (request.resource !== undefined && !sameResource(request.resource, config.resource)) {
    return fail("invalid_target");
  }
  // No scope asked: offer everything; asked only for unknown ones: refuse.
  const scopes = request.scope?.trim() ? parseScopes(request.scope) : [...SCOPES];
  if (scopes.length === 0) return fail("invalid_scope");
  return {
    ok: true,
    client,
    redirectUri,
    scopes,
    optIn: scopes.filter((scope) => OPT_IN_SCOPES.includes(scope)),
  };
}

/** Resource indicators compare without a trailing slash. */
function sameResource(a: string, b: string) {
  return a.replace(/\/$/, "") === b.replace(/\/$/, "");
}

/**
 * The user's answer on the consent page. Approved: a pending grant with a one-time code (60 s)
 * that only the agent holding the PKCE verifier can exchange. Returns where to send the browser.
 */
export async function decideAuthorization(
  input: { request: AuthorizationRequest; approve: boolean; scopes: string[]; user: string },
  deps: { store: Store; resolveClient: ClientResolver; config: OAuthConfig; now?: () => number },
): Promise<{ redirect: string } | { error: string }> {
  const { store, config, now = Date.now } = deps;
  const check = await checkAuthorization(input.request, deps.resolveClient, config);
  if (!check.ok) return "redirect" in check ? { redirect: check.redirect } : { error: check.error };

  const state = input.request.state;
  const granted = check.scopes.filter((scope) => input.scopes.includes(scope));
  if (!input.approve || granted.length === 0) {
    return {
      redirect: redirectWith(check.redirectUri, {
        error: "access_denied",
        state,
        iss: config.issuer,
      }),
    };
  }

  const code = randomToken();
  await store.createGrant({
    user: input.user,
    kind: "oauth",
    clientId: check.client.id,
    clientName: check.client.name,
    clientHost: check.client.host,
    verified: check.client.verified,
    scopes: granted,
    status: "pending",
    codeHash: hashToken(code),
    codeChallenge: input.request.code_challenge!,
    codeExpires: now() + LIFETIME.codeMs,
    redirectUri: check.redirectUri,
    accessHash: "",
    accessExpires: 0,
    refreshHash: "",
    previousRefreshHash: "",
    expires: now() + LIFETIME.codeMs,
    lastUsed: 0,
  });
  if (!check.client.verified) await store.markClientUsed(check.client.id);
  return { redirect: redirectWith(check.redirectUri, { code, state, iss: config.issuer }) };
}

export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

export class TokenError extends Error {
  constructor(
    readonly code: "invalid_request" | "invalid_grant" | "invalid_scope" | "unsupported_grant_type",
    readonly description: string,
  ) {
    super(description);
    this.name = "TokenError";
  }
}

/** Fresh access and refresh tokens for a grant; only their hashes are stored. */
async function issue(store: Store, grant: Grant, scopes: Scope[], now: number, extra = {}) {
  const access = randomToken(PREFIX.access);
  const refresh = randomToken(PREFIX.refresh);
  await store.updateGrant(grant.id, {
    status: "active",
    scopes,
    accessHash: hashToken(access),
    accessExpires: now + LIFETIME.accessMs,
    refreshHash: hashToken(refresh),
    expires: now + LIFETIME.refreshMs,
    ...extra,
  });
  return {
    access_token: access,
    token_type: "Bearer" as const,
    expires_in: LIFETIME.accessMs / 1000,
    refresh_token: refresh,
    scope: scopes.join(" "),
  };
}

/** The token endpoint (authorization_code and refresh_token grants, public clients). */
export async function exchangeToken(
  body: Record<string, string | undefined>,
  deps: { store: Store; config: OAuthConfig; now?: () => number },
): Promise<TokenResponse> {
  const { store, config } = deps;
  const now = (deps.now ?? Date.now)();
  if (!body.client_id) throw new TokenError("invalid_request", "client_id is required");
  if (body.resource !== undefined && !sameResource(body.resource, config.resource)) {
    throw new TokenError("invalid_grant", "Tokens are only issued for this server");
  }

  if (body.grant_type === "authorization_code") {
    const grant = body.code ? await store.findGrant("codeHash", hashToken(body.code)) : null;
    if (!grant) throw new TokenError("invalid_grant", "Unknown or expired code");
    // A code used twice was intercepted: whoever exchanged it first loses the connection too.
    if (grant.status !== "pending") {
      await store.deleteGrant(grant.id);
      throw new TokenError("invalid_grant", "Code already used");
    }
    if (
      grant.codeExpires < now ||
      grant.clientId !== body.client_id ||
      grant.redirectUri !== body.redirect_uri ||
      !verifyPkce(body.code_verifier ?? "", grant.codeChallenge)
    ) {
      throw new TokenError("invalid_grant", "Code, client, redirect URI or verifier do not match");
    }
    return issue(store, grant, grant.scopes, now, { codeExpires: 0 });
  }

  if (body.grant_type === "refresh_token") {
    const hash = hashToken(body.refresh_token ?? "");
    const grant = await store.findGrant("refreshHash", hash);
    if (!grant) {
      // An old refresh token again: someone else has a copy. End the connection.
      const stolen = await store.findGrant("previousRefreshHash", hash);
      if (stolen) await store.deleteGrant(stolen.id);
      throw new TokenError("invalid_grant", "Unknown refresh token");
    }
    if (grant.clientId !== body.client_id || grant.expires < now || grant.kind !== "oauth") {
      throw new TokenError("invalid_grant", "Refresh token does not match");
    }
    let scopes = grant.scopes;
    if (body.scope !== undefined) {
      const asked = body.scope.split(" ").filter(Boolean);
      if (!asked.every((scope) => (grant.scopes as string[]).includes(scope))) {
        throw new TokenError("invalid_scope", "Only scopes the user granted");
      }
      scopes = parseScopes(body.scope);
    }
    return issue(store, grant, scopes, now, { previousRefreshHash: hash });
  }

  throw new TokenError("unsupported_grant_type", "authorization_code or refresh_token");
}

/** RFC 7009: the agent's own access or refresh token ends its connection. Unknown is fine. */
export async function revokeToken(token: string, clientId: string | undefined, store: Store) {
  const hash = hashToken(token);
  const grant =
    (await store.findGrant("accessHash", hash)) ?? (await store.findGrant("refreshHash", hash));
  if (grant && grant.kind === "oauth" && grant.clientId === clientId) {
    await store.deleteGrant(grant.id);
  }
}
