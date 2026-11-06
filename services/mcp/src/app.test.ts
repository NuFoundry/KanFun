import { createHash } from "node:crypto";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createApp, type RATE_LIMITS } from "./app";
import { createClientResolver } from "./lib/clients";
import { createMemoryStore } from "./lib/store-memory";
import type { Records } from "./lib/types";

const APP = "http://localhost:5173";
const VERIFIER = "v".repeat(43);
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");
const REDIRECT = "http://127.0.0.1/callback";
const SESSIONS: Record<string, { id: string; email: string }> = {
  "session-alice": { id: "alice", email: "alice@example.com" },
  "session-bob": { id: "bob", email: "bob@example.com" },
};
const ALICE = { Authorization: "Bearer session-alice", "Content-Type": "application/json" };

type Post = { id: string; title: string; content: string; published: boolean; author: string };

/** Posts with the collection's API rules: drafts are the author's, changes too. */
function createPosts() {
  const posts = new Map<string, Post>([
    ["bobsdraft000001", post("bobsdraft000001", "Bob's draft", false, "bob")],
    ["bobspublished01", post("bobspublished01", "Bob's post", true, "bob")],
  ]);
  let next = 1;
  const missing = () => Object.assign(new Error("Not found"), { status: 404 });
  return {
    posts,
    forUser(user: string): Records {
      const visible = (p?: Post) => p && (p.published || p.author === user);
      return {
        async list() {
          const items = [...posts.values()].filter(visible);
          return { items, page: 1, totalPages: 1, totalItems: items.length };
        },
        async get(collection, id) {
          if (collection === "users") return { id, name: user, email: `${user}@example.com` };
          const found = posts.get(id);
          if (!visible(found)) throw missing();
          return { ...found };
        },
        async create(_collection, data) {
          if (data.author !== user) throw Object.assign(new Error("Bad"), { status: 400 });
          const id = `newpost${String(next++).padStart(8, "0")}`;
          const created = { ...(data as Omit<Post, "id">), id };
          posts.set(id, created);
          return { ...created };
        },
        async update(_collection, id, data) {
          const found = posts.get(id);
          if (!found || found.author !== user) throw missing();
          Object.assign(found, data);
          return { ...found };
        },
        async delete(_collection, id) {
          const found = posts.get(id);
          if (!found || found.author !== user) throw missing();
          posts.delete(id);
        },
        filter: (expression, params) => `${expression} ${JSON.stringify(params)}`,
      };
    },
  };
}

function post(id: string, title: string, published: boolean, author: string): Post {
  return { id, title, content: `${title} text`, published, author };
}

