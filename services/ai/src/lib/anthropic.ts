import Anthropic from "@anthropic-ai/sdk";
import {
  imagesOf,
  textWithFiles,
  type ChatOptions,
  type ChatMessage,
  type ChatProvider,
} from "./provider";

// Anthropic (https://platform.claude.com/docs): claude-opus-5-5 is the default; claude-sonnet-5-5
// is the cheaper everyday model, claude-haiku-4-5 the cheapest. Thinking is adaptive by default
// on these models and sampling parameters are not accepted, so `temperature` is ignored here.
// Server-side fallbacks re-run a declined request on another Claude model inside the same call.

const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const DEFAULT_MAX_TOKENS = 16_000;

export function createAnthropicProvider(options: { apiKey: string; model: string }): ChatProvider {
  const client = new Anthropic({ apiKey: options.apiKey });
  const { model } = options;

  const request = (messages: ChatMessage[], opts: ChatOptions) => ({
    model,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n"),
    // Text files go into the text; images come first, as Anthropic recommends.
    messages: messages
      .filter((m): m is ChatMessage & { role: "user" | "assistant" } => m.role !== "system")
      .map((m) => ({
        role: m.role,
        content: [
          ...imagesOf(m).map((image) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: image.mediaType, data: image.data },
          })),
          { type: "text" as const, text: textWithFiles(m) },
        ],
      })),
    betas: [FALLBACK_BETA],
    fallbacks: "default" as const,
  });

  return {
    model,
    async complete(messages: ChatMessage[], opts: ChatOptions = {}) {
      const response = await client.beta.messages.create(request(messages, opts));
      if (response.stop_reason === "refusal") {
        throw new Error(response.stop_details?.explanation ?? "The model declined this request.");
      }
      return response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
    },
    async *stream(messages: ChatMessage[], opts: ChatOptions = {}) {
      const stream = client.beta.messages.stream(request(messages, opts));
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield event.delta.text;
        }
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") {
        throw new Error(final.stop_details?.explanation ?? "The model declined this request.");
      }
    },
  };
}
