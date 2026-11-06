# AGENTS.md

Guidance for AI coding agents (Claude Code, Cursor, Codex, ...) and humans working in this repo.
Read this before changing anything. Keep it current when you change a convention.

## 1. What this is

A monorepo (pnpm workspaces) for small-to-medium web apps. `vibe.config.json` records the
features this app was set up with; sections marked _(feature)_ below only apply when present.

| Workspace          | Stack                                                                             | Port |
| ------------------ | --------------------------------------------------------------------------------- | ---- |
| `client/`          | React 19, Vite, TypeScript, Tailwind v4, shadcn/ui, React Query, react-router v7  | 5173 |
| `server/`          | PocketBase (Go binary, SQLite). JS migrations + hooks, TS seed script             | 8090 |
| `services/ai/`     | Hono on Node 24; Mistral, OpenAI, Anthropic or Ollama. Verifies PocketBase tokens | 8787 |
| `services/mailer/` | Hono on Node 24. Every email: templates, Lettermint/Resend/SMTP/outbox            | 8788 |
| `services/mcp/`    | Hono on Node 24, MCP SDK. AI agents act for a user after OAuth consent            | 8791 |
| `web/`             | Astro, static: the website (landing page, legal pages) on its own domain          | 4321 |
| `e2e/`             | Playwright, runs against the seeded local stack                                   |      |
| `deploy/`          | Caddy + Dockerfiles; Fly.io apps and/or Docker Compose for a VPS (see §9)         |      |

### Where things are (read this instead of exploring)

```
client/src/App.tsx                 routes; add pages here
client/src/routes/*.tsx            one file per page (home, login, dashboard, settings, post-detail, ...)
client/src/components/             site-header, layout, protected-route, feature widgets; ui/ = shadcn
client/src/components/assistant/   chat composer (files, voice), messages, conversation list
client/src/lib/attachments.ts      files for the assistant, read in the browser (pdf-text, scale-image)
client/src/lib/api/conversations.ts   saved chats (conversations collection)
client/src/components/skeletons.tsx + states.tsx   LoadingRegion/TableSkeleton/DetailSkeleton, EmptyState/ErrorState
client/src/components/list-toolbar.tsx + list-pagination.tsx   ListToolbar/ListSearch/ListSelect/SortableHead, ListPagination
client/src/hooks/use-list-params.ts   sort, search, filters and page of a list, kept in the URL
client/src/lib/api/*.ts            data access (pure functions) + tests; hooks/use-*.ts wrap them
client/src/lib/api/users.ts        profile (first/last name -> name) and password change
server/pb_hooks/two-factor.pb.js   two-factor sign-in (app codes, email codes, recovery); UI two-factor-*.tsx
client/src/lib/auth-context.tsx    session, login/register/logout, per-user side effects
client/src/lib/env.ts              the only reader of import.meta.env; pb-types.ts is generated
client/src/i18n/locales/*.json     every UI string (i18n)
server/pb_migrations/*.js          schema + API rules, one file per change
server/pb_hooks/*.pb.js            server-side logic: main (slugs, routes), mail
server/seed/data.ts + index.ts     seed users/posts (mirrored in e2e/fixtures.ts SEED)
services/<name>/src/app.ts         Hono routes; index.ts wires env + providers; lib/ = vendor code
services/mcp/src/tools/            what AI agents can do through the MCP server, one file per area
client/src/routes/connect.tsx      the consent page agents send users to; settings → connected-apps.tsx
e2e/<feature>.spec.ts              Playwright per feature; fixtures.ts has login/authedPage/waitForMail
.env.example                       every variable, commented; scripts/*.sh = dev/bootstrap/reset/check-conventions
deploy/                            Caddyfile + Dockerfiles; fly/ and/or hetzner/ per target
docs/handbook.md                   the technical reference (what this file prescribes, explained)
docs/security-checklist.md         every security rule, with the incident behind it
scripts/check-security.sh          the rules a machine checks (pnpm check + the pre-commit hook)
scripts/check-deploy.sh            Dockerfiles, Fly configs and Compose, checked before a deploy (pnpm check; CI builds the images)
server/pb_hooks/security.pb.js     production rate limits; a custom route that needs one goes here
e2e/security.spec.ts, e2e/edge/    cross-user probes; the production Caddyfile, tested
.agents/skills/security-review/    "review security": the pre-launch review, repeatable
corporate-identity/                the brand: logo/mark.svg + brand.json are the source, the rest is drawn
.agents/skills/brand/              "create a logo": drafts, colours, every logo, icon and banner
references/                        what the user dropped for you: screenshots, designs, documents (git-ignored)
strategy/                          Business Discovery: brief, research, direction, plan, marketing, roadmap (README there)
.agents/skills/business-discovery/ "Business Discovery": the interview that writes strategy/ and files the roadmap
web/src/components/                the website's sections, copy per language in each
.agents/skills/website/            "write the landing page": product definition, copy, sections
```

One `.env` at the repo root feeds every workspace (`.env.example` documents each variable).
The browser talks to PocketBase directly through the JS SDK, and to services through
same-origin paths (one prefix per service: `/ai/*`, `/billing/*`), proxied by Vite in dev and by
Caddy in production. The mailer is internal: hooks and services call it, the edge answers 404 for
`/mail/*`, and its dev inbox exists in development only.

**`references/` is the user's drop folder** for screenshots, designs, documents and briefs; only
its README is tracked, so nothing there ever reaches git or an image. Look there when a message
mentions a screenshot or document, and before building a page or feature it may describe. Move a
file to `references/done/` once it is acted on; `status` lists the rest with a suggested action.

**When the user asks what this template can do, how the stack fits together, what a feature
does or how to deploy, answer from `docs/handbook.md`** (section 1 lists everything the wizard
set up; 8 is deployment; 9 is security; 10 is how agents work here). Do not explore the code to answer a
question the handbook already answers; a reader new to React or PocketBase is asking for the
tour, not for file names.

**When the user asks for a logo, an app icon, brand colours, a banner or any other brand file,
follow `.agents/skills/brand/SKILL.md`.** The source is `corporate-identity/logo/mark.svg` and
`corporate-identity/brand.json`; `pnpm brand` writes every version and size into
`corporate-identity/` and the app's icons into `client/public`. Never place a logo anywhere else.

**When the user asks for the landing page, the website's copy or a page on it, follow
`.agents/skills/website/SKILL.md`.** It starts from the product definition in `docs/product.md`
and asks for what is missing before writing.

