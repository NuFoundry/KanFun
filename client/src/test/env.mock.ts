// Jest stand-in for src/lib/env.ts (import.meta is not available under ts-jest/CommonJS).
export const env = {
  appName: "KanFun",
  pocketbaseUrl: "http://127.0.0.1:8090",
  mailUrl: "http://127.0.0.1:8788/mail",
  aiUrl: "http://127.0.0.1:8787/ai",
  mcpUrl: "http://127.0.0.1:8791/mcp",
  isDev: false,
  mode: "test",
} as const;