function setup({
  documents = {},
  ...options
}: {
  limits?: Partial<typeof RATE_LIMITS>;
  now?: () => number;
  /** Client metadata documents by URL; everything else is offline. */
  documents?: Record<string, unknown>;
} = {}) {
  const store = createMemoryStore();
  const records = createPosts();
  const app = createApp({
    store,
    resolveClient: createClientResolver(store, {
      fetchJson: async (url) => {
        if (url in documents) return documents[url];
        throw new Error("offline");
      },
    }),
    asUser: async (user) => records.forUser(user),
    verifyUser: async (token) => SESSIONS[token] ?? null,
    appUrl: APP,
    appName: "KanFun",
    corsOrigins: [APP],
    ...options,
  });

  const json = (path: string, body: unknown, headers: Record<string, string> = ALICE) =>
    app.request(path, { method: "POST", headers, body: JSON.stringify(body) });

  async function register(redirectUris = [REDIRECT]) {
    const res = await json(
      "/mcp/oauth/register",
      { client_name: "Agent", redirect_uris: redirectUris },
      { "Content-Type": "application/json" },
    );
    expect(res.status).toBe(201);
    return ((await res.json()) as { client_id: string }).client_id;
  }

  const request = (clientId: string, extra: Record<string, string> = {}) => ({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    scope: "posts:read posts:write posts:delete",
    state: "st4te",
    resource: `${APP}/mcp`,
    ...extra,
  });

  /** The user ticks `scopes` on the consent page and allows; returns the code. */
  async function authorize(clientId: string, scopes = ["posts:read", "posts:write"]) {
    const res = await json("/mcp/oauth/decide", {
      request: request(clientId),
      approve: true,
      scopes,
    });
    const { redirect } = (await res.json()) as { redirect: string };
    return new URL(redirect).searchParams.get("code")!;
  }

  const token = (fields: Record<string, string>) =>
    app.request("/mcp/oauth/token", { method: "POST", body: new URLSearchParams(fields) });

  async function exchange(clientId: string, code: string) {
    const res = await token({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      redirect_uri: REDIRECT,
      code_verifier: VERIFIER,
      resource: `${APP}/mcp`,
    });
    expect(res.status).toBe(200);
    return (await res.json()) as { access_token: string; refresh_token: string; scope: string };
  }

  async function connect(clientId: string, scopes?: string[]) {
    return (await exchange(clientId, await authorize(clientId, scopes))).access_token;
  }

  /** An MCP client (the official SDK) talking to the app; `statuses` records HTTP answers. */
  async function agent(accessToken: string) {
    const statuses: number[] = [];
    const client = new Client({ name: "test-agent", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${APP}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
        fetch: async (url, init) => {
          const res = await app.request(String(url), init);
          statuses.push(res.status);
          return res;
        },
      }),
    );
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const result = (await client.callTool({ name, arguments: args })) as {
        isError?: boolean;
        content: { text: string }[];
      };
      const text = result.content[0]?.text ?? "";
      return {
        isError: Boolean(result.isError),
        text,
        data: result.isError ? null : JSON.parse(text),
      };
    };
    return { client, call, statuses };
  }

  return {
    app,
    store,
    records,
    json,
    register,
    request,
    authorize,
    token,
    exchange,
    connect,
    agent,
  };
}

describe("discovery", () => {
  it("publishes the protected resource and the authorization server", async () => {
    const { app } = setup();
    const resource = await app.request("/.well-known/oauth-protected-resource/mcp");
    expect(await resource.json()).toMatchObject({
      resource: `${APP}/mcp`,
      authorization_servers: [APP],
      scopes_supported: ["posts:read", "posts:write", "posts:delete"],
    });
    const server = await app.request("/.well-known/oauth-authorization-server");
    expect(server.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await server.json()).toMatchObject({
      issuer: APP,
      authorization_endpoint: `${APP}/connect`,
      token_endpoint: `${APP}/mcp/oauth/token`,
      registration_endpoint: `${APP}/mcp/oauth/register`,
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
    });
  });

  it("sends agents without a valid token to the metadata", async () => {
    const { app } = setup();
    for (const headers of [{}, { Authorization: "Bearer session-alice" }]) {
      const res = await app.request("/mcp", { method: "POST", headers, body: "{}" });
      expect(res.status).toBe(401);
      expect(res.headers.get("WWW-Authenticate")).toContain(
        `resource_metadata="${APP}/.well-known/oauth-protected-resource/mcp"`,
      );
    }
  });
});

describe("registration", () => {
  it("accepts public clients with safe redirect URIs only", async () => {
    const { json, register } = setup();
    expect(await register(["http://localhost/cb", "cursor://x/cb"])).toMatch(/^mcp_client_/);
    const anonymous = { "Content-Type": "application/json" };
    for (const body of [
      { redirect_uris: ["http://agent.dev/cb"] },
      { redirect_uris: ["javascript:alert(1)"] },
      { redirect_uris: [] },
      { redirect_uris: [REDIRECT], token_endpoint_auth_method: "client_secret_post" },
    ]) {
      expect((await json("/mcp/oauth/register", body, anonymous)).status).toBe(400);
    }
  });

  it("is limited per address", async () => {
    const { json } = setup({ limits: { register: { max: 1, windowMs: 60_000 } } });
    const body = { redirect_uris: [REDIRECT] };
    const from = (ip: string) => ({ "Content-Type": "application/json", "X-Real-IP": ip });
    expect((await json("/mcp/oauth/register", body, from("1.2.3.4"))).status).toBe(201);
    expect((await json("/mcp/oauth/register", body, from("1.2.3.4"))).status).toBe(429);
    expect((await json("/mcp/oauth/register", body, from("5.6.7.8"))).status).toBe(201);
  });
});