**When the user says "Business Discovery"** ("let's start Business Discovery", or asks for market
research, a business plan, a marketing plan, a requirements document or roadmap, or to file the
roadmap as issues), follow `.agents/skills/business-discovery/SKILL.md`. It interviews, researches
and writes `strategy/` one document at a time, each after the user read the one before, then files
phase 0 with `pnpm roadmap`. Never start it on your own: a user who wants to build starts with a
feature; mention once that it exists when `strategy/` has no `brief.md`.

## 2. Commands you will actually use

```sh
pnpm dev              # start server + all services + client (scripts/dev.sh, concurrently)
pnpm check            # format:check + lint + typecheck + unit tests  -> run before finishing a task
pnpm test             # Jest, all workspaces      (pnpm --filter client test:watch for TDD)
pnpm test:e2e         # Playwright; boots the stack if it is not running
pnpm format           # Prettier (Tailwind class sorting included)
pnpm seed / db:reset  # apply seeds / wipe and reseed local DB
pnpm typegen          # regenerate client/src/lib/pb-types.ts after schema changes
pnpm bootstrap        # re-run setup: deps, PocketBase binary, superuser, seeds, types, browser
bash scripts/check-edge.sh   # built client behind the production Caddyfile: headers, CSP, blocks
bash scripts/check-deploy.sh --build   # Dockerfiles, Fly configs, Compose; builds every image
pnpm brand            # every logo, icon and social image from corporate-identity/ (--preview: drafts)
pnpm roadmap --phase 0 [--dry-run]   # the roadmap items of a phase (strategy/04) as issues with labels and milestones; re-run after edits
pnpm --filter client ui:add <component>   # shadcn CLI
pnpm --filter server migrate:create "<name>"
```

Dev credentials: PocketBase admin from `PB_ADMIN_EMAIL`/`PB_ADMIN_PASSWORD`; seeded users
`alice@example.com`, `bob@example.com` with `SEED_USER_PASSWORD` (default `password1234`).

## 3. Definition of done

A task is finished only when all of these hold:

1. `pnpm check` passes (no keys in tracked files, Prettier, ESLint, `tsc`, Jest).
2. New logic has Jest coverage: pure functions and hooks in `client/`, request handlers in
   `services/*`, seed data in `server/seed`.
3. Every feature is covered end to end: a new user-facing flow gets a new Playwright spec in
   `e2e/`; a change to an existing flow updates the affected specs and `e2e/fixtures.ts`; seed
   data the spec relies on is added to `server/seed/`. Run `pnpm test:e2e` and make it pass
   before declaring the task done. Do not skip it because "only the UI changed".
   A view that loads data also has its loading, empty and error states (section 4), a unit test
   per state, and a row in `e2e/loading.spec.ts`.
4. Schema changes ship as a migration in `server/pb_migrations/`, regenerated `pb-types.ts`,
   updated seeds, and updated API rules.
5. Docs updated: this file for conventions, `README.md` for commands, `.env.example` for new vars,
   `docs/handbook.md` where the behaviour it describes changed (keep it short; tables and diagrams).
6. Security holds: the pre-commit hook passes and you answered its questions for the change
   (section 10); a new collection, relation or route has a probe in `e2e/security.spec.ts`; a
   change to `deploy/Caddyfile`, `client/index.html` or anything loaded from another origin
   passes `bash scripts/check-edge.sh`; a change to a Dockerfile, `deploy/fly/*.toml` or
   `docker-compose.yml` passes `bash scripts/check-deploy.sh --build` (the configs in `pnpm check`,
   the image builds in CI).

Do not mark work complete with failing tests, skipped checks, or TODOs that hide broken paths.

## 4. Architecture rules

- **Security rules.** Each one comes from a real incident in an app built on this template;
  `docs/security-checklist.md` has the reasons and the guards.
  - _Data:_ every API rule limits records to their owner or tenant. Update rules are checked
    against the stored record, so ownership fields stay put:
    `(@request.body.owner:isset = false || @request.body.owner = owner)`. A relation accepts only
    records of the same owner or tenant (a hook; PocketBase checks no rule on relation targets).
    A hook that reads with full rights checks the caller's access first. Fields only the server
    sets (numbers, timestamps, `createdBy`, tokens, plan) are reset in `onRecord*Request` hooks.
    A limit (quota, numbering, daily sends) is counted and checked in one transaction.
    `users.deleteRule` stays `null`: account deletion is a route that cleans up.
  - _Abuse:_ a custom route that sends mail, checks a password or creates many records gets a
    rule in `server/pb_hooks/security.pb.js`. Mail to an unverified address carries no text the
    user chose. Anything billed per use has a per-user daily cap.
  - _Services:_ `requireAuth`, a body limit, a per-user rate limit where calls cost money, fixed
    error texts. Never trust ids of other users, prices, prompts or redirect targets from the
    client. A secret refuses a placeholder in production; tokens compare in constant time;
    development-only routes need an explicit flag, never "not production".
  - _Browser and privacy:_ text stays text (no raw HTML, `eval`, Markdown images), links are
    http(s) or mailto, filters go through `pb.filter()`, nothing loads from another origin (the
    CSP allows this origin only). Third parties get user ids only and URLs through `redactUrl()`.
  - _Edge:_ never route an internal service or admin page publicly; every prefix gets a body
    limit in `deploy/Caddyfile`.
- **Write less code.** Before adding anything, walk down this ladder and stop at the first rung
  that works: (1) does it need to exist at all, (2) is it already in the repo, (3) does the
  standard library or the platform (browser, PocketBase, Hono) do it, (4) does an installed
  dependency do it, (5) is it one line, (6) only then the smallest solution that works. No
  speculative abstractions, wrappers, options or configurability nobody asked for. This never
  removes tests, migrations, seeds, error handling or docs from the definition of done; it
  removes everything else that was not requested.
- **PocketBase is the source of truth.** Auth, CRUD, file uploads, realtime: use the SDK
  (`client/src/lib/pocketbase.ts`) and PocketBase API rules. Do not put a Node API in front
  of PocketBase for plain CRUD.
- **Secrets never reach the browser.** Anything needing an API key (AI providers, Stripe, email,
  ...) goes into a service under `services/`. Services authenticate callers by verifying the
  PocketBase token (`services/*/src/lib/auth.ts`); copy that middleware for new services.
- **Server-side logic that must be atomic with DB writes** (validation, computed fields,
  cascading updates) belongs in `server/pb_hooks/*.pb.js`. Rules there: handlers run in
  isolated VMs (no top-level state, `require()` inside handlers), no `async`, always `e.next()`.
