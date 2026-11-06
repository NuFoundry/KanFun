import type { Page } from "@playwright/test";
import { expect, login, SEED, test } from "../fixtures";

// The production edge (deploy/Caddyfile) in front of the built client: what the internet sees.
// Run with `bash scripts/check-edge.sh`; playwright.edge.config.ts starts Caddy and the stack.

/** Collects every Content-Security-Policy violation the page reports. */
async function watchCsp(page: Page) {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to/.test(message.text())) violations.push(message.text());
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      console.error(`Refused to ${event.violatedDirective}: ${event.blockedURI}`);
    });
  });
  return violations;
}

test.describe("edge", () => {
  test("every page response carries the security headers", async ({ request }) => {
    const res = await request.get("/");
    const headers = res.headers();
    expect(headers["strict-transport-security"]).toContain("max-age=31536000");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    const csp = headers["content-security-policy"] ?? "";
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-eval");
    expect(headers.server).toBeUndefined();
  });

  test("the admin UI, the superuser API and the mailer are not reachable", async ({ request }) => {
    for (const path of [
      "/_/",
      "/_",
      "/api/collections/_superusers/auth-methods",
      "/api/collections/_SUPERUSERS/auth-methods",
      "/api/collections/%5fsuperusers/auth-methods",
      "/api/collections/pbc_3142635823/auth-methods",
      "/mail/health",
      "/mail/outbox",
    ]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
    const login = await request.post("/api/collections/_superusers/auth-with-password", {
      data: { identity: "admin@example.com", password: "x" },
    });
    expect(login.status()).toBe(404);
    // The users API is still served.
    expect((await request.get("/api/health")).status()).toBe(200);
  });

  test("a missing chunk is a 404, and no source map is referenced", async ({ request }) => {
    const missing = await request.get("/assets/does-not-exist-1234.js");
    expect(missing.status()).toBe(404);
    expect(missing.headers()["content-type"] ?? "").not.toContain("text/html");
    const html = await (await request.get("/")).text();
    const script = /src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
    expect(script).toBeTruthy();
    const bundle = await request.get(script!);
    expect(bundle.headers()["cache-control"]).toContain("immutable");
    expect(await bundle.text()).not.toContain("sourceMappingURL");
    // No inline script in the page: the CSP allows this origin's files only.
    expect(html).not.toMatch(/<script>(?!<\/script>)/);
  });

  test("the MCP server and its discovery documents are reachable", async ({ request }) => {
    const metadata = await request.get("/.well-known/oauth-protected-resource/mcp");
    expect(metadata.headers()["content-type"]).toContain("application/json");
    expect(await metadata.json()).toHaveProperty("authorization_servers");
    const server = await request.get("/.well-known/oauth-authorization-server");
    expect(await server.json()).toHaveProperty("token_endpoint");
    const mcp = await request.post("/mcp", { data: {} });
    expect(mcp.status()).toBe(401);
    expect(mcp.headers()["www-authenticate"]).toContain("resource_metadata=");
    // The consent page is the app's own page.
    expect((await request.get("/connect")).headers()["content-type"]).toContain("text/html");
  });

  test("oversized bodies are refused at the edge", async ({ request }) => {
    const chat = await request.post("/ai/chat/stream", { data: "x".repeat(13 * 1024 * 1024) });
    expect(chat.status()).toBe(413);
    const mcp = await request.post("/mcp", { data: "x".repeat(2 * 1024 * 1024) });
    expect(mcp.status()).toBe(413);
  });

  test("the app installs: manifest, icons, iOS home-screen tags and a service worker", async ({
    page,
    request,
  }) => {
    const html = await (await request.get("/")).text();
    expect(html).toContain("viewport-fit=cover");
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('rel="apple-touch-icon"');
    // "default" keeps the clock and the Dynamic Island above the app (index.html).
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style" content="default"');

    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.headers()["content-type"]).toContain("application/manifest+json");
    expect(manifest.headers()["cache-control"]).toBe("no-cache");
    const data = (await manifest.json()) as { display: string; icons: { src: string }[] };
    expect(data.display).toBe("standalone");
    for (const icon of [...data.icons.map((i) => i.src), "/apple-touch-icon.png", "/favicon.svg"]) {
      const res = await request.get(icon);
      expect(res.status(), icon).toBe(200);
      expect(res.headers()["content-type"], icon).toMatch(/^image\//);
    }
    // A deploy reaches installed apps: the worker is revalidated on every load.
    expect((await request.get("/sw.js")).headers()["cache-control"]).toBe("no-cache");
    await page.goto("/");
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(new URL(scope).pathname).toBe("/");
    // With the worker in charge, server paths still reach the server, never the cached shell.
    await page.reload();
    const health = await page.evaluate(async () => (await fetch("/api/health")).status);
    expect(health).toBe(200);
    expect((await page.goto("/_/"))?.status()).toBe(404);
  });

  test("no page breaks the Content-Security-Policy", async ({ page }) => {
    const violations = await watchCsp(page);
    // The theme script is a file now, so it still runs before the first paint.
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByTestId("post-list")).toBeVisible();
    await page.goto(`/posts/${SEED.publishedPostSlug}`);
    await expect(page.getByTestId("post-title")).toBeVisible();
    await page.goto("/auth/confirm-password-reset/not-a-token");
    await expect(page.getByTestId("new-password-form")).toBeVisible();

    await login(page, SEED.alice.email);
    for (const path of ["/dashboard", "/settings"]) {
      await page.goto(path);
      await expect(page.getByTestId("user-menu")).toBeVisible();
    }
    // Without the browser's speech recognition the mic records through getUserMedia, which the
    // Permissions-Policy has to allow.
    await page.addInitScript(() => {
      Object.defineProperty(window, "SpeechRecognition", { value: undefined });
      Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined });
    });
    await page.goto("/assistant");
    // A formula loads KaTeX, its styles and fonts: all from this origin.
    await page.getByTestId("chat-input").fill("hello through the edge \\( x^2 \\)");
    await page.getByTestId("chat-send").click();
    await expect(page.getByTestId("chat-message-assistant")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("chat-message-assistant").locator(".katex")).toBeVisible();
    // Permissions-Policy allows the microphone for this origin.
    await page.getByTestId("voice-start").click();
    await expect(page.getByTestId("voice-recorder")).toBeVisible();
    await page.getByTestId("voice-cancel").click();
    // pdf.js reads an attached PDF in a worker from this origin.
    const maker = await page.context().newPage();
    await maker.setContent("<p>Through the edge</p>");
    const pdf = await maker.pdf();
    await maker.close();
    await page
      .getByTestId("attach-input")
      .setInputFiles({ name: "edge.pdf", mimeType: "application/pdf", buffer: pdf });
    const chip = page.getByTestId("composer-files").getByTestId("file-chip");
    await expect(chip).toHaveCount(1);
    await expect(chip).not.toHaveAttribute("aria-busy");
    expect(violations).toEqual([]);
  });

  test("the website: the same headers, a stricter CSP and its own 404 page", async ({
    page,
    request,
  }) => {
    const site = `http://localhost:${process.env.WEB_EDGE_PORT || Number(process.env.EDGE_PORT || 8380) + 1}`;
    const res = await request.get(`${site}/`);
    expect(res.status()).toBe(200);
    const headers = res.headers();
    expect(headers["strict-transport-security"]).toContain("max-age=31536000");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"]).toContain("style-src 'self';");
    expect(headers.server).toBeUndefined();
    expect((await request.get(`${site}/privacy`)).status()).toBe(200);
    const missing = await request.get(`${site}/no-such-page`);
    expect(missing.status()).toBe(404);
    expect(await missing.text()).toContain('data-testid="web-not-found"');

    const violations = await watchCsp(page);
    await page.goto(`${site}/`);
    await expect(page.getByTestId("web-headline")).toBeVisible();
    await page.goto(`${site}/privacy`);
    await expect(page.getByTestId("web-privacy-page")).toBeVisible();
    expect(violations).toEqual([]);
  });
});
