import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";

config({
  path: [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "../../.env")],
  quiet: true,
});

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  APP_NAME: z.string().default("KanFun"),
  APP_URL: z.string().default("http://localhost:5173"),
  MAIL_HOST: z.string().default("127.0.0.1"),
  MAIL_PORT: z.coerce.number().int().positive().default(8788),
  MAIL_FROM: z.string().default("KanFun <no-reply@example.com>"),
  /** Shared secret for POST /mail/send (PocketBase hooks and other services). */
  MAIL_INTERNAL_TOKEN: z.string().min(8).default("dev-internal-token-change-me"),
  MAIL_PROVIDER: z.enum(["auto", "lettermint", "resend", "smtp", "outbox"]).default("auto"),
  /** A Lettermint project API token (Projects → API Tokens); it is the SMTP relay's password. */
  LETTERMINT_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z
    .string()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  /** Where captured mail is written in dev (git-ignored). Empty keeps it in memory only. */
  MAIL_OUTBOX_DIR: z.string().default("outbox"),
});

export type Env = z.infer<typeof schema>;

/** The example values in .env.example and deploy/.env.prod.example. */
const LOOKS_LIKE_PLACEHOLDER = /replace-with|change-?me|example/i;

/**
 * In production the shared secret must be real: a missing, short or placeholder token would let
 * anyone who knows the template send mail as the app (and sign its unsubscribe links).
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const env = schema.parse(source);
  const token = env.MAIL_INTERNAL_TOKEN;
  if (env.NODE_ENV === "production" && (LOOKS_LIKE_PLACEHOLDER.test(token) || token.length < 32)) {
    throw new Error(
      "[mailer] MAIL_INTERNAL_TOKEN must be a random value of 32+ characters in production (openssl rand -hex 32)",
    );
  }
  const provider = resolveProvider(env);
  const missing =
    (provider === "lettermint" && !env.LETTERMINT_TOKEN && "LETTERMINT_TOKEN") ||
    (provider === "resend" && !env.RESEND_API_KEY && "RESEND_API_KEY") ||
    (provider === "smtp" && !env.SMTP_HOST && "SMTP_HOST");
  if (missing) throw new Error(`[mailer] MAIL_PROVIDER=${provider} needs ${missing}`);
  return env;
}

export type ProviderChoice = "lettermint" | "resend" | "smtp" | "outbox";

/** `auto` picks the first configured provider: Lettermint, Resend, SMTP, then the local outbox. */
export function resolveProvider(env: Env): ProviderChoice {
  if (env.MAIL_PROVIDER !== "auto") return env.MAIL_PROVIDER;
  if (env.LETTERMINT_TOKEN) return "lettermint";
  if (env.RESEND_API_KEY) return "resend";
  if (env.SMTP_HOST) return "smtp";
  return "outbox";
}

/**
 * Lettermint (Netherlands, servers in the EU) through its SMTP relay: smtp.lettermint.co on 587
 * with STARTTLS, user "lettermint", the project token as password. Every message turns open and
 * click tracking off, so links such as the password-reset link arrive exactly as written and no
 * pixel reports who read what.
 */
export function lettermintOptions(env: Env) {
  return {
    name: "lettermint",
    host: "smtp.lettermint.co",
    port: 587,
    secure: false,
    user: "lettermint",
    pass: env.LETTERMINT_TOKEN,
    headers: { "X-LM-Override-Track-Opens": "false", "X-LM-Override-Track-Clicks": "false" },
  };
}

export function isDevTools(env: Env): boolean {
  return env.NODE_ENV !== "production";
}
