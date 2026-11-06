# services — Node/TypeScript services

Anything that needs a secret, a long-running process, or logic that doesn't fit PocketBase hooks
lives here as its own pnpm workspace. `pnpm dev` starts every folder that has a `package.json`.

| Service   | Port | Purpose                                                                                                                 |
| --------- | ---- | ----------------------------------------------------------------------------------------------------------------------- |
| `ai/`     | 8787 | Hono API in front of Mistral, OpenAI, Anthropic or Ollama. Verifies the caller's PocketBase token. Echo offline.        |
| `mailer/` | 8788 | Every email in the stack, PocketBase's auth mails included. Templates + provider (Lettermint / Resend / SMTP / outbox). |
| `mcp/`    | 8791 | MCP server: AI agents use the app for a user after OAuth consent; tools run with the user's own PocketBase rights.      |

To add a service, copy `mailer/` (package.json, tsconfig, jest config, Dockerfile) and pick a
unique route prefix (`/jobs/*`, ...) so Caddy and the Vite proxy can route it, and give its Caddy
`handle` a `request_body { max_size }`. A service only other services call (like the mailer) gets
no public route at all. Each
service verifies PocketBase user tokens with the `lib/auth.ts` middleware (copy it) and accepts
a `reportError` dependency so errors reach the monitoring tool without importing it in tests.
