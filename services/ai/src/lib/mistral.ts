import { Mistral } from "@mistralai/mistralai";
import {
  contentToText,
  dataUrl,
  imagesOf,
  textWithFiles,
  type AudioInput,
  type ChatOptions,
  type ChatMessage,
  type ChatProvider,
  type Transcriber,
} from "./provider";

// Models: https://docs.mistral.ai/getting-started/models/
//   mistral-small-latest   fast + cheap, good default
//   mistral-medium-latest  balanced
//   mistral-large-latest   most capable
//   codestral-latest       code
// Speech to text: voxtral-mini-latest (https://docs.mistral.ai/capabilities/audio_transcription).

export function createMistralTranscriber(options: { apiKey: string; model: string }): Transcriber {
  const client = new Mistral({ apiKey: options.apiKey });
  return async (audio: AudioInput) => {
    const result = await client.audio.transcriptions.complete({
      model: options.model,
      file: { fileName: audio.fileName, content: audio.data },
      language: audio.language,
    });
    return result.text.trim();
  };
}

/** Text files go into the text; images along as chunks (mistral-small and -medium read them). */
function toMistral(messages: ChatMessage[]) {
  return messages.map((message) => {
    const images = imagesOf(message);
    const text = textWithFiles(message);
    if (message.role !== "user" || !images.length) return { role: message.role, content: text };
    return {
      role: "user" as const,
      content: [
        { type: "text" as const, text },
        ...images.map((image) => ({ type: "image_url" as const, imageUrl: dataUrl(image) })),
      ],
    };
  });
}

export function createMistralProvider(options: {
  apiKey: string;
  model: string;
  transcriptionModel: string;
}): ChatProvider {
  const client = new Mistral({ apiKey: options.apiKey });
  const { model } = options;

  return {
    model,
    async complete(messages: ChatMessage[], opts: ChatOptions = {}) {
      const result = await client.chat.complete({
        model,
        messages: toMistral(messages),
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
      });
      return contentToText(result.choices?.[0]?.message?.content);
    },
    async *stream(messages: ChatMessage[], opts: ChatOptions = {}) {
      const events = await client.chat.stream({
        model,
        messages: toMistral(messages),
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
      });
      for await (const event of events) {
        const delta = event.data.choices?.[0]?.delta?.content;
        const text = contentToText(delta);
        if (text) yield text;
      }
    },
    transcribe: createMistralTranscriber({
      apiKey: options.apiKey,
      model: options.transcriptionModel,
    }),
  };
}
