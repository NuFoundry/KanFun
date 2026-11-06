import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// The production edge in front of the local stack: the built client served through
// deploy/Caddyfile (scripts/edge-serve.sh), PocketBase and the services as in playwright.config.ts.
// Run with `bash scripts/check-edge.sh`, which builds the client first.
const edgePort = Number(process.env.EDGE_PORT || 8380);
const servers = Array.isArray(base.webServer) ? base.webServer : [];

export default defineConfig({
  ...base,
  testDir: "./e2e",
  testIgnore: [],
  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/ },
    {
      name: "edge",
      testMatch: /edge\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://localhost:${edgePort}`,
        permissions: ["microphone"],
        launchOptions: {
          args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        },
      },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    // Everything but the dev servers of the client and the website: Caddy serves their builds.
    ...servers.filter((server) => !/--filter (client|web)\b/.test(String(server.command))),
    {
      command: "bash scripts/edge-serve.sh",
      url: `http://localhost:${edgePort}/`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { EDGE_PORT: String(edgePort) },
    },
  ],
});
