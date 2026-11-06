# KanFun

Built with the Vibe Coding Standard template: **React + Vite + Tailwind v4 + shadcn/ui** on the
client, **PocketBase** as the backend, **Node/TypeScript services** for anything that needs a
secret, **Jest** unit tests, **Playwright** end-to-end tests with seeded data, and a one-command
**Hetzner** deployment. Conventions for humans and AI agents live in [AGENTS.md](AGENTS.md);
`vibe.config.json` lists the features this app was set up with. The template's own terms are in
`TEMPLATE-LICENSE.md`; add your application's licence next to it.

## Layout

```
.
├── client/          React SPA (Vite, Tailwind v4, shadcn/ui, React Query, react-router)
├── server/          PocketBase: pinned binary, migrations, hooks, seed script
├── services/ai/     Hono service in front of the AI provider (verifies PocketBase sessions)
├── services/mcp/    MCP server: AI agents use the app for a user, after OAuth consent
├── services/mailer/ Every email in the stack: templates + Lettermint/Resend/SMTP provider
├── corporate-identity/ the brand: logo source, every logo and icon size, social images
├── web/             the website: Astro landing page, imprint, privacy, on its own domain
├── e2e/             Playwright tests (run against the seeded local stack)
├── deploy/          Caddy, Dockerfiles, and the deploy setup for Fly.io
├── scripts/         bootstrap / dev / reset-db
├── .env.example     the single .env every workspace reads
└── AGENTS.md        conventions and workflows for humans and AI agents
```

The technical reference is [docs/handbook.md](docs/handbook.md): architecture, the patterns
every page follows, services, email, testing, deployment, security and how agents work here.

Security is built in, not bolted on: [docs/security-checklist.md](docs/security-checklist.md)
lists every rule with the real incident behind it, every commit runs a security check (and asks
the questions a machine cannot answer), and before a launch you tell your agent "review security".

Not sure what to build, or want the plan before the code? Say "let's start Business Discovery" to
your agent: it interviews you, researches the market, and writes a direction, business plan,
marketing strategy and roadmap into `strategy/`, one document at a time, then files the first
phase as issues. Already have a business case or requirements document? Drop it into `strategy/`
and say so. Skip it when you just want to code; nothing depends on it.

The app installs on phones and desktops (add it to the iOS home screen and it runs full screen,
clear of the notch and the Dynamic Island). Its logo, icons and social images all come from
`corporate-identity/`: tell your agent "create a logo that ..." and it drafts options, previews
them and draws every file in every size (`corporate-identity/README.md` says which file is for what).

The website in `web/` starts as a template: your brand's claims in the hero, features, pricing, an
FAQ, imprint and privacy page. Once you know what your product is, tell your agent "write the
landing page": it asks for the product definition, keeps it in `docs/product.md` and writes the
page from it.

## Everyday commands

```sh
pnpm dev              # start everything (Ctrl+C stops everything)
pnpm test             # Jest in every workspace
pnpm test:e2e         # Playwright (starts the stack itself if needed)
pnpm test:e2e:ui      # Playwright UI mode
pnpm check            # security scan, prettier --check, eslint, tsc, jest  (what CI runs)
bash scripts/check-edge.sh   # the production Caddyfile in front of the built client
pnpm format           # prettier --write
pnpm seed             # re-apply seeds to the running server
pnpm db:reset         # wipe + reseed the local database
pnpm typegen          # regenerate client/src/lib/pb-types.ts from the live schema
pnpm bootstrap        # re-run the setup steps (deps, PocketBase, seeds, browsers)
pnpm --filter client ui:add dialog     # add a shadcn component
pnpm deploy:prod      # deploy prod to the target picked in setup (see deploy/README.md)
pnpm deploy:dev       # the same for the dev tier (deploy/.env.dev)
pnpm brand            # logos, app icons and social images from corporate-identity/
pnpm roadmap --phase 0 # file a roadmap phase (strategy/) as issues; --dry-run shows what changes
```

| URL                             | What                               |
| ------------------------------- | ---------------------------------- |
| http://localhost:5173           | the app                            |
| http://127.0.0.1:8090/_/        | PocketBase admin (creds in `.env`) |
| http://localhost:5173/dev/mail  | dev inbox (every email sent)       |
| http://localhost:4321           | the website                        |
| http://127.0.0.1:8787/ai/health | AI service                         |

Seeded logins: `alice@example.com` / `bob@example.com`, password `password1234`.

## Integrations and keys

Everything runs without keys; add them in `.env` when you want the real thing.

- **AI**: `MISTRAL_API_KEY`, `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` (`AI_PROVIDER=auto` uses the
  one that is set), or `AI_PROVIDER=ollama` for local models. The assistant page streams replies
  (Markdown with tables and formulas),
  keeps every conversation (new, rename, delete), reads attached images, PDFs and text files in
  the browser and takes voice input: live dictation where the browser recognises speech,
  Mistral's or OpenAI's speech to text elsewhere. Without a key the service echoes the prompt, so
  it all works offline.

- **MCP server**: no key needed. Agents (Claude, ChatGPT, Cursor) connect to `<app>/mcp`; each
  user approves an agent and what it may do on `/connect`, and sees, limits and disconnects it in
  Settings, where personal access tokens for scripts are made too. New tools: AGENTS.md "Add an
  MCP tool".

- **Email**: `LETTERMINT_TOKEN` (EU, recommended), `RESEND_API_KEY` (US) or `SMTP_*`; PocketBase's auth
  mails use the same setting. Without them, every email lands in the dev inbox.
- **Two-factor sign-in**: no key needed. Users turn it on in Settings with an authenticator app
  (QR code; Google or Microsoft Authenticator, 1Password) or email codes, which need the email
  setup above in production.

## Read next

- [AGENTS.md](AGENTS.md): how the pieces fit, conventions, and step-by-step recipes.
- [server/README.md](server/README.md), [client/README.md](client/README.md),
  [services/README.md](services/README.md), [deploy/README.md](deploy/README.md).
