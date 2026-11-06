import { serve } from "@hono/node-server";
import { createApp, RATE_LIMITS } from "./app";
import { limitsEnabled, loadEnv, parseOrigins, resolveProvider, resolveTranscriber } from "./env";
import { createPocketBaseVerifier } from "./lib/auth";
import { createAnthropicProvider } from "./lib/anthropic";
import { createMistralProvider, createMistralTranscriber } from "./lib/mistral";
import { createOpenAiProvider, createOpenAiTranscriber } from "./lib/openai";
import { createEchoProvider, type ChatProvider, type Transcriber } from "./lib/provider";

const NO_LIMITS = Object.fromEntries(
  Object.keys(RATE_LIMITS).map((k) => [k, { max: Infinity, windowMs: 1 }]),
) as typeof RATE_LIMITS;

const env = loadEnv();

let provider: ChatProvider;
switch (resolveProvider(env)) {
  case "mistral":
    provider = createMistralProvider({
      apiKey: env.MISTRAL_API_KEY!,
      model: env.MISTRAL_MODEL,
      transcriptionModel: env.MISTRAL_TRANSCRIPTION_MODEL,
    });
    break;
  case "openai":
    provider = createOpenAiProvider({
      apiKey: env.OPENAI_API_KEY!,
      model: env.OPENAI_MODEL,
      transcriptionModel: env.OPENAI_TRANSCRIPTION_MODEL,
    });
    break;
  case "anthropic":
    provider = createAnthropicProvider({
      apiKey: env.ANTHROPIC_API_KEY!,
      model: env.ANTHROPIC_MODEL,
    });
    break;
  case "ollama":
    provider = createOpenAiProvider({
      apiKey: "ollama",
      model: env.OLLAMA_MODEL,
      baseURL: `${env.OLLAMA_URL.replace(/\/$/, "")}/v1`,
    });
    break;
  default:
    provider = createEchoProvider();
    console.warn(
      `[ai] No API key for AI_PROVIDER=${env.AI_PROVIDER} (MISTRAL_API_KEY, OPENAI_API_KEY or ANTHROPIC_API_KEY): using the echo provider (no real AI calls).`,
    );
}

// Voice messages need a speech-to-text model; Anthropic and Ollama borrow one from Mistral or
// OpenAI when that key is set too, otherwise the client hides the microphone.
let transcribe: Transcriber | undefined = provider.transcribe;
switch (resolveTranscriber(env)) {
  case "mistral":
    transcribe ??= createMistralTranscriber({
      apiKey: env.MISTRAL_API_KEY!,
      model: env.MISTRAL_TRANSCRIPTION_MODEL,
    });
    break;
  case "openai":
    transcribe ??= createOpenAiTranscriber({
      apiKey: env.OPENAI_API_KEY!,
      model: env.OPENAI_TRANSCRIPTION_MODEL,
    });
    break;
  case null:
    console.warn(
      `[ai] ${provider.model} has no speech to text and no MISTRAL_API_KEY or OPENAI_API_KEY is set: voice messages are off.`,
    );
}

const app = createApp({
  provider,
  transcribe,
  verifyToken: createPocketBaseVerifier(env.POCKETBASE_URL),
  corsOrigins: parseOrigins(env.CORS_ORIGINS),
  appName: env.APP_NAME,
  log: env.NODE_ENV !== "test",
  limits: limitsEnabled(env) ? undefined : NO_LIMITS,
});

const server = serve({ fetch: app.fetch, hostname: env.AI_HOST, port: env.AI_PORT }, (info) => {
  console.info(
    `[ai] listening on http://${info.address}:${info.port}/ai (model: ${provider.model}, voice: ${transcribe ? "on" : "off"})`,
  );
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
    process.exit(0);
  });
}
