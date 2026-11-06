import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";

// One .env at the repo root is shared by all workspaces; a local one wins if present.
config({
  path: [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "../../.env")],
  quiet: true,
});

const DEFAULT_ADMIN_PASSWORD = "changeme-admin-1234";
/** The example values in .env.example and deploy/.env.prod.example. */
const LOOKS_LIKE_PLACEHOLDER = /replace-with|change-?me|example/i;

/** An empty value in .env means "not set", so the default applies. */
const unsetIfEmpty = (value: unknown) => (value === "" ? undefined : value);

const schema = z
  .object({
    NODE_ENV: z.string().default("development"),
    MCP_HOST: z.string().default("127.0.0.1"),
    MCP_PORT: z.coerce.number().int().positive().default(8791),
    /** The app's public origin: agents log in there, and <APP_URL>/mcp is this server. */
    APP_URL: z.url().default("http://localhost:5173"),
    APP_NAME: z.preprocess(unsetIfEmpty, z.string().default("KanFun")),
    POCKETBASE_URL: z.url().default("http://127.0.0.1:8090"),
    /**
     * The service writes the mcp_* collections and asks for short tokens to act as a user; tools
     * then run with those, under the collections' API rules.
     */
    PB_ADMIN_EMAIL: z.string().default("admin@example.com"),
    PB_ADMIN_PASSWORD: z.string().default(DEFAULT_ADMIN_PASSWORD),
    CORS_ORIGINS: z.string().default("http://localhost:5173"),
    /** Rate limits: on in production, off elsewhere; "off" also for load tests. */
    RATE_LIMITS: z.preprocess(unsetIfEmpty, z.enum(["on", "off"]).optional()),
  })
  // The repository's placeholder must never reach production: the service would log in as a
  // superuser whose password everyone with the template knows.
  .refine(
    (env) =>
      env.NODE_ENV !== "production" ||
      (!LOOKS_LIKE_PLACEHOLDER.test(env.PB_ADMIN_PASSWORD) && env.PB_ADMIN_PASSWORD.length >= 16),
    {
      message:
        "PB_ADMIN_PASSWORD must be set to a long random value in production (openssl rand -hex 24)",
    },
  )
  // Agents send tokens to this address; over plain http anyone on the way could read them.
  .refine((env) => env.NODE_ENV !== "production" || env.APP_URL.startsWith("https://"), {
    message: "APP_URL must be https in production",
  });

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  return schema.parse(source);
}

export function parseOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** Whether rate limits apply: RATE_LIMITS wins, else only in production. */
export function limitsEnabled(env: Env): boolean {
  return (env.RATE_LIMITS ?? (env.NODE_ENV === "production" ? "on" : "off")) === "on";
}
