import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Same root .env as everything else; values also reach the test workers.
config({ path: ".env", quiet: true });

const baseURL = process.env.E2E_BASE_URL || `http://localhost:${process.env.CLIENT_PORT || 5173}`;
const pocketbaseUrl = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";
const aiUrl = `http://${process.env.AI_HOST || "127.0.0.1"}:${process.env.AI_PORT || 8787}`;
const webUrl = `http://localhost:${process.env.WEB_PORT || 4321}`;
const mcpUrl = `http://${process.env.MCP_HOST || "127.0.0.1"}:${process.env.MCP_PORT || 8791}`;
const mailUrl = `http://${process.env.MAIL_HOST || "127.0.0.1"}:${process.env.MAIL_PORT || 8788}`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  // e2e/edge runs against the production Caddyfile: scripts/check-edge.sh.
  testIgnore: ["**/edge/**"],
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // Seeds the database once, before the browser projects run.
    { name: "setup", testMatch: /global\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // A fake microphone (a beeping tone) for the assistant's voice messages.
        permissions: ["microphone"],
        launchOptions: {
          args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        },
      },
      dependencies: ["setup"],
    },
  ],
  // Starts the whole stack (or reuses what `pnpm dev` already started locally).
  webServer: [
    {
      command: "pnpm --filter server dev",
      url: `${pocketbaseUrl}/api/health`,
      reuseExistingServer: !isCI,
      timeout: 90_000,
    },
    {
      command: "pnpm --filter ./services/ai dev",
      url: `${aiUrl}/ai/health`,
      reuseExistingServer: !isCI,
      timeout: 90_000,
    },
    {
      command: "pnpm --filter ./services/mcp dev",
      url: `${mcpUrl}/mcp/health`,
      reuseExistingServer: !isCI,
      timeout: 90_000,
    },
    {
      command: "pnpm --filter ./services/mailer dev",
      url: `${mailUrl}/mail/health`,
      reuseExistingServer: !isCI,
      timeout: 90_000,
    },
    {
      command: "pnpm --filter client dev",
      url: baseURL,
      reuseExistingServer: !isCI,
      timeout: 90_000,
    },
    {
      // The website links into the app under test.
      command: "pnpm --filter web dev",
      url: webUrl,
      reuseExistingServer: !isCI,
      timeout: 90_000,
      env: { PUBLIC_APP_URL: baseURL },
    },
  ],
});