describe("consent", () => {
  it("shows the client, where it sends the browser back to, and what starts unticked", async () => {
    const { json, register, request } = setup();
    const clientId = await register();
    const res = await json("/mcp/oauth/check", request(clientId));
    expect(await res.json()).toEqual({
      ok: true,
      client: { name: "Agent", host: "127.0.0.1", verified: false },
      redirectHost: "127.0.0.1",
      scopes: ["posts:read", "posts:write", "posts:delete"],
      optIn: ["posts:delete"],
    });
  });

  it("names a client with a metadata document by its domain", async () => {
    const url = "https://agent.dev/oauth/client.json";
    const { json, request } = setup({
      documents: { [url]: { client_id: url, client_name: "Agent", redirect_uris: [REDIRECT] } },
    });
    const res = await json("/mcp/oauth/check", request(url, { scope: "posts:read" }));
    expect(await res.json()).toMatchObject({
      client: { name: "Agent", host: "agent.dev", verified: true },
      scopes: ["posts:read"],
      optIn: [],
    });
  });

  it("needs the user's session", async () => {
    const { json, register, request } = setup();
    const res = await json("/mcp/oauth/check", request(await register()), {});
    expect(res.status).toBe(401);
  });

  it("never redirects to an unknown client or redirect URI", async () => {
    const { json, register, request } = setup();
    const clientId = await register();
    for (const [bad, error] of [
      [request("mcp_client_unknown"), "unknown_client"],
      [request(clientId, { redirect_uri: "http://127.0.0.1/elsewhere" }), "invalid_redirect_uri"],
    ] as const) {
      const res = await json("/mcp/oauth/check", bad);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false, error });
    }
  });

  it("sends other errors back to the agent with its state and the issuer", async () => {
    const { json, register, request } = setup();
    const clientId = await register();
    for (const [extra, error] of [
      [{ code_challenge_method: "plain" }, "invalid_request"],
      [{ response_type: "token" }, "unsupported_response_type"],
      [{ resource: "https://other.example/mcp" }, "invalid_target"],
      [{ scope: "admin" }, "invalid_scope"],
    ] as const) {
      const res = await json("/mcp/oauth/check", request(clientId, extra));
      const body = (await res.json()) as { error: string; redirect: string };
      expect(body.error).toBe(error);
      const back = new URL(body.redirect);
      expect(`${back.origin}${back.pathname}`).toBe(REDIRECT);
      expect(Object.fromEntries(back.searchParams)).toEqual({ error, state: "st4te", iss: APP });
    }
  });

  it("shows a self-registered client's errors instead of sending the browser to its site", async () => {
    const { json, register, request } = setup();
    const site = "https://agent.example/callback";
    const clientId = await register([site]);
    const res = await json(
      "/mcp/oauth/check",
      request(clientId, { redirect_uri: site, response_type: "token" }),
    );
    expect(await res.json()).toEqual({ ok: false, error: "unsupported_response_type" });
  });

  it("denying, or unticking everything, answers access_denied", async () => {
    const { json, register, request, store } = setup();
    const clientId = await register();
    for (const answer of [
      { approve: false, scopes: ["posts:read"] },
      { approve: true, scopes: [] },
    ]) {
      const res = await json("/mcp/oauth/decide", { request: request(clientId), ...answer });
      const { redirect } = (await res.json()) as { redirect: string };
      expect(new URL(redirect).searchParams.get("error")).toBe("access_denied");
    }
    expect(store.grants.size).toBe(0);
  });
});