- **Relative URLs everywhere in the client.** `/api`, `/_` (PocketBase) and the service
  prefixes are proxied. Add a new service prefix in `client/vite.config.ts` and
  `deploy/Caddyfile` at the same time.
- **Only `client/src/lib/env.ts` reads `import.meta.env`.** Jest maps it to `src/test/env.mock.ts`.
- **Data access is split**: pure functions in `client/src/lib/api/*.ts` (easy to unit test),
  React Query hooks in `client/src/hooks/use-*.ts`, UI in `client/src/routes` + `components`.
- **Design tokens only.** Colors come from CSS variables in `client/src/styles.css`
  (`bg-primary`, `text-muted-foreground`, ...). Never hardcode hex/oklch in components.
- **Form controls sit on `bg-field`** (white in light mode, a lifted grey in dark): `Input`,
  `Textarea` and `SelectTrigger` carry it, so a search box or filter placed straight on the page
  or on a `bg-muted` panel still reads as a control. Never make a control transparent or give it
  the surface it sits on; a new control (combobox, date picker, ...) gets `bg-field` too. The
  exceptions are inline editors that must look like text until focused, and a control inside a
  `Card`, where both surfaces are white anyway.
- **shadcn/ui components live in `client/src/components/ui/`** and may be edited; they are
  ours. Add new ones with the CLI rather than hand-writing Radix wrappers. Re-adding `input`,
  `textarea` or `select` with the CLI restores shadcn's transparent default; put `bg-field` back
  (`ui/fields.test.tsx` fails until you do).
- **Forms**: `react-hook-form` + `zod` + shadcn `Form` components (see `routes/login.tsx`).
- **Four states for every data view: loading, error, empty, content.** The loading state is a
  skeleton that mirrors the content it replaces (same container, same card/table chrome, a
  typical number of rows) so nothing moves when data arrives; a bare grey bar is not a skeleton.
  Components keep their twin next to them (`PostCard` + `PostCardSkeleton`), pages wrap it in
  `LoadingRegion` from `components/skeletons.tsx` (also `TableSkeleton`, `DetailSkeleton`), and
  use `EmptyState` / `ErrorState` (with `onRetry={refetch}`) from `components/states.tsx`. Test
  ids: `<view>-loading`, `<view>-empty`, `<view>-error`. Not a skeleton: mutations (button
  pending state, content stays), background refetches and filtering of loaded data (keep the
  data, never flash a skeleton over it), streaming output (typing indicator), loading more
  (skeleton rows appended), a missing record (that is an empty state), tiny inline values. No
  artificial minimum display time.
- **Every list view: surface, sort, filter, pages.** The dashboard table and the home grid are
  the reference; copy them.
  - _Surface._ A list never sits bare on the page: a table or row list goes inside a `Card`
    (white on the off-white page and on muted panels); a grid of cards is already on its
    surface. Nothing in a list is transparent.
  - _Sort._ Every list is sortable, server-side through the query, never by reordering the
    loaded page. Tables sort by column header (`SortableHead` from `components/list-toolbar.tsx`,
    arrow on the active column); grids and row lists get a sort `ListSelect` in the toolbar.
    Default: newest first, unless the data has a natural order (name, position).
  - _Filter._ A list whose records have more than one obvious attribute gets a `ListToolbar`:
    `ListSearch` over the text users look for (title, name, email) and one `ListSelect` per
    enum-like field (status, plan, role), first option "All". A short list the user owns
    outright (a settings page, a picker) gets none.
  - _Pages._ Server-side, `PAGE_SIZE` (20) per page via PocketBase `getList(page, perPage,
{ sort, filter })`, with `ListPagination` under the list ("Showing 1–20 of 41" plus page
    links; links disappear when everything fits). Only truly short lists load everything.
  - _State in the URL._ Sort, search, filters and page come from `useListParams()` (`?q=&sort=
&page=&status=`), so a list is linkable, survives a reload and respects the back button.
    Setting a search or filter resets the page; unknown sort columns fall back to the default.
  - _Four states still apply._ `placeholderData: keepPreviousData` keeps the list on screen
    while a new page or filter loads (no skeleton flash). An empty result with a search or
    filter active shows "No matches" with a "Clear filters" action (`<view>-clear`), distinct
    from "nothing here yet".
  - _Test ids_ `<view>-toolbar`, `<view>-search`, `<view>-<filter>`, `sort-<column>`,
    `<view>-pagination`, `<view>-showing`; the Playwright spec sorts, searches, filters and pages
    the list at least once (`e2e/lists.spec.ts` shows how to seed 21 rows through the API).
- **Screen edges** (installable app): on phones the app draws edge to edge (`viewport-fit=cover`),
  so anything sticky or fixed at an edge pads by the safe-area insets: `pt-safe` at the top,
  `pb-safe` or `pb-[max(1rem,env(safe-area-inset-bottom))]` at the bottom, `px-safe` on the sides,
  and a full-height view subtracts them from `100dvh`. Never use the status bar style
  `black-translucent`. A new top-level page goes into `links` in `components/site-header.tsx`,
  which feeds both the bar and the phone menu.
- **Feedback**: `toast` from `sonner` for mutation success/error, `role="alert"` for inline
  errors; `aria-busy` + `role="status"` come from `LoadingRegion`. Toasts start below the
  header and carry a close button (`components/ui/sonner.tsx`); keep both if you restyle them.

- **Every visible string goes through `t()`** _(i18n)_: keys live in
  `client/src/i18n/locales/en.json` (typed, a typo fails `tsc`) with a German twin in `de.json`.
  Build zod schemas inside the component so validation messages follow the language. Dates use
  `formatDate()` which reads the current locale. Never concatenate translated fragments; use
  `{{placeholders}}`.

- **Dependencies**: pnpm refuses packages younger than 24h (`minimumReleaseAge` in
  `pnpm-workspace.yaml`). Ask the user before adding an exclusion. A package with a native
  build script needs an `allowBuilds` entry there or the install fails. TypeScript stays on 5.x
  (typescript-eslint and ts-jest do not support 7 yet).

## 5. Recipes

### Add a collection (e.g. `comments`)

1. `pnpm --filter server migrate:create "create_comments"` and fill it in, modelled on
   `server/pb_migrations/1757700000_create_posts.js`: fields, API rules, indexes, and the
   `created`/`updated` autodate fields. Write the down migration too. Rules per "Security rules"
   (section 4): owner or tenant on all five, ownership fields fixed on update, relations into the
   same owner or tenant; then a probe in `e2e/security.spec.ts` (a second user tries to read,
   change, move and reference the record).
