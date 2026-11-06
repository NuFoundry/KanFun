import { serve } from "@hono/node-server";
import { createApp, RATE_LIMITS } from "./app";
import { limitsEnabled, loadEnv, parseOrigins } from "./env";
import { createPocketBaseVerifier } from "./lib/auth";
import { createClientResolver } from "./lib/clients";
import { createPocketBase } from "./lib/store";

const NO_LIMITS = Object.fromEntries(
  Object.keys(RATE_LIMITS).map((k) => [k, { max: Infinity, windowMs: 1 }]),
) as typeof RATE_LIMITS;

const env = loadEnv();

const { store, asUser } = createPocketBase({
  url: env.POCKETBASE_URL,
  adminEmail: env.PB_ADMIN_EMAIL,
  adminPassword: env.PB_ADMIN_PASSWORD,
});

const app = createApp({
  store,
  asUser,
  resolveClient: createClientResolver(store),
  verifyUser: createPocketBaseVerifier(env.POCKETBASE_URL),
  appUrl: env.APP_URL,
  appName: env.APP_NAME,
  corsOrigins: parseOrigins(env.CORS_ORIGINS),
  log: env.NODE_ENV !== "test",
  limits: limitsEnabled(env) ? undefined : NO_LIMITS,
});

serve({ fetch: app.fetch, hostname: env.MCP_HOST, port: env.MCP_PORT }, (info) => {
  console.info(`[mcp] listening on http://${info.address}:${info.port}/mcp for ${env.APP_URL}`);
});
