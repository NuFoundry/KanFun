import { lettermintOptions, loadEnv, resolveProvider } from "./env";

describe("mailer env", () => {
  it("refuses a placeholder or short internal token in production", () => {
    expect(() => loadEnv({ NODE_ENV: "production" })).toThrow(/MAIL_INTERNAL_TOKEN/);
    expect(() => loadEnv({ NODE_ENV: "production", MAIL_INTERNAL_TOKEN: "short-but-8" })).toThrow();
    // The value deploy/.env.prod.example ships with is 32 characters long.
    expect(() =>
      loadEnv({ NODE_ENV: "production", MAIL_INTERNAL_TOKEN: "replace-with-openssl-rand-hex-32" }),
    ).toThrow();
    expect(loadEnv({ NODE_ENV: "production", MAIL_INTERNAL_TOKEN: "f".repeat(64) }).NODE_ENV).toBe(
      "production",
    );
  });

  it("defaults to the outbox provider", () => {
    const env = loadEnv({});
    expect(resolveProvider(env)).toBe("outbox");
    expect(env.MAIL_PORT).toBe(8788);
    expect(env.SMTP_SECURE).toBe(false);
  });

  it("prefers Lettermint, then Resend, then SMTP, when configured", () => {
    const all = { LETTERMINT_TOKEN: "lm_x", RESEND_API_KEY: "re_x", SMTP_HOST: "smtp.x" };
    expect(resolveProvider(loadEnv(all))).toBe("lettermint");
    expect(resolveProvider(loadEnv({ RESEND_API_KEY: "re_x", SMTP_HOST: "smtp.x" }))).toBe(
      "resend",
    );
    expect(resolveProvider(loadEnv({ SMTP_HOST: "smtp.x" }))).toBe("smtp");
  });

  it("honours an explicit provider", () => {
    expect(resolveProvider(loadEnv({ MAIL_PROVIDER: "outbox", RESEND_API_KEY: "re_x" }))).toBe(
      "outbox",
    );
    expect(() => loadEnv({ MAIL_PROVIDER: "pigeon" })).toThrow();
  });

  it("refuses a chosen provider without its credentials", () => {
    expect(() => loadEnv({ MAIL_PROVIDER: "lettermint" })).toThrow(/LETTERMINT_TOKEN/);
    expect(() => loadEnv({ MAIL_PROVIDER: "resend" })).toThrow(/RESEND_API_KEY/);
    expect(() => loadEnv({ MAIL_PROVIDER: "smtp" })).toThrow(/SMTP_HOST/);
  });

  it("sends through Lettermint's relay with STARTTLS and no tracking on any message", () => {
    expect(lettermintOptions(loadEnv({ LETTERMINT_TOKEN: "lm_token" }))).toEqual({
      name: "lettermint",
      host: "smtp.lettermint.co",
      port: 587,
      secure: false,
      user: "lettermint",
      pass: "lm_token",
      headers: { "X-LM-Override-Track-Opens": "false", "X-LM-Override-Track-Clicks": "false" },
    });
  });
});