2. Restart `pnpm dev` (migrations run on start), check the collection in the admin UI.
3. `pnpm typegen` to refresh `client/src/lib/pb-types.ts` and add the collection to
   `TypedPocketBase` if the generator did not.
4. Seeds: add data to `server/seed/data.ts` and upsert logic in `server/seed/index.ts`
   (idempotent: look up by a unique key, then update or create). Extend `seed/data.test.ts`.
5. Client: `lib/api/comments.ts` (+ test), `hooks/use-comments.ts`, UI.
6. Playwright spec covering the happy path with the seeded data. Update `e2e/fixtures.ts`.

Alternative for prototyping: change the schema in the admin UI; PocketBase writes the migration
file into `pb_migrations/` for you (automigrate). Review and commit it.

### Add a page

1. `client/src/routes/<name>.tsx` exporting `<Name>Page`; register it in `client/src/App.tsx`
   (inside `<ProtectedRoute />` if it needs auth). Branch on the query: `LoadingRegion` with a
   skeleton twin, `ErrorState` with `refetch`, `EmptyState`, then the content (see `routes/home.tsx`).
2. A list on the page follows "Every list view" in section 4: `useListParams`, a `ListToolbar`,
   `SortableHead` or a sort select, `ListPagination`, and a paged query in `lib/api/*.ts`
   (`getList`, see `listMyPostsPage`). Copy `routes/dashboard.tsx`.
3. Add nav in `components/site-header.tsx` if it is a top-level destination.
4. Unit test the page with `renderWithProviders` from `src/test/test-utils.tsx`, mocking hooks
   (`jest.mock("@/hooks/use-posts")`), see `routes/home.test.tsx`.
5. Add `data-testid` on interactive elements you will need in Playwright, and a row for the page
   in `e2e/loading.spec.ts` (path, API pattern, `<view>-loading`, content test id).

### Add an AI feature

1. Add a route in `services/ai/src/app.ts` (validate the body with zod, use `provider.complete`
   or `provider.stream`). The prompt is built in the route: the client sends only its data, never
   a system message or tool definitions, or the service becomes a free model on your bill. Cap
   input and `maxTokens`, put the body limit and the per-user limits (`chat`, `chatDaily`) in
   front. Model output is shown as text or Markdown without images (a reply could otherwise send
   data out in an image URL); tool results go back to the model as data, never as instructions,
   and tools that change or send things need the user's confirmation.
2. Test it in `services/ai/src/app.test.ts` with `createEchoProvider()`; no network in tests.
3. Add a client function in `client/src/lib/api/ai.ts` (+ test with mocked `fetch`).
4. The provider is chosen by `AI_PROVIDER` in `.env` (`auto` = the first of `MISTRAL_API_KEY`,
   `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` that is set; `ollama` = local models at `OLLAMA_URL`);
   the model by `MISTRAL_MODEL` / `OPENAI_MODEL` / `ANTHROPIC_MODEL` / `OLLAMA_MODEL`. One file per
   vendor in `services/ai/src/lib/` (`mistral.ts`, `openai.ts` also serves Ollama, `anthropic.ts`),
   untested on purpose; everything above them is provider-agnostic. Without a key the echo
   provider runs (dev, CI, e2e). Anthropic ignores `temperature` (not accepted by current models)
   and throws on a safety refusal.
5. The assistant page (`routes/assistant.tsx` + `components/assistant/`) is the reference chat:
   streamed Markdown replies (GitHub tables and task lists, LaTeX maths drawn by KaTeX, loaded the
   first time a reply has a formula; `assistant/markdown.ts` fixes what models write before it is
   rendered: `\( \)` maths, `<br>` in cells, tables sent as a code block), conversations saved in the `conversations` collection (new,
   rename, delete; `lib/api/conversations.ts`, private per user by API rule) and voice input.
   Voice is live dictation where the browser recognises speech (`assistant/use-dictation.ts`: on
   the device when it can, else the browser vendor's service; `CLOUD_DICTATION = false` keeps
   audio off it) and otherwise a recording for `POST /ai/transcribe` (Mistral Voxtral or OpenAI;
   Anthropic and Ollama borrow whichever of those has a key, `index.ts` wires it; otherwise
   `/ai/health` reports `transcription: false` and only dictating browsers get a mic). Keep that
   contract when you change the chat: the echo provider transcribes to "(echo) voice message",
   Playwright stubs the recognition (`fakeSpeech` in `e2e/assistant.spec.ts`) and uses a fake
   microphone (`playwright.config.ts`). Chat and voice routes are rate limited per user
   (`RATE_LIMITS`, on in production); tests pass `limits` to `createApp`.
6. Files (images, PDFs, text and code) are read in the browser by `lib/attachments.ts`: pdf.js
   extracts a PDF's text (`lib/pdf-text.ts`, loaded on first use), images are scaled to 1568 px
   (`lib/scale-image.ts`); both need a real browser, so Jest mocks them and Playwright covers
   them. Nothing is uploaded or stored: the content stays with the open chat and goes along with
   every turn within an allowance (`chatFiles`), the saved conversation keeps names only, and a
   reopened chat tells the model which files are gone. The service checks types, sizes and
   counts, puts text files in `<file>` blocks the system prompt declares as data, and hands
   images to each vendor in its own format. Word, Excel and scanned PDFs are not read (yet).

### Change the website _(web)_

- `web/` is a static Astro site on its own domain (`WEB_DOMAIN`, `example.com`) in front of the app
  (`DOMAIN`, `app.example.com`); its buttons lead to `<app>/login?tab=register` and `/login` via
  `web/src/lib/site.ts`. `pnpm dev` serves it on `WEB_PORT` (4321), linked to the local app. The
  website skill is the recipe for content (section 1).
- One component per section, with its copy next to it (`COPY: Record<Lang, ...>`); the languages
  and every page's path are in `web/src/i18n.ts` (sitemap and hreflang read it).
  English is at `/`, German under `/de/`, with the same pages.
- Name, claims and colours come from `corporate-identity/` (`pnpm brand` writes `web/public` and
  `web/src/styles/brand.css`).
- No JavaScript of its own and nothing from other origins: the site's CSP is stricter than the
  app's (no inline styles either). Colours through the roles in `web/src/styles/site.css`.
