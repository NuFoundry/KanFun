import { aiHealth, parseSseEvent, streamChat, transcribe } from "./ai";

jest.mock("@/lib/pocketbase", () => ({ pb: { authStore: { token: "tok" } } }));

describe("streamChat", () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  /** A response body that delivers the given SSE text in one chunk. */
  const sse = (text: string) => {
    let sent = false;
    return {
      getReader: () => ({
        read: async () => {
          if (sent) return { done: true, value: undefined };
          sent = true;
          return { done: false, value: new TextEncoder().encode(text) };
        },
      }),
    };
  };

  it("posts the conversation and language with the token, never a system prompt", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      body: sse('data: {"delta":"Hel"}\n\ndata: {"delta":"lo"}\n\ndata: [DONE]\n\n'),
    });
    const deltas: string[] = [];
    for await (const delta of streamChat([{ role: "user", content: "hi" }], { language: "de" })) {
      deltas.push(delta);
    }
    expect(deltas.join("")).toBe("Hello");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8787/ai/chat/stream");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body as string)).toEqual({
      messages: [{ role: "user", content: "hi" }],
      language: "de",
    });
  });

  it("surfaces the server error message", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: "nope" }) });
    const run = async () => {
      for await (const _ of streamChat([{ role: "user", content: "hi" }])) void _;
    };
    await expect(run()).rejects.toThrow("nope");
  });
});

describe("transcribe", () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("uploads the recording as a form with its language", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ text: "hello" }) });
    const audio = new Blob(["x"], { type: "audio/mp4" });
    await expect(transcribe(audio, "de")).resolves.toBe("hello");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8787/ai/transcribe");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    const form = init.body as FormData;
    expect((form.get("audio") as File).name).toBe("voice.m4a");
    expect(form.get("language")).toBe("de");
  });

  it("reports whether voice is available", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, model: "echo", transcription: false }),
    });
    await expect(aiHealth()).resolves.toMatchObject({ transcription: false });
  });
});

describe("parseSseEvent", () => {
  it("extracts deltas and ignores [DONE]", () => {
    expect(parseSseEvent('data: {"delta":"a"}\ndata: {"delta":"b"}')).toEqual(["a", "b"]);
    expect(parseSseEvent("data: [DONE]")).toEqual([]);
    expect(parseSseEvent("data: not json")).toEqual([]);
  });
});
