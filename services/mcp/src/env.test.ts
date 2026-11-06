import { limitsEnabled, loadEnv } from "./env";

describe("mcp env", () => {
  const prod = {
    NODE_ENV: "production",
    PB_ADMIN_PASSWORD: "a".repeat(32),
    APP_URL: "https://app.example.com",
  };

  it("refuses the placeholder admin password and plain http in production", () => {
    expect(() => loadEnv({ ...prod, PB_ADMIN_PASSWORD: undefined })).toThrow(/PB_ADMIN_PASSWORD/);
    expect(() => loadEnv({ ...prod, PB_ADMIN_PASSWORD: "short" })).toThrow();
    expect(() => loadEnv({ ...prod, APP_URL: "http://app.example.com" })).toThrow(/https/);
    expect(loadEnv(prod).NODE_ENV).toBe("production");
  });

  it("applies defaults, with empty values as unset", () => {
    const env = loadEnv({ APP_NAME: "" });
    expect(env).toMatchObject({
      MCP_PORT: 8791,
      APP_URL: "http://localhost:5173",
      APP_NAME: "KanFun",
    });
  });

  it("rate limits in production unless RATE_LIMITS says otherwise", () => {
    expect(limitsEnabled(loadEnv(prod))).toBe(true);
    expect(limitsEnabled(loadEnv({ ...prod, RATE_LIMITS: "off" }))).toBe(false);
    expect(limitsEnabled(loadEnv({}))).toBe(false);
  });
});