- Imprint and privacy page read `OPERATOR` in `web/src/lib/site.ts`; it holds placeholders until
  the user fills it in, and launching with them is not legal in the EU.
- `e2e/web.spec.ts` covers the site; `WEB_NOINDEX=true` keeps a tier out of search engines.

- Production: the web image builds the site and Caddy serves it from a second server block
  (`WEB_SITE` in `deploy/Caddyfile`), same deploy and tiers as the app; `e2e/edge` tests it.

### Add an MCP tool _(mcp)_

`services/mcp` is the app's MCP server (`<app>/mcp`, the official SDK). An agent gets in only
through OAuth: it registers itself or names a client metadata document (an https URL), sends the
user to `/connect`, the user ticks what it may do, and the agent receives tokens for this server
only (stored as hashes). Every tool runs as that user with a short PocketBase impersonation token,
so the API rules apply exactly as in the browser; the service never reads user data as superuser.
Settings lists connections and personal access tokens (Disconnect ends one at once) and the last
tool calls (`mcp_activity`, 90 days, never their content).

1. A tool is `defineTool({ name, title, description, scope, kind, input, run })` in
   `services/mcp/src/tools/<area>.ts`, listed in `TOOLS` (`tools/index.ts`). `scope` is the
   permission it needs; `kind` is `read`, `write` (counts against the daily cap per connection) or
   `delete` (destructive: agents ask the user first). `run(input, ctx)` uses only `ctx.records`,
   PocketBase as the user sees it, with filters through `ctx.records.filter()`.
2. A new area gets its scopes in `services/mcp/src/lib/scopes.ts`: read, write, and a separate
   scope that starts unticked (`OPT_IN_SCOPES`) for anything that deletes. Mirror them in `SCOPES`
   (`client/src/lib/api/mcp.ts`) and `useScopeLabels()` (`client/src/hooks/use-mcp.ts`) with the
   en/de strings. A missing scope answers 403 `insufficient_scope`, so the agent asks for it.
3. Results go to the agent as JSON data; nothing in them may read as an instruction. A tool that
   sends email, charges money or calls another service gets its own opt-in scope and a per-user
   cap (section 4). Throw `ToolError` for what the agent should read (not found, invalid data);
   any other error becomes "The tool failed" and is reported.
4. Test the tool in `tools/<area>.test.ts` with a fake `Records`, the protocol in `app.test.ts`
   through the official MCP client, and the flow in `e2e/mcp.spec.ts`.

### Add a form

1. Define a zod schema (inside the component when messages are translated); infer the values
   type from it.
2. `useForm({ resolver: zodResolver(schema), defaultValues })` and the shadcn `Form`,
   `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` components
   (see `routes/login.tsx` and `routes/dashboard.tsx`).
3. Submit through a React Query mutation with `mutateAsync`. On failure call
   `applyServerErrors(error, form.setError)` from `client/src/lib/form-errors.ts`: it maps
   PocketBase field errors onto the matching inputs and returns the message left over for a toast.
4. Put `data-testid` on the `<form>` and query fields by label in unit and e2e tests.

### Send an email

Every email leaves through `services/mailer`; the "Email" block in `.env.example` is the only
email configuration (`MAIL_PROVIDER`, `LETTERMINT_TOKEN`, `RESEND_API_KEY`, `SMTP_*`, `MAIL_FROM`).

- **Auth emails** (verify, password reset, email change, OTP) are rendered by PocketBase and
  handed to the mailer by the `onMailerSend` hook in `server/pb_hooks/mail.pb.js`; PocketBase's
  own SMTP client is never used. Nothing to code; customise the wording in the PocketBase admin
  (Settings → Mail settings) if needed.
- **App emails** go through `services/mailer` too: add a template in
  `services/mailer/src/lib/templates.ts` (zod schema + `render()` returning subject/text/html,
  escape everything user-provided), test it in `templates.test.ts`, then call `POST /mail/send` with
  `Authorization: Bearer <MAIL_INTERNAL_TOKEN>` and `{ to, template, data }` (or
  `{ to, subject, text, html }`). From PocketBase hooks use `$http.send` as `mail.pb.js` does;
  from Node services use `fetch`. The client never calls the mailer directly.
  Wording per language lives in `COPY` in `templates.ts`; pass `locale` in `data`.

Hooks take the mailer token from `server/pb_hooks/lib/internal-token.js` (it refuses the
placeholder in production) and check `res.statusCode` of every send. An email to an address that
is not verified yet carries no text the user chose (the welcome email waits for verification),
and anything a user can trigger for other addresses (invitations, shares) has a per-day cap.

Delivery is chosen by `MAIL_PROVIDER=auto`: Lettermint when `LETTERMINT_TOKEN` is set
(recommended, EU company, data stays in the EU, tracking off on every message), Resend when
`RESEND_API_KEY` is set (US company and storage), SMTP when `SMTP_HOST` is set, otherwise the local
outbox with no delivery. Links in auth mails are credentials: never turn on a provider's click
tracking. Mail to reserved domains (`example.com`, `.test`, `.invalid`, `.localhost`: the seed
users) is dropped before a real provider sees it, since it would only bounce; the outbox keeps it.
Nothing ever sends from the server itself. In development every email lands in the dev inbox at `/dev/mail` (a dev-only
page in the client that reads `/mail/outbox?to=&subject=`, proxied by Vite). Playwright uses
that API through `waitForMail()` and `tokenFromMail()` in `e2e/fixtures.ts`; see `e2e/mail.spec.ts`.

### Add a translation or a language _(i18n)_

- New string: add the key to `client/src/i18n/locales/en.json` **and** `de.json`, use
  `t("section.key")`. Interpolate with `{{name}}`; plurals with `key_one` / `key_other` and
  `{ count }`.
- New language: create `locales/<code>.json`, add it to `LOCALES` and `LOCALE_NAMES` in
  `client/src/i18n/index.ts`, to `LOCALES` in `services/mailer/src/lib/templates.ts` (+ `COPY`),
  and to the `locale` select in a new migration (values are validated by PocketBase).
- The user's choice is stored on `users.locale` and applied at login; emails use the same
  field (`mail.pb.js` passes it to the mailer).

### Add teams or organisations (only when asked)

