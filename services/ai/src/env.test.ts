import { limitsEnabled, loadEnv, parseOrigins, resolveProvider, resolveTranscriber } from "./env";

describe("loadEnv", () => {
  it("applies defaults", () => {
    const env = loadEnv({});
    expect(env.AI_PORT).toBe(8787);
    expect(env.MISTRAL_MODEL).toBe("mistral-small-latest");
    expect(env.MISTRAL_API_KEY).toBeUndefined();
    expect(env.OPENAI_MODEL).toBe("gpt-6-luna");
    expect(env.ANTHROPIC_MODEL).toBe("claude-opus-5-5");
    expect(env.OLLAMA_MODEL).toBe("llama3.2");
    expect(env.MISTRAL_TRANSCRIPTION_MODEL).toBe("voxtral-mini-latest");
    expect(env.OPENAI_TRANSCRIPTION_MODEL).toBe("gpt-4o-mini-transcribe");
    expect(resolveProvider(env)).toBe("echo");
  });

  it("coerces numbers and validates URLs", () => {
    expect(loadEnv({ AI_PORT: "9000" }).AI_PORT).toBe(9000);
    expect(() => loadEnv({ POCKETBASE_URL: "not a url" })).toThrow();
  });
});

describe("parseOrigins", () => {
  it("splits and trims", () => {
    expect(parseOrigins(" http://a.test, https://b.test ,")).toEqual([
      "http://a.test",
      "https://b.test",
    ]);
  });
});

describe("resolveProvider", () => {
  it("picks the first configured key in auto mode", () => {
    expect(resolveProvider(loadEnv({ OPENAI_API_KEY: "sk", ANTHROPIC_API_KEY: "ak" }))).toBe(
      "openai",
    );
    expect(resolveProvider(loadEnv({ ANTHROPIC_API_KEY: "ak" }))).toBe("anthropic");
    expect(resolveProvider(loadEnv({ MISTRAL_API_KEY: "mk", OPENAI_API_KEY: "sk" }))).toBe(
      "mistral",
    );
  });

  it("honours an explicit provider, falling back to echo without its key", () => {
    expect(resolveProvider(loadEnv({ AI_PROVIDER: "ollama" }))).toBe("ollama");
    expect(resolveProvider(loadEnv({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "ak" }))).toBe(
      "anthropic",
    );
    expect(resolveProvider(loadEnv({ AI_PROVIDER: "anthropic", OPENAI_API_KEY: "sk" }))).toBe(
      "echo",
    );
    expect(resolveProvider(loadEnv({ AI_PROVIDER: "echo", OPENAI_API_KEY: "sk" }))).toBe("echo");
    expect(() => loadEnv({ AI_PROVIDER: "bard" })).toThrow();
  });
});

describe("resolveTranscriber", () => {
  it("uses the chat vendor's speech to text, or borrows one, or none", () => {
    expect(resolveTranscriber(loadEnv({}))).toBe("echo");
    expect(resolveTranscriber(loadEnv({ MISTRAL_API_KEY: "mk" }))).toBe("mistral");
    expect(resolveTranscriber(loadEnv({ OPENAI_API_KEY: "sk" }))).toBe("openai");
    expect(resolveTranscriber(loadEnv({ ANTHROPIC_API_KEY: "ak", OPENAI_API_KEY: "sk" }))).toBe(
      "openai",
    );
    expect(resolveTranscriber(loadEnv({ AI_PROVIDER: "ollama", MISTRAL_API_KEY: "mk" }))).toBe(
      "mistral",
    );
    expect(resolveTranscriber(loadEnv({ ANTHROPIC_API_KEY: "ak" }))).toBeNull();
    expect(resolveTranscriber(loadEnv({ AI_PROVIDER: "ollama" }))).toBeNull();
  });
});

describe("limitsEnabled", () => {
  it("is on in production unless RATE_LIMITS says otherwise", () => {
    expect(limitsEnabled(loadEnv({}))).toBe(false);
    expect(limitsEnabled(loadEnv({ NODE_ENV: "production" }))).toBe(true);
    expect(limitsEnabled(loadEnv({ NODE_ENV: "production", RATE_LIMITS: "off" }))).toBe(false);
    expect(limitsEnabled(loadEnv({ RATE_LIMITS: "on" }))).toBe(true);
    expect(() => loadEnv({ RATE_LIMITS: "maybe" })).toThrow();
  });
});
