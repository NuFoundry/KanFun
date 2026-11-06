import type { APIRequestContext } from "@playwright/test";
import { delayApi, expect, failApi, SEED, test } from "./fixtures";

// Every data view has four states. This spec slows or breaks the API to see the three that are
// invisible on a fast local stack. Add a row per new view (AGENTS.md "Loading, empty and error
// states").
const POSTS = "**/api/collections/posts/records**";

const views: {
  name: string;
  /** The page, or how to find it (a seeded record's id). */
  path: string | ((request: APIRequestContext) => Promise<string>);
  api: string;
  loading: string;
  content: string;
  authed?: boolean;
  /** Creates the data the content state needs (views without seed data). */
  prepare?: (request: APIRequestContext) => Promise<void>;
}[] = [
  { name: "home", path: "/", api: POSTS, loading: "posts-loading", content: "post-list" },
  {
    name: "post detail",
    path: `/posts/${SEED.publishedPostSlug}`,
    api: POSTS,
    loading: "post-loading",
    content: "post-title",
  },
  {
    name: "dashboard",
    path: "/dashboard",
    api: POSTS,
    loading: "my-posts-loading",
    content: "my-posts",
    authed: true,
  },
  {
    name: "dev inbox",
    path: "/dev/mail",
    api: "**/mail/outbox**",
    loading: "inbox-loading",
    content: "inbox-list",
    prepare: (request) => signUp(request, `inbox-${Date.now()}@example.com`),
  },
  {
    name: "two-factor settings",
    path: "/settings",
    api: "**/api/two-factor",
    loading: "two-factor-loading",
    content: "two-factor-off",
    authed: true,
  },
  {
    name: "assistant history",
    path: "/assistant",
    api: "**/api/collections/conversations/records**",
    loading: "conversations-loading",
    content: "conversation-link",
    authed: true,
  },
  {
    name: "conversation",
    path: (request) => seededConversationPath(request),
    api: "**/api/collections/conversations/records/*",
    loading: "conversation-loading",
    content: "chat-message-user",
    authed: true,
  },
  {
    name: "connected apps",
    path: "/settings",
    api: "**/api/collections/mcp_grants/records**",
    loading: "connected-apps-loading",
    content: "grant",
    authed: true,
    prepare: (request) => aliceToken(request),
  },
  {
    name: "consent page",
    path: (request) => consentPath(request),
    api: "**/mcp/oauth/check",
    loading: "connect-loading",
    content: "connect",
    authed: true,
  },
];

test.describe("loading states", () => {
  for (const view of views) {
    test(`${view.name} shows a skeleton, then the content`, async ({ page, browser, request }) => {
      if (view.prepare) await view.prepare(request);
      const path = typeof view.path === "string" ? view.path : await view.path(request);
      const target = view.authed ? await loggedIn(browser) : page;
      await delayApi(target, view.api);
      await target.goto(path);
      const skeleton = target.getByTestId(view.loading);
      await expect(skeleton).toBeVisible();
      await expect(skeleton).toHaveAttribute("aria-busy", "true");
      // `.first()`: a list view may hold more rows than the seed (specs run in parallel).
      await expect(target.getByTestId(view.content).first()).toBeVisible();
      await expect(skeleton).toHaveCount(0);
    });
  }

  test("home shows an error state and recovers on retry", async ({ page }) => {
    await failApi(page, POSTS);
    await page.goto("/");
    await expect(page.getByTestId("posts-error")).toBeVisible();
    await page.unroute(POSTS);
    await page.getByTestId("posts-error-retry").click();
    await expect(page.getByTestId("post-list")).toBeVisible();
  });

  test("a missing post shows an empty state with a way back", async ({ page }) => {
    await page.goto("/posts/does-not-exist");
    await expect(page.getByTestId("post-empty")).toBeVisible();
    await page.getByRole("link", { name: /back home/i }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("a new user sees the dashboard empty state", async ({ page, request }) => {
    const email = `empty-${Date.now()}@example.com`;
    await signUp(request, email, "Nia");
    await page.goto("/login");
    const form = page.getByTestId("login-form");
    await form.getByLabel("Email").fill(email);
    await form.getByLabel("Password").fill("password1234");
    await form.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByTestId("my-posts-empty")).toBeVisible();
  });
});

/** A fresh page signed in as Alice (the authedPage fixture cannot be combined with a route). */
async function loggedIn(browser: Parameters<Parameters<typeof test>[2]>[0]["browser"]) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  const form = page.getByTestId("login-form");
  await form.getByLabel("Email").fill(SEED.alice.email);
  await form.getByLabel("Password").fill(SEED.password);
  await form.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByTestId("user-menu")).toBeVisible();
  return page;
}

async function signUp(request: APIRequestContext, email: string, name = "Nia") {
  const res = await request.post("/api/collections/users/records", {
    data: { email, password: "password1234", passwordConfirm: "password1234", name },
  });
  expect(res.ok()).toBeTruthy();
}

/** Alice's seeded conversation, looked up through the API with her own session. */
async function seededConversationPath(request: APIRequestContext): Promise<string> {
  const auth = await request.post("/api/collections/users/auth-with-password", {
    data: { identity: SEED.alice.email, password: SEED.password },
  });
  const { token } = (await auth.json()) as { token: string };
  const list = await request.get(
    `/api/collections/conversations/records?filter=${encodeURIComponent(`title="${SEED.conversationTitle}"`)}`,
    { headers: { Authorization: token } },
  );
  const { items } = (await list.json()) as { items: { id: string }[] };
  if (!items[0]) throw new Error("Seed first: Alice's conversation is missing");
  return `/assistant/${items[0].id}`;
}

/** A personal access token for Alice, so her connected apps list has a row. */
async function aliceToken(request: APIRequestContext) {
  const auth = await request.post("/api/collections/users/auth-with-password", {
    data: { identity: SEED.alice.email, password: SEED.password },
  });
  const { token } = (await auth.json()) as { token: string };
  const res = await request.post("/mcp/tokens", {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: `loading-${Date.now()}`, scopes: ["posts:read"], days: 30 },
  });
  expect(res.status()).toBe(201);
}

/** An agent's authorization request, as it opens the consent page. */
async function consentPath(request: APIRequestContext): Promise<string> {
  const res = await request.post("/mcp/oauth/register", {
    data: { client_name: "Loading agent", redirect_uris: ["http://127.0.0.1:9/callback"] },
  });
  const { client_id } = (await res.json()) as { client_id: string };
  const query = new URLSearchParams({
    response_type: "code",
    client_id,
    redirect_uri: "http://127.0.0.1:9/callback",
    code_challenge: "x".repeat(43),
    code_challenge_method: "S256",
    scope: "posts:read",
  });
  return `/connect?${query}`;
}