Not included by default because it complicates every rule. When the user asks: a `teams`
collection, a `memberships` collection (`team`, `user`, `role`), an `invitations` collection
(email + token, sent through the mailer), a `team` relation on each scoped collection, and API
rules of the form
`@collection.memberships.team ?= team && @collection.memberships.user ?= @request.auth.id`.
Add a team switcher to the header, scope every query by the active team, seed one team with
Alice as owner and Bob as member, and cover invite + switch in a Playwright spec. Tenancy is where
apps built on this template had their worst holes: `team` and a membership's `user` are fixed
after create (`@request.body.team:isset = false` in every update rule), one hook per collection
refuses relations into another team, invitations get their token, expiry (14 days) and inviter
from the server, expire, re-check the plan on accept and compare emails lower-cased, and a
removed member's scheduled jobs stop or pass to the owner. Probe all of it with a second team in
`e2e/security.spec.ts`.

### Add a service

Copy `services/mailer/` (package.json, tsconfig\*, jest.config.mjs, tsup.config.ts, Dockerfile),
rename the package, choose a unique path prefix, add the proxy entry in `client/vite.config.ts`
and `deploy/Caddyfile`, and a service block in `docker-compose.yml`. `pnpm dev` picks it up
automatically. Verify user tokens with `lib/auth.ts`, accept a `reportError` dependency. Put a
`bodyLimit` on every route that reads a body, `lib/rate-limit.ts` (copy it from `services/ai`) on
routes that cost money, return fixed error texts from `onError`, refuse placeholder secrets in
production in `env.ts`, and give the Caddy `handle` a `request_body { max_size }`. Add the prefix
to `navigateFallbackDenylist` in `client/vite.config.ts` too, or the installed app's service
worker answers it with the app shell.

### Add a server-side hook

Create `server/pb_hooks/<topic>.pb.js`. A custom route calls `$apis.requireAuth()`, checks that
the caller may act on the record, and gets a rate-limit rule in `security.pb.js` if it sends mail
or checks a password. Shared helpers go in `server/pb_hooks/lib/` and are
loaded with `require(`${__hooks}/lib/x.js`)` inside the handler. Docs:
https://pocketbase.io/docs/js-overview/. Test the behaviour through Playwright or a seed +
SDK call; there is no Jest runtime for hooks.

## 6. Testing conventions

- **Jest** (`*.test.ts[x]` next to the code). Client uses jsdom + Testing Library; services and
  server use node. Mock modules with `jest.mock("@/lib/pocketbase")`; never hit the network.
  Coverage: `pnpm --filter client test:coverage`.
- **Playwright** (`e2e/*.spec.ts`). The `setup` project runs the seed script first, then
  `chromium`. `webServer` boots PocketBase, services and Vite, or reuses running ones locally.
  Use the `authedPage` fixture for signed-in flows and `SEED` constants for known data.
  Create unique records (timestamp in the title) so specs can run in parallel and repeatedly.
  Specs that need a real third-party account (a configured OAuth provider, a Plausible domain)
  skip with a message when the variable is missing and are the only allowed skips.
- Keep e2e specs about flows, not styling. Prefer role/label queries, fall back to `data-testid`.
- One spec file per feature area (`e2e/<feature>.spec.ts`). When you touch a feature, open its
  spec first and extend it; when you rename a label, route, or test id, update the spec in the
  same change. A feature without a passing spec is not finished.

## 7. Formatting and linting

Prettier is the formatter (`prettier.config.js`: 100 cols, double quotes, trailing commas, Tailwind class
sorting). ESLint (`eslint.config.js`) handles correctness only; it does not fight Prettier.
Editors: `.vscode/settings.json` formats on save. CI fails on unformatted code, so run
`pnpm format` before committing.

## 8. Environment and secrets

- `MAIL_INTERNAL_TOKEN` is a shared secret between PocketBase hooks, services and the mailer.
  Generate a real one for production (`openssl rand -hex 32`).
- Root `.env` (git-ignored) is the only env file. Add new variables to `.env.example` with a
  comment, to the service's `src/env.ts` (zod schema) or `client/src/lib/env.ts`, and to
  `docker-compose.yml` if production needs them.
- Only `VITE_*` variables reach the browser. Treat them as public.
- Keys never go into a tracked file, `.env.example` included: `pnpm check` runs
  `scripts/check-security.sh`, which fails on anything that looks like a Stripe, AI,
  email, cloud or git key in a tracked file (it prints file and line, not the key). Never paste
  a key into a chat either; a key that was pasted somewhere must be rolled.
- Deployed values: one env file per tier, `deploy/.env.dev`, `.env.stage`, `.env.prod`
  (git-ignored, from `deploy/.env.prod.example`), pushed as Fly secrets or uploaded as the
  server's `.env` on every deploy from a laptop.
  The website's `WEB_DOMAIN` and `WEB_NOINDEX` are build settings; CI reads them from the GitHub Environment's variables.

## 9. Deployment

`deploy/README.md` has the full guide; `pnpm deploy:prod` runs the target chosen in the wizard
(`vibe.config.json` → `features.deploy`). Every target uses the same images and the same Caddy
config. Tiers are `dev`, `stage` and `prod` everywhere (`DEPLOY_ENV`, `deploy/.env.<tier>`,
server paths or app names, GitHub Environments); `prod` is the default, `pnpm deploy:dev` deploys
dev. A project starts with local development and prod; dev (auto-deployed from `main` after green
CI once the repository variable `AUTO_DEPLOY_DEV` is `true`) and stage need nothing but their env
file, server and GitHub Environment. Do not add a tier unless asked.

- **Fly.io** _(fly)_: one Fly app per container (`deploy/fly/*.toml`), private IPv6 network
  between them, PocketBase on a volume. `pnpm deploy:prod --init` once, then `pnpm deploy:prod`.
  Without `DOMAIN` the app runs on `<name>-web.fly.dev`; app names are global, `FLY_APP_PREFIX`
  picks another prefix. Adding a service means a new `deploy/fly/<svc>.toml` (`dockerfile` is
  resolved from `deploy/fly/`, so `../../services/<svc>/Dockerfile`), an entry in `APPS` in
  `deploy/fly/deploy.sh`, and a `*_UPSTREAM` env in `deploy/fly/web.toml`.

