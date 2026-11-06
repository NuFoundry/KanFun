import OpenAI, { toFile } from "openai";
import {
  dataUrl,
  imagesOf,
  textWithFiles,
  type AudioInput,
  type ChatOptions,
  type ChatMessage,
  type ChatProvider,
  type Transcriber,
} from "./provider";

// OpenAI (https://platform.openai.com/docs/models): gpt-6-luna is the efficient default,
// gpt-6-astra the most capable. The same client serves Ollama through its OpenAI-compatible
// endpoint (`<OLLAMA_URL>/v1`, any api key), so one file covers both; Ollama has no speech to
// text, so only the real OpenAI gets a transcriber (gpt-4o-mini-transcribe, or whisper-1).

export function createOpenAiTranscriber(options: { apiKey: string; model: string }): Transcriber {
  const client = new OpenAI({ apiKey: options.apiKey });
  return async (audio: AudioInput) => {
    const result = await client.audio.transcriptions.create({
      model: options.model,
      file: await toFile(audio.data, audio.fileName),
      language: audio.language,
    });
    return result.text.trim();
  };
}

/** Text files go into the text; images along as parts (Ollama needs a vision model for them). */
function toOpenAi(messages: ChatMessage[]): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((message) => {
    const images = imagesOf(message);
    const text = textWithFiles(message);
    if (message.role !== "user" || !images.length) return { role: message.role, content: text };
    return {
      role: "user",
      content: [
        { type: "text", text },
        ...images.map((image) => ({
          type: "image_url" as const,
          image_url: { url: dataUrl(image) },
        })),
      ],
    };
  });
}

export function createOpenAiProvider(options: {
  apiKey: string;
  model: string;
  baseURL?: string;
  transcriptionModel?: string;
}): ChatProvider {
  const client = new OpenAI({ apiKey: options.apiKey, baseURL: options.baseURL });
  const { model } = options;

  return {
    model,
    async complete(messages: ChatMessage[], opts: ChatOptions = {}) {
      const result = await client.chat.completions.create({
        model,
        messages: toOpenAi(messages),
        temperature: opts.temperature,
        max_completion_tokens: opts.maxTokens,
      });
      return result.choices[0]?.message?.content ?? "";
    },
    async *stream(messages: ChatMessage[], opts: ChatOptions = {}) {
      const events = await client.chat.completions.create({
        model,
        messages: toOpenAi(messages),
        temperature: opts.temperature,
        max_completion_tokens: opts.maxTokens,
        stream: true,
      });
      for await (const event of events) {
        const text = event.choices[0]?.delta?.content;
        if (text) yield text;
      }
    },
    ...(options.transcriptionModel && {
      transcribe: createOpenAiTranscriber({
        apiKey: options.apiKey,
        model: options.transcriptionModel,
      }),
    }),
  };
}