describe("a connection", () => {
  it("consent, code, tokens, tools, refresh and theft detection", async () => {
    const { register, authorize, exchange, agent, token, store, records } = setup();
    const clientId = await register();
    const code = await authorize(clientId);
    expect(store.clients.get(clientId)?.used).toBe(true);
    const tokens = await exchange(clientId, code);
    expect(tokens).toMatchObject({
      token_type: "Bearer",
      expires_in: 3600,
      scope: "posts:read posts:write",
    });
    expect(tokens.access_token).toMatch(/^mcp_at_/);
    expect(tokens.refresh_token).toMatch(/^mcp_rt_/);
    // Only hashes are stored.
    expect(JSON.stringify([...store.grants.values()])).not.toContain(tokens.access_token);

    const { client, call, statuses } = await agent(tokens.access_token);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual([
      "whoami",
      "list_posts",
      "get_post",
      "create_post",
      "update_post",
      "publish_post",
      "delete_post",
    ]);
    expect(tools.find((t) => t.name === "delete_post")?.annotations).toMatchObject({
      destructiveHint: true,
    });

    expect((await call("whoami")).data).toMatchObject({
      id: "alice",
      permissions: ["posts:read", "posts:write"],
    });
    const created = await call("create_post", { title: "From an agent", content: "Hi" });
    expect(created.data).toMatchObject({
      title: "From an agent",
      published: false,
      author: "alice",
    });
    const published = await call("publish_post", { id: created.data.id });
    expect(published.data.published).toBe(true);
    expect(records.posts.get(created.data.id)?.published).toBe(true);

    // No posts:delete: the server asks for it (403 insufficient_scope) instead of running the tool.
    await expect(call("delete_post", { id: created.data.id })).rejects.toThrow();
    expect(statuses).toContain(403);
    expect(records.posts.has(created.data.id)).toBe(true);

    expect(store.activity.map((a) => [a.tool, a.outcome])).toEqual([
      ["whoami", "ok"],
      ["create_post", "ok"],
      ["publish_post", "ok"],
    ]);
    expect(store.activity[0]).toMatchObject({ user: "alice", clientName: "Agent" });

    // Refresh: new tokens, the old access token stops working.
    const refresh = (refreshToken: string) =>
      token({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId });
    const res = await refresh(tokens.refresh_token);
    const fresh = (await res.json()) as { access_token: string; refresh_token: string };
    expect(fresh.refresh_token).not.toBe(tokens.refresh_token);
    await expect(agent(tokens.access_token)).rejects.toThrow();
    await (await agent(fresh.access_token)).call("whoami");

    // The old refresh token again: someone has a copy, the connection ends for both.
    expect((await refresh(tokens.refresh_token)).status).toBe(400);
    expect(store.grants.size).toBe(0);
    await expect(agent(fresh.access_token)).rejects.toThrow();
  });

  it("a code works once, within a minute, with its verifier, client and redirect", async () => {
    let now = 1_000_000;
    const { register, authorize, token, exchange, store } = setup({ now: () => now });
    const clientId = await register();
    const base = { grant_type: "authorization_code", client_id: clientId, redirect_uri: REDIRECT };

    const code = await authorize(clientId);
    for (const wrong of [
      { code_verifier: "w".repeat(43) },
      { code_verifier: VERIFIER, client_id: "mcp_client_other" },
      { code_verifier: VERIFIER, redirect_uri: "http://127.0.0.1:9/callback" },
      { code_verifier: VERIFIER, resource: "https://other.example/mcp" },
    ] as Record<string, string>[]) {
      const res = await token({ ...base, code, ...wrong });
      expect([res.status, ((await res.json()) as { error: string }).error]).toEqual([
        400,
        "invalid_grant",
      ]);
    }
    await exchange(clientId, code);
    // Used twice: intercepted, so the connection made with it ends too.
    expect((await token({ ...base, code, code_verifier: VERIFIER })).status).toBe(400);
    expect(store.grants.size).toBe(0);

    const late = await authorize(clientId);
    now += 61_000;
    expect((await token({ ...base, code: late, code_verifier: VERIFIER })).status).toBe(400);
  });

  it("revoking a token ends the connection", async () => {
    const { app, register, connect, agent } = setup();
    const clientId = await register();
    const access = await connect(clientId);
    await app.request("/mcp/oauth/revoke", {
      method: "POST",
      body: new URLSearchParams({ token: access, client_id: clientId }),
    });
    await expect(agent(access)).rejects.toThrow();
  });

  it("tools act as the user: other people's drafts and posts stay theirs", async () => {
    const { register, connect, agent, records } = setup();
    const { call } = await agent(await connect(await register(), ["posts:read", "posts:write"]));
    expect(await call("get_post", { id: "bobsdraft000001" })).toMatchObject({
      isError: true,
      text: "No post with this id that you can see",
    });
    expect((await call("get_post", { id: "bobspublished01" })).data.title).toBe("Bob's post");
    expect(await call("update_post", { id: "bobspublished01", title: "Mine now" })).toMatchObject({
      isError: true,
      text: "You may not change this post",
    });
    expect(records.posts.get("bobspublished01")?.title).toBe("Bob's post");
  });

  it("limits calls per minute and changes per day, per connection", async () => {
    const { register, connect, agent } = setup({
      limits: { writes: { max: 1, windowMs: 60_000 } },
    });
    const { call } = await agent(await connect(await register()));
    expect((await call("create_post", { title: "One" })).isError).toBe(false);
    expect(await call("create_post", { title: "Two" })).toMatchObject({
      isError: true,
      text: "The daily limit of changes for this connection is reached.",
    });

    const slow = setup({ limits: { calls: { max: 0, windowMs: 60_000 } } });
    const access = await slow.connect(await slow.register());
    const res = await slow.app.request("/mcp", {
      method: "POST",
      headers: { Authorization: `Bearer ${access}` },
      body: "{}",
    });
    expect(res.status).toBe(429);
  });
});

