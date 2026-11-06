/** Provider-agnostic chat interface so the app can be tested without network access. */

export type ChatRole = "system" | "user" | "assistant";
/** The image types every vendor reads. */
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];
/** A file the user attached: its text (read in the browser from a PDF or text file) or an image. */
export type ChatFile =
  | { type: "text"; name: string; text: string }
  | { type: "image"; name: string; mediaType: ImageType; data: string };
export type ImageFile = Extract<ChatFile, { type: "image" }>;
/** `files` only on user messages. */
export type ChatMessage = { role: ChatRole; content: string; files?: ChatFile[] };
export type ChatOptions = { temperature?: number; maxTokens?: number };
/** A recorded voice message (the browser's MediaRecorder output: webm/opus, mp4/aac, ogg). */
export type AudioInput = { data: Uint8Array; fileName: string; language?: string };
/** Speech to text. */
export type Transcriber = (audio: AudioInput) => Promise<string>;

export interface ChatProvider {
  readonly model: string;
  complete(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<string>;
  /** Missing when the vendor has no speech-to-text model (Anthropic, Ollama); index.ts borrows one. */
  transcribe?: Transcriber;
}

// Names end up inside the prompt's markup; quotes, brackets and line breaks could leave it.
const safeName = (name: string) => name.replace(/["<>\r\n]/g, "_");

/**
 * A message's text as the model reads it: each attached text file in a <file> block (the system
 * prompt says their content is data, not instructions), then the names of attached images, then
 * what the user wrote.
 */
export function textWithFiles(message: ChatMessage): string {
  const files = message.files ?? [];
  const blocks = files.flatMap((file) =>
    file.type === "text"
      ? [
          `<file name="${safeName(file.name)}">\n${file.text.replaceAll("</file", "<\\/file")}\n</file>`,
        ]
      : [],
  );
  const images = imagesOf(message).map((image) => safeName(image.name));
  if (images.length) blocks.push(`Attached images, in order: ${images.join(", ")}`);
  return [...blocks, message.content].filter(Boolean).join("\n\n");
}

export function imagesOf(message: ChatMessage): ImageFile[] {
  return (message.files ?? []).filter((file): file is ImageFile => file.type === "image");
}

export const dataUrl = (image: ImageFile) => `data:${image.mediaType};base64,${image.data}`;

/** Normalises Mistral content (string or content chunks) into plain text. */
export function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((chunk) => {
        if (typeof chunk === "string") return chunk;
        if (chunk && typeof chunk === "object" && "text" in chunk) {
          return String((chunk as { text: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

/**
 * Local stand-in used when no AI key is set (dev without a key, CI, e2e).
 * Echoes the last user message so flows can be exercised end-to-end, with the start of each
 * attached text file and the name of each image; a voice message becomes a fixed transcript.
 */
export function createEchoProvider(): ChatProvider {
  const reply = (messages: ChatMessage[]) => {
    const last = [...messages].reverse().find((m) => m.role === "user");
    const files = (last?.files ?? []).map((file) =>
      file.type === "text"
        ? `${file.name}: ${file.text.replace(/\s+/g, " ").trim().slice(0, 80)}`
        : `${file.name}: image`,
    );
    const attached = files.length ? ` (files: ${files.join("; ")})` : "";
    return `(echo) ${last?.content ?? ""}${attached}`.trim();
  };
  return {
    model: "echo",
    async complete(messages) {
      return reply(messages);
    },
    async *stream(messages) {
      for (const word of reply(messages).split(/(?<=\s)/)) yield word;
    },
    async transcribe() {
      return "(echo) voice message";
    },
  };
}