Caddy terminates TLS (or serves plain HTTP behind Fly's edge) and routes `/api` to PocketBase,
each service prefix to its container, everything else to the static client with HSTS and a CSP.
The PocketBase admin UI (`/_/`), the superuser API and `/mail/*` answer 404 there: admins open
`http://localhost:8090/_/` through `fly proxy 8090:8090 -a <name>-pb` or
`ssh -L 8090:127.0.0.1:8090 deploy@<ip>`. Data persists in the `pb_data` volume; back it up via
the PocketBase admin (Settings → Backups).

The website goes out with the app: the web image builds `web/` and Caddy serves it on
`WEB_DOMAIN`, so `pnpm deploy:prod` deploys both and both domains need DNS records.

## 10. Git and workflow

- **Agents commit on their own, at sensible points.** Do not wait to be asked, and do not commit
  every edit. A commit is due when a coherent unit is done and `pnpm check` passes: a feature
  slice with its tests and docs, a migration together with the code that uses it, a refactor, a
  bug fix with its regression test. Never commit red checks, half-wired features or debug code;
  never commit `.env`, data or generated reports. Mention each commit in your summary.
- **Commit messages follow one grammar**, checked by `scripts/check-conventions.sh` (CI runs it
  on every pull request; run `scripts/check-conventions.sh subject "<text>"` to check yours):

  ```
  <type>(<scope>): <subject>        feat(client): add settings page
                                    fix(mailer): keep the text part of html-only mail
  <body: what changed and why>      chore(deps): pnpm 12, sentry 11
  <footer: Closes #12 / BREAKING CHANGE: ...>
  ```

  Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`, `revert`. Scopes
  (optional): `client`, `server`, `mailer`, `ai`, `billing`, `e2e`, `deploy`, `wizard`, `deps`,
  `release`, `ci`. Subject: imperative, starts lower case, no trailing period, at most 72
  characters. `feat` and `fix` get a body that says why. A schema or API-rule change that breaks
  existing data gets `!` after the type or a `BREAKING CHANGE:` footer. Bad: "Added settings
  page", "feat: Fix bug.", "update stuff".

- **Branching is the user's call, per project**, recorded in `vibe.config.json` → `branching`:
  `main` means commit directly to `main`; `branches` means every change starts on a branch
  named `<type>/<kebab-topic>` (`feat/settings-page`, `fix/reset-mail-42`; same types, at most
  40 characters) and ends in a pull request. Never commit to `main` on a `branches` project. If
  the field is missing, ask once and add it. Pushing and merging still happen only when the
  user asks.
- **Pull / merge requests** use the template (`.github/pull_request_template.md` on GitHub,
  `.gitlab/merge_request_templates/Default.md` on GitLab): title in the commit grammar, what and
  why, how to test, the checklist, out of scope. The repository squash-merges with the PR title
  as the commit (the wizard sets this up), so one PR becomes one well-formed commit and the
  release notes stay readable. The agent opens the PR; the user merges.
- **Git host and CLI**: `vibe.config.json` → `gitHost` (`github`, `gitlab`, `other`) says where
  the code lives, `gitCli` whether the host's CLI may be used. With `gitCli: true`: create repos,
  push branches and open PRs with `gh pr create --fill` (GitHub) or `glab mr create --fill`
  (GitLab), and read CI results with `gh run view` / `glab ci status`. With `gitCli: false` or
  host `other`: never call the CLI; push the branch and hand the user the compare URL plus the
  filled-in PR text to paste (GitHub: `https://github.com/<owner>/<repo>/compare/<branch>?expand=1`,
  GitLab: `https://<host>/<group>/<repo>/-/merge_requests/new?merge_request[source_branch]=<branch>`).
  Both modes are first-class; do not nag about installing a CLI in links mode.
- Never commit `.env`, `server/pb_data`, the PocketBase binary, or generated reports.
- Commit migrations generated by the admin UI together with the feature that needed them.
- **Every commit passes the security check.** `.githooks/pre-commit` (installed by `pnpm install`)
  runs `scripts/check-security.sh staged`: it blocks what a machine can see (keys, public API
  rules, raw HTML, interpolated filters, placeholder secrets, leaked error texts, missing body
  limits, root images, unpinned CI actions, a weakened Caddyfile) and then prints the security
  questions for the areas the commit touches. Read them and answer each for your change; fix what
  does not hold before committing, and mention a deliberate exception in the commit body. A line
  that is fine on purpose carries `security-allow: <reason>`. Never commit with `--no-verify`.
- CI (`.github/workflows/ci.yml` on GitHub, `.gitlab-ci.yml` on GitLab) runs the naming check on
  pull requests, then `pnpm check`, `pnpm build` and Playwright. Deploys are manual jobs there.

## 11. Gotchas

- `pnpm setup`, `pnpm deploy` and `pnpm issues` are pnpm built-ins, hence `pnpm bootstrap`, `pnpm deploy:prod`
  and `pnpm roadmap`.
- pnpm 12 is pinned in `package.json` (`packageManager`); older pnpm switches to it on its own.
  Deprecated transitive packages we cannot replace (glob via jest, prebuild-install via
  pocketbase-typegen, whatwg-encoding via jsdom) are listed under `allowedDeprecatedVersions` in
  `pnpm-workspace.yaml` so installs stay quiet; drop an entry once upstream moves on.
- Ports come from `.env` (`PB_PORT`, `CLIENT_PORT`, `MAIL_PORT`, ...). The wizard picks free ones
  when another project holds the defaults; `pnpm bootstrap` refuses a PocketBase on the configured
  port that is not this project's (admin login fails) instead of seeding a stranger's database.
- Node 24+ is required: root scripts are TypeScript run directly by Node (type stripping).
- Vite proxies `^/_/` (PocketBase admin) but not `/__vite*`; keep the regex if you edit it.
- PocketBase `expand: "author"` only works because the `users` viewRule is public
  (migration `1757700001`). Emails stay hidden unless `emailVisibility` is true.
- `pb.autoCancellation(false)` is set on purpose; React Query already dedupes requests.
- Jest compiles TS to CommonJS. The PocketBase SDK is ESM-only under jsdom (its CJS build lacks
  named exports such as `ClientResponseError`), so `client/jest.config.mjs` maps `pocketbase` to
  the ESM file and lets ts-jest transpile it via `transformIgnorePatterns`. Extend that pattern
  for any other package that fails with "Must use import to load ES Module".
  ESM-only packages must be mocked or kept out of tested modules: that is why services keep
  vendor SDK calls in small injected modules (`src/lib/<vendor>.ts`) that have no unit test.
- jsdom has no `Response`: stub `fetch` with `{ ok, status, json }` objects (see `api/*.test.ts`).
- Radix menus do not open on `userEvent.click` under jsdom; fire `keyDown` `Enter` on the trigger
  (see `components/language-switcher.test.tsx`).
- Logging out from a protected page: call `navigate("/")` before `logout()`. React Router v7
  navigates inside a transition, so `logout()` also clears the auth store inside
  `startTransition`; otherwise `ProtectedRoute` redirects to `/login` first.
