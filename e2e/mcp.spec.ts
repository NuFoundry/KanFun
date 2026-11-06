import { createHash, randomBytes } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, mcpAgent, SEED, test } from "./fixtures";

// The MCP server (services/mcp): an AI agent registers, the user approves it on the consent page,
// the agent works with the user's posts through tools, and Settings shows and ends the connection.

/** Where the agent wants the browser back: nothing listens there, the test catches the request. */
const REDIRECT = "http://127.0.0.1:9/callback";

async function register(request: APIRequestContext, name: string) {
  const res = await request.post("/mcp/oauth/register", {
    data: { client_name: name, redirect_uris: [REDIRECT] },
  });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { client_id: string }).client_id;
}

/** The authorization request an agent opens, with a fresh PKCE pair and state. */
function authorization(clientId: string, baseURL: string, scope: string) {
  const verifier = randomBytes(32).toString("base64url");
  const state = randomBytes(8).toString("hex");
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    scope,
    state,
    resource: new URL("/mcp", baseURL).href,
  });
  return { path: `/connect?${query}`, verifier, state };
}

/** Catches the browser's trip back to the agent and returns that URL. */
async function catchRedirect(page: Page) {
  let back: URL | undefined;
  await page.route(`${REDIRECT}**`, async (route) => {
    back = new URL(route.request().url());
    await route.fulfill({ body: "back at the agent" });
  });
  return async () => {
    await expect.poll(() => back?.href).toBeTruthy();
    return back!;
  };
}

/** Consent in the browser, then the agent's token request. Returns the access token. */
async function connect(page: Page, request: APIRequestContext, baseURL: string, name: string) {
  const clientId = await register(request, name);
  const { path, verifier, state } = authorization(clientId, baseURL, "posts:read posts:write");
  const redirected = await catchRedirect(page);
  await page.goto(path);
  await expect(page.getByTestId("connect")).toContainText(`Connect ${name}`);
  await page.getByTestId("connect-allow").click();
  const back = await redirected();
  expect(back.searchParams.get("state")).toBe(state);
  expect(back.searchParams.get("iss")).toBe(new URL(baseURL).origin);

  const res = await request.post("/mcp/oauth/token", {
    form: {
      grant_type: "authorization_code",
      code: back.searchParams.get("code")!,
      client_id: clientId,
      redirect_uri: REDIRECT,
      code_verifier: verifier,
    },
  });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { access_token: string }).access_token;
}

test.describe("mcp", () => {
  test("an agent connects, works with the user's posts, and is cut off in Settings", async ({
    authedPage: page,
    request,
    baseURL,
  }) => {
    const name = `Agent ${Date.now()}`;
    const agent = await mcpAgent(baseURL!, await connect(page, request, baseURL!, name));

    const title = `Written by an agent ${Date.now()}`;
    const created = await agent.call("create_post", { title, content: "Hello from MCP" });
    expect(created.isError).toBe(false);
    const { id } = JSON.parse(created.text) as { id: string };
    expect((await agent.call("publish_post", { id })).isError).toBe(false);
    // Deleting was left unticked: the server asks for the permission instead of deleting.
    await expect(agent.call("delete_post", { id })).rejects.toThrow();

    await page.goto("/dashboard");
    await expect(page.getByTestId("my-posts")).toContainText(title);

    await page.goto("/settings");
    const row = page.getByTestId("grant").filter({ hasText: name });
    await expect(row).toContainText("Unverified");
    await expect(row).toContainText("Create, edit and publish your posts");
    await expect(page.getByTestId("mcp-activity-list")).toContainText("publish_post");
    await row.getByTestId("grant-revoke").click();
    await page.getByTestId("grant-revoke-confirm").click();
    await expect(row).toHaveCount(0);
    await expect(agent.call("whoami")).rejects.toThrow();
  });

  test("a personal access token from Settings is shown once and limited to its permissions", async ({
    authedPage: page,
    baseURL,
  }) => {
    await page.goto("/settings");
    await page.getByTestId("token-create").click();
    const name = `Script ${Date.now()}`;
    const form = page.getByTestId("token-form");
    await form.getByLabel("Name").fill(name);
    await form.getByRole("button", { name: "Create token" }).click();
    const token = await page.getByTestId("token-value").inputValue();
    expect(token).toMatch(/^mcp_pat_/);
    await page.getByTestId("token-done").click();
    await expect(page.getByTestId("grant").filter({ hasText: name })).toContainText("Access token");

    const agent = await mcpAgent(baseURL!, token);
    const me = await agent.call("whoami");
    expect(JSON.parse(me.text)).toMatchObject({
      email: SEED.alice.email,
      permissions: ["posts:read"],
    });
    const posts = JSON.parse((await agent.call("list_posts")).text) as {
      posts: { title: string }[];
    };
    expect(posts.posts.map((p) => p.title)).toContain(SEED.draftPostTitle);
    await expect(agent.call("create_post", { title: "Not allowed" })).rejects.toThrow();
  });

  test("denying sends the agent access_denied", async ({ authedPage: page, request, baseURL }) => {
    const clientId = await register(request, "Denied agent");
    const { path, state } = authorization(clientId, baseURL!, "posts:read");
    const redirected = await catchRedirect(page);
    await page.goto(path);
    await page.getByTestId("connect-deny").click();
    const back = await redirected();
    expect(Object.fromEntries(back.searchParams)).toMatchObject({ error: "access_denied", state });
  });

  test("an unknown app gets an explanation, not a redirect", async ({ authedPage: page }) => {
    await page.goto(
      `/connect?response_type=code&client_id=mcp_client_unknown&redirect_uri=${encodeURIComponent(REDIRECT)}&code_challenge=x&code_challenge_method=S256`,
    );
    await expect(page.getByTestId("connect-error")).toContainText(
      "This connection request is not valid",
    );
  });

  test("signing in on the way keeps the request", async ({ page, request, baseURL }) => {
    const clientId = await register(request, "Patient agent");
    const { path } = authorization(clientId, baseURL!, "posts:read");
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    const form = page.getByTestId("login-form");
    await form.getByLabel("Email").fill(SEED.alice.email);
    await form.getByLabel("Password").fill(SEED.password);
    await form.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByTestId("connect")).toContainText("Connect Patient agent");
  });
});