describe("personal access tokens", () => {
  it("are shown once, scoped, and capped per user", async () => {
    const { json, agent, store } = setup();
    const res = await json("/mcp/tokens", { name: "Script", scopes: ["posts:read"], days: 30 });
    expect(res.status).toBe(201);
    const { token } = (await res.json()) as { token: string };
    expect(token).toMatch(/^mcp_pat_/);
    expect(JSON.stringify([...store.grants.values()])).not.toContain(token);

    const { call, statuses } = await agent(token);
    expect((await call("whoami")).data.permissions).toEqual(["posts:read"]);
    await expect(call("create_post", { title: "Nope" })).rejects.toThrow();
    expect(statuses).toContain(403);

    for (const bad of [
      { name: "", scopes: ["posts:read"], days: 30 },
      { name: "x", scopes: [], days: 30 },
      { name: "x", scopes: ["admin"], days: 30 },
      { name: "x", scopes: ["posts:read"], days: 10_000 },
    ]) {
      expect((await json("/mcp/tokens", bad)).status).toBe(400);
    }
    expect(
      (await json("/mcp/tokens", { name: "x", scopes: ["posts:read"], days: 30 }, {})).status,
    ).toBe(401);
  });

  it("stop at 20 per user and expire", async () => {
    let now = 1_000_000;
    const { json, agent } = setup({
      now: () => now,
      limits: { personal: { max: Infinity, windowMs: 1 } },
    });
    const make = () => json("/mcp/tokens", { name: "t", scopes: ["posts:read"], days: 30 });
    const first = ((await (await make()).json()) as { token: string }).token;
    for (let i = 1; i < 20; i++) expect((await make()).status).toBe(201);
    expect((await make()).status).toBe(409);
    now += 31 * 24 * 60 * 60_000;
    await expect(agent(first)).rejects.toThrow();
  });
});