- PocketBase JS hooks have no `onServe`; use `onBootstrap` and call `e.next()` first before
  touching the DB or settings (see `server/pb_hooks/mail.pb.js`). A syntax or reference error in
  any `*.pb.js` file silently disables every hook in that file: check the server log on start.
- React Router v8 exists but this template pins v7 (`react-router@^7`); upgrade deliberately.
- The production CSP allows scripts from this origin only: no inline `<script>`, no script tags
  from a CDN (the theme switch is `client/public/theme.js`; zod runs with `jitless`). A new
  vendor goes through a same-origin proxy in `deploy/Caddyfile`, or its origin into the CSP.
  `bash scripts/check-edge.sh` shows violations before production does.
- Rate limits and the trusted-proxy header are production-only (`security.pb.js`); development
  switches them off, even in a restored production backup.
- Deploy files are easy to break without noticing, which is why `scripts/check-deploy.sh` exists:
  flyctl reads `[build] dockerfile` relative to the config file, `http_service.checks` is a list
  (`[[...]]`), GitHub's `setup-flyctl` installs `flyctl` only (the script shims `fly`), macOS runs
  bash 3.2 (an empty array is unbound under `set -u`), and a feature's service in
  `docker-compose.yml` goes after the previous feature's closing marker, never inside its block.
- Two-factor sign-in is PocketBase's MFA (`mfa.rule` on `users`), which accepts any two different
  methods; `two-factor.pb.js` narrows it to the user's own second factor and refuses email codes as
  a sign-in on their own. Authenticator codes are SHA-1 TOTP from `pb_hooks/lib/totp.js` (the hook
  runtime has no SHA-1; Jest checks it against RFC 6238). Never switch on PocketBase's OTP login
  in the client: it is the email second factor only.

## 12. Agent tooling (skills, MCP)

UI work in this repo expects these tools. The setup wizard offers to install them; check at the
start of a session and install what is missing (the commands are safe to re-run):

| What                        | Purpose                                     | Install / verify                                                 |
| --------------------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| `interface-design` skill    | layout, spacing, typography, polish         | `npx skills add Dammyjay93/interface-design -y -a claude-code`   |
| `shadcn` skill (official)   | correct shadcn/ui component usage           | `npx skills add shadcn/ui -y -a claude-code`                     |
| Mobbin MCP (optional, paid) | real product screens and flows to reference | connect in Claude Desktop (Settings → Connectors), verify `/mcp` |

Claude Code specifics shipped in the repo: `.claude/settings.json` denies reads of generated and
runtime files (lockfile, `pb_data`, reports, `dist`) so exploration stays on source, and each
workspace has a `CLAUDE.md` that pulls in its README only when you work there. Installing the
TypeScript code-intelligence plugin (`/plugin`) turns "find usages" into a language-server lookup
instead of a file scan.

Replace `-a claude-code` with `-a cursor` / `-a codex` (or repeat the flag) for other agents;
`npx skills list` shows what is installed. Use the skills for any new page, component or visual
change; use Mobbin to look up how established products solve a flow before designing it, and
mention the reference in the PR. Do not commit installed third-party skill files unless the tool
documents that as intended; this repo's own skills (`.agents/skills/`, with a pointer in
`.claude/skills/` for Claude Code) are part of the code.

## 13. Shortcuts the user types

When a message is only one of these words, optionally with a number, answer with the list or
report below and nothing else: no fixes, no commits. Read issues through the git host's CLI
(`gh issue list --state open --limit 200 --json number,title,labels,milestone,createdAt`, or
`glab issue list` on GitLab). Without one (`gitCli: false` or host `other`), say so and list what
the repository itself records instead.

| The user types              | The answer                                                  |
| --------------------------- | ----------------------------------------------------------- |
| `issues` / `issues <n>`     | the `n` most urgent open issues (12 without a number)       |
| `bugs` / `bugs <n>`         | the same, bugs only                                         |
| `features` / `features <n>` | the same, features and ideas only                           |
| `report` / `status`         | a short report: repository, deployments, to-dos, top issues |

**Urgency**, most urgent first, with whatever labels the repository uses:

1. Blockers: `severity:blocker`, `priority:P0`, `incident`, `High Prio`, and anything that breaks
   production, sign-in, payments or data.
2. `priority:P1`, `severity:major`, and what a launch or the nearest milestone waits for
   (`go-live`).
3. `priority:P2`, `severity:minor`, bugs without a severity.
4. `priority:P3`, `severity:polish`.
5. `severity:idea`, and enhancements without a priority.

Within a level: bugs before features, then issues with a milestone, then the oldest. Epics and
tracking issues (`epic`) are left out; one line under the list says how many. A bug is an issue
labelled `bug` or `incident` (or classified as a bug in its body, as PrestoQA findings are); a
feature is any other issue that is not an epic.

**Lists are always numbered**, one line per issue:
`1. #84 Send quote by email — major · feature · 4 days old` (the title shortened to fit, the label
that decided its place, its type, its age). "Fix nr 3", "nr 3 and 5" or "close 2" refer to the
latest numbered list in the conversation. Start the work by naming the issue ("Nr 3 is #52: …");
without a list in the conversation, show one first.

**Report** (`report` or `status`), short, in this order:

1. Repository: branch, uncommitted changes, commits not pushed yet (`git log @{u}..`), the last
   few commits on the main branch, CI on its latest commit, open pull requests. When
   `strategy/04-requirements-roadmap.md` exists: the current phase, with its milestone's closed
   and open issues ("Phase 0 · Launch-ready: 9 of 24 shipped").
2. Deployed where: for every tier in section 9, the commit it runs and since when, read from the
   deploy workflow runs (`gh run list --workflow <file> --limit 3`) and the website deploy. A
   tier deployed by hand from a laptop is "unknown" unless the project records it somewhere;
   never deploy or log into a server just to find out.
3. To-dos: up to 8 things to do next, from this conversation and the repository: unpushed or
   uncommitted work, a red CI run or deploy, steps reported as not done, open items in this
   file's status notes, and every file in `references/` outside `done/`: one to-do per file,
   named, with the action it suggests (a screenshot of a bug becomes a fix or an issue, a design
   a page, a document a feature or a check).
4. Important issues: the 5 most urgent open issues, ranked as above.

To-dos and issues share one numbering (to-dos 1 to n, issues from n + 1), so every number in the
report means one thing.
