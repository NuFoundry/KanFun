import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";

// One .env at the repo root is shared by all workspaces; a local one wins if present.
config({
  path: [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "../../.env")],
  quiet: true,
});

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  /** Named in the assistant's system prompt. */
  APP_NAME: z.string().default("KanFun"),
  AI_HOST: z.string().default("127.0.0.1"),
  AI_PORT: z.coerce.number().int().positive().default(8787),
  POCKETBASE_URL: z.url().default("http://127.0.0.1:8090"),
  /** auto = first configured key (Mistral, OpenAI, Anthropic), else echo. Ollama is explicit. */
  AI_PROVIDER: z.enum(["auto", "mistral", "openai", "anthropic", "ollama", "echo"]).default("auto"),
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_MODEL: z.string().default("mistral-small-latest"),
  /** Speech to text for voice messages (Mistral and OpenAI have one; the others borrow it). */
  MISTRAL_TRANSCRIPTION_MODEL: z.string().default("voxtral-mini-latest"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-6-luna"),
  OPENAI_TRANSCRIPTION_MODEL: z.string().default("gpt-4o-mini-transcribe"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),
  OLLAMA_URL: z.string().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("llama3.2"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  /** Per-user rate limits: on in production, off elsewhere (load tests, e2e). */
  RATE_LIMITS: z.preprocess((v) => v || undefined, z.enum(["on", "off"]).optional()),
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

export type ProviderChoice = "mistral" | "openai" | "anthropic" | "ollama" | "echo";

/** Whether per-user rate limits apply: `RATE_LIMITS` wins, else only in production. */
export function limitsEnabled(env: Env): boolean {
  return (env.RATE_LIMITS ?? (env.NODE_ENV === "production" ? "on" : "off")) === "on";
}

/**
 * Where voice messages are transcribed: the chat vendor when it has a speech-to-text model
 * (Mistral, OpenAI), else any of those two whose key is set, else nowhere (mic hidden).
 */
export function resolveTranscriber(env: Env): "mistral" | "openai" | "echo" | null {
  const chat = resolveProvider(env);
  if (chat === "mistral" || chat === "openai" || chat === "echo") return chat;
  if (env.MISTRAL_API_KEY) return "mistral";
  if (env.OPENAI_API_KEY) return "openai";
  return null;
}

/**
 * Which provider to run. An explicit choice without its key falls back to echo (with a warning
 * from index.ts) instead of crashing, so a half-configured .env still boots.
 */
export function resolveProvider(env: Env): ProviderChoice {
  const keyFor = {
    mistral: env.MISTRAL_API_KEY,
    openai: env.OPENAI_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
  };
  if (env.AI_PROVIDER === "ollama" || env.AI_PROVIDER === "echo") return env.AI_PROVIDER;
  if (env.AI_PROVIDER !== "auto") return keyFor[env.AI_PROVIDER] ? env.AI_PROVIDER : "echo";
  if (env.MISTRAL_API_KEY) return "mistral";
  if (env.OPENAI_API_KEY) return "openai";
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  return "echo";
}
