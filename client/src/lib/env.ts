/**
 * The only file allowed to read `import.meta.env`. Jest swaps it for src/test/env.mock.ts.
 * Empty VITE_* URLs mean "same origin": Vite proxies /api, /_ and the service prefixes in dev,
 * Caddy in prod.
 */
export const env = {
  appName: import.meta.env.VITE_APP_NAME || "KanFun",
  pocketbaseUrl: import.meta.env.VITE_POCKETBASE_URL || "/",
  /** Mailer prefix; only the dev inbox (/dev/mail) reads it in the browser. */
  mailUrl: import.meta.env.VITE_MAIL_URL || "/mail",
  aiUrl: import.meta.env.VITE_AI_URL || "/ai",
  mcpUrl: import.meta.env.VITE_MCP_URL || "/mcp",
  isDev: import.meta.env.DEV,
  mode: import.meta.env.MODE,
} as const;
