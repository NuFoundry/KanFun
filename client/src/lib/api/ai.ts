/**
 * Client for the AI service (services/ai). The service holds the provider's API key and verifies
 * the caller's PocketBase token, so the browser never talks to the AI vendor directly.
 */
import { env } from "@/lib/env";
import { pb } from "@/lib/pocketbase";

/** The conversation only: the system prompt is built by the service (services/ai/src/app.ts). */
export type ChatRole = "user" | "assistant";
/** What the model gets of an attached file: the text read from it, or the image. */
export type ChatFile =
  | { type: "text"; name: string; text: string }
  | { type: "image"; name: string; mediaType: string; data: string };
export type ChatMessage = { role: ChatRole; content: string; files?: ChatFile[] };
export type AiHealth = { ok: boolean; transcription: boolean };

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${pb.authStore.token}`,
  };
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // ignore, fall through
  }
  return `AI request failed (${res.status})`;
}

/** Whether voice messages can be transcribed (mic button). */
export async function aiHealth(): Promise<AiHealth> {
  const res = await fetch(`${env.aiUrl}/health`);
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as AiHealth;
}

/** Speech to text for a recorded voice message; `language` (ISO 639-1) improves accuracy. */
export async function transcribe(audio: Blob, language?: string): Promise<string> {
  const form = new FormData();
  const extension = audio.type.includes("mp4")
    ? "m4a"
    : audio.type.includes("ogg")
      ? "ogg"
      : "webm";
  form.append("audio", audio, `voice.${extension}`);
  if (language) form.append("language", language);
  const res = await fetch(`${env.aiUrl}/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${pb.authStore.token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return ((await res.json()) as { text: string }).text;
}

/** Streams assistant text deltas from the SSE endpoint; `language` is the app language. */
export async function* streamChat(
  messages: ChatMessage[],
  {
    signal,
    maxTokens,
    language,
  }: { signal?: AbortSignal; maxTokens?: number; language?: string } = {},
): AsyncGenerator<string> {
  const res = await fetch(`${env.aiUrl}/chat/stream`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ messages, language, ...(maxTokens ? { maxTokens } : {}) }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(await errorMessage(res));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index: number;
    while ((index = buffer.indexOf("\n\n")) !== -1) {
      const event = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      for (const delta of parseSseEvent(event)) yield delta;
    }
  }
}

export function parseSseEvent(event: string): string[] {
  const deltas: string[] = [];
  for (const line of event.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const parsed = JSON.parse(data) as { delta?: string };
      if (parsed.delta) deltas.push(parsed.delta);
    } catch {
      // ignore malformed chunks
    }
  }
  return deltas;
}
