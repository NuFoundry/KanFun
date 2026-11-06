/**
 * Connected apps: AI agents that use the app on the user's behalf through the MCP server
 * (services/mcp). Connections and activity are read and ended straight in PocketBase (their API
 * rules show users only their own); the consent page and new tokens go through the service.
 */
import type { McpActivityResponse, McpGrantsResponse } from "@/lib/pb-types";
import { env } from "@/lib/env";
import { pb } from "@/lib/pocketbase";

export type Grant = McpGrantsResponse<string[]>;
export type Activity = McpActivityResponse;

/** The permissions the service knows (services/mcp/src/lib/scopes.ts), in its order. */
export const SCOPES = ["posts:read", "posts:write", "posts:delete"] as const;
export type Scope = (typeof SCOPES)[number];

/** The service answered with an error (`status`), with its OAuth `error` code if it sent one. */
export class McpError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`MCP service answered ${status}${code ? ` (${code})` : ""}`);
    this.name = "McpError";
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${env.mcpUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${pb.authStore.token}` },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw Object.assign(new McpError(res.status, data.error), { data });
  return data;
}

/** The OAuth parameters an agent opened /connect with. */
export type AuthorizationRequest = Record<string, string>;

export const AUTHORIZATION_PARAMS = [
  "response_type",
  "client_id",
  "redirect_uri",
  "code_challenge",
  "code_challenge_method",
  "scope",
  "state",
  "resource",
] as const;

export function authorizationRequest(search: string): AuthorizationRequest {
  const query = new URLSearchParams(search);
  return Object.fromEntries(
    AUTHORIZATION_PARAMS.flatMap((name) => (query.has(name) ? [[name, query.get(name)!]] : [])),
  );
}

export type ConsentRequest = {
  client: { name: string; host: string; verified: boolean };
  /** Where the browser goes back to: a host, or an app's scheme (`cursor:`). */
  redirectHost: string;
  scopes: Scope[];
  /** Permissions that start unticked. */
  optIn: Scope[];
};

/**
 * What the consent page shows. A bad client or redirect URI rejects with `McpError` (shown on
 * the page); any other problem comes back as `{ redirect }`, the agent's address with the error.
 */
export async function checkConsent(
  request: AuthorizationRequest,
): Promise<ConsentRequest | { redirect: string }> {
  try {
    return await post<ConsentRequest>("/oauth/check", request);
  } catch (error) {
    const redirect = (error as { data?: { redirect?: string } }).data?.redirect;
    if (redirect) return { redirect };
    throw error;
  }
}

/** The user's answer; returns where to send the browser (the agent's redirect URI). */
export async function decideConsent(
  request: AuthorizationRequest,
  approve: boolean,
  scopes: Scope[],
): Promise<string> {
  const { redirect } = await post<{ redirect: string }>("/oauth/decide", {
    request,
    approve,
    scopes,
  });
  return redirect;
}

/**
 * Leaves the app for the agent's redirect URI (or an app scheme such as cursor://). The service
 * checked the address against what the agent registered; it is never javascript: or data:.
 */
export function returnToAgent(url: string) {
  window.location.assign(url);
}

export async function listGrants(): Promise<Grant[]> {
  return pb.collection("mcp_grants").getFullList<Grant>({ sort: "-created" });
}

export async function revokeGrant(id: string): Promise<void> {
  await pb.collection("mcp_grants").delete(id);
}

/** The latest tool calls of every connection; older ones are deleted after 90 days. */
export async function listActivity(limit = 20): Promise<Activity[]> {
  const page = await pb
    .collection("mcp_activity")
    .getList<Activity>(1, limit, { sort: "-created" });
  return page.items;
}

/** A personal access token: returned once, the service keeps only its hash. */
export async function createToken(input: {
  name: string;
  scopes: Scope[];
  days: 30 | 90 | 365;
}): Promise<{ token: string; expires: string }> {
  return post("/tokens", input);
}
