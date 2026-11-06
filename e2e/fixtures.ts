import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createHmac } from "node:crypto";
import { expect, test as base, type APIRequestContext, type Page } from "@playwright/test";

/** Mirrors server/seed/data.ts. Keep in sync when you change the seeds. */
export const SEED = {
  password: process.env.SEED_USER_PASSWORD || "password1234",
  alice: { email: "alice@example.com", name: "Alice Example" },
  bob: { email: "bob@example.com", name: "Bob Builder" },
  publishedPostTitle: "Welcome to KanFun",
  publishedPostSlug: "welcome-to-kan-fun",
  draftPostTitle: "A draft only Alice can see",
  /** Alice's saved conversation (server/seed/data.ts). */
  conversationTitle: "What can you help me with?",
} as const;

export async function login(page: Page, email: string, password = SEED.password) {
  await page.goto("/login");
  const form = page.getByTestId("login-form");
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByTestId("user-menu")).toBeVisible();
}

/** `test` with an `authedPage` fixture already signed in as Alice. */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await login(page, SEED.alice.email);
    await use(page);
  },
});

export { expect };

export type OutboxMail = {
  id: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  /** "pocketbase" for auth mails, a template name, or "api". */
  source: string;
};

/** Polls the mailer's dev outbox (proxied at /mail) until a matching email arrives. */
export async function waitForMail(
  request: APIRequestContext,
  filter: { to: string; subject?: string },
  timeoutMs = 15_000,
): Promise<OutboxMail> {
  const params = new URLSearchParams({ to: filter.to });
  if (filter.subject) params.set("subject", filter.subject);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await request.get(`/mail/outbox?${params}`);
    if (res.ok()) {
      const mails = (await res.json()) as OutboxMail[];
      if (mails[0]) return mails[0];
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(
    `No email for ${filter.to}${filter.subject ? ` matching "${filter.subject}"` : ""}`,
  );
}

/** Extracts the PocketBase token from an auth email (verification / password reset). */
export function tokenFromMail(
  mail: OutboxMail,
  action: "confirm-verification" | "confirm-password-reset",
) {
  const match = new RegExp(`${action}/([A-Za-z0-9._-]+)`).exec(`${mail.html ?? ""}\n${mail.text}`);
  if (!match?.[1]) throw new Error(`No ${action} token in email "${mail.subject}"`);
  return match[1];
}

/** Delays every response matching `pattern` so loading skeletons become observable. */
export async function delayApi(page: Page, pattern: string, ms = 1500) {
  await page.route(pattern, async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

/** Makes every request matching `pattern` fail with a 500 until `page.unroute(pattern)`. */
export async function failApi(page: Page, pattern: string) {
  await page.route(pattern, (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' }),
  );
}

/** The code an authenticator app shows for a two-factor secret, `offset` 30-second steps on. */
export function totpCode(secret: string, offset = 0) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/\s/g, "")) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  }
  const key = Buffer.from(bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + offset));
  const digest = createHmac("sha1", key).update(counter).digest();
  const value = digest.readUInt32BE(digest[19]! & 0xf) & 0x7fffffff;
  return String(value % 1_000_000).padStart(6, "0");
}

/**
 * An AI agent with an MCP access token: the official MCP client against <baseURL>/mcp. `call`
 * returns a tool's text and whether it failed; the client throws when the server refuses the
 * request itself (401 without a valid token, 403 for a missing permission).
 */
export async function mcpAgent(baseURL: string, token: string) {
  const client = new Client({ name: "e2e-agent", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL("/mcp", baseURL), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    }),
  );
  return {
    client,
    async call(name: string, args: Record<string, unknown> = {}) {
      const result = (await client.callTool({ name, arguments: args })) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };
      return { isError: Boolean(result.isError), text: result.content[0]?.text ?? "" };
    },
  };
}
