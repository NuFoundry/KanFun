# Security checklist

A reference for the coding agent. AGENTS.md ("Security rules") says what to do while building;
this list is what a finished app has to satisfy, and why. The security-review skill
(`.agents/skills/security-review`) walks it before a launch and after big changes; the
pre-commit hook (`scripts/check-security.sh`) checks what a machine can and asks the rest for the
areas each commit touches.

It was written from three pre-launch security reviews of production apps built on this template
(a CRM, a bookkeeping app and an invoicing app, about 90 findings). Each "Why" is what happened
there. The template now ships the fixes for everything that was its own; what remains are rules
for the code an app adds.

Each item names who does it: **agent** (code, tests, config) or **owner** (accounts, dashboards,
decisions, anything legal). **Guard** names the test or check that fails when the rule breaks.

## What the reviews found most

- Records referenced records of another tenant: a relation accepted any id, and a hook then read
  or changed the foreign record with full rights (customer data leaked into an export; another
  business's invoice was cancelled).
- An update rule was checked against the stored record only, so one request could move a
  membership into another business, which the attacker then owned.
- Fields only the server should set (numbers, dates, "finalised by", tokens, terms acceptance)
  were writable by the client.
- No rate limits anywhere, the admin UI on the internet, and the AI service an open model proxy
  on the app's bill.
- Limits (plan quotas, daily sends, numbering) were counted outside a transaction and raced.
- Personal data reached third parties through URLs: search text and record ids in analytics,
  breadcrumbs and session replays.

## 1. Data and API rules

- [ ] **agent** Every collection has all five rules, each limiting records to their owner or
      tenant. Public (`""`) only for public content, with `// security-allow: <why>`.
      Why: profiles were readable by any account by id. Guard: `check-security.sh` (public rules).
- [ ] **agent** An update rule cannot move the record: owner, user, workspace and other ownership
      fields carry `(@request.body.<f>:isset = false || @request.body.<f> = <f>)`.
      Why: an owner moved their membership into another business. Guard: `e2e/security.spec.ts`.
- [ ] **agent** Every relation accepts only records of the same owner or tenant, checked in a
      hook (one shared check per collection) or a rule on the target. PocketBase applies no rule
      to relation targets. Why: a credit note cancelled another workspace's invoice.
- [ ] **agent** Hooks that read with full rights (`findRecordById` and friends) check that the
      caller may see the record first. Why: a change log printed other tenants' names.
- [ ] **agent** Fields only the server sets (numbers, timestamps, `createdBy`, tokens, terms,
      plan, type) are reset to their stored value in `onRecordCreateRequest`/`onRecordUpdateRequest`
      for non-superusers, and status changes with consequences go through a route. Why: forged
      "finalised" invoices with back-dated numbers; a template turned into a quote past the quota.
- [ ] **agent** A setting the UI offers to owners only is enforced in the rule or hook as well.
      Why: members changed the owner-only number formats by writing the record directly.
- [ ] **agent** Fields only some roles may see (cost prices, internal notes) live in their own
      collection with its own rules; PocketBase cannot hide a field per role.
- [ ] **agent** Data a privileged action replays later (undo lists, imports, queued jobs) is
      validated when it is written and again when it runs. Why: an undo ran with an admin's
      session over data any writer could edit.
- [ ] **agent** Documents kept as a record (PDFs, exports, hashes, e-invoices) are built on the
      server from stored data, never from what the request sent.
- [ ] **agent** A deleted or departed member loses everything at once: jobs they created stop or
      pass to the owner, nothing is mailed to them. Why: a removed member kept receiving invoices.
- [ ] **agent** `users.deleteRule` stays `null`; deleting an account is a route that re-checks the
      password, cancels the subscription and cleans up. Why: a self-delete left a paid plan
      running and an orphaned workspace. Guard: `check-security.sh`, `e2e/security.spec.ts`.
- [ ] **agent** Files with personal data are `protected: true` (served with a file token).
- [ ] **agent** Records that must survive (invoices under retention, audit logs) are not deleted
      by a cascade from a parent; deletion is refused or soft. Why: deleting a workspace removed
      finalised invoices that tax law requires to keep.
- [ ] **agent** Emails are compared lower-cased (invitations, look-ups). Why: invitations to a
      capitalised address were invisible to the invitee.
- [ ] **agent** Every new collection, relation and custom route gets a probe in
      `e2e/security.spec.ts`: a second user tries to read, change, move and reference it.

## 2. Abuse

- [ ] **agent** Rate limits stay on in production (`server/pb_hooks/security.pb.js`); a custom
      route that sends mail, creates many records or checks a password gets its own rule there.
      Why: unlimited password guessing and mail bombing through the app.
- [ ] **agent** Two-factor sign-in (`server/pb_hooks/two-factor.pb.js`) keeps its guards: turning
      it on or off and new recovery codes need the current password, its fields are hidden and put
      back in `onRecordUpdateRequest`, only the user's own second factor completes a sign-in
      (PocketBase accepts any two methods), a code works once, and five wrong ones end the pending
      sign-in. Otherwise a stolen session removes the second factor, or an email code or a Google
      sign-in stands in for the authenticator app.
- [ ] **agent** A limit (plan quota, daily sends, numbering, seats) is counted and checked inside
      one transaction, or reserved before the slow work. Why: parallel requests used six numbers
      and exceeded quotas.
- [ ] **agent** Mail to an address the caller chose carries no text the caller chose until that
      address is verified, and is capped per request and per day, counting recipients, not sends.
      User-chosen sender names are cut short and keep the app's suffix ("Name via App"). Why:
      invitations and welcome emails became a phishing relay from the app's domain.
- [ ] **agent** Expensive work (PDF rendering, OCR, imports) has a per-user concurrency limit, so
      one account cannot hold every slot.
- [ ] **agent** Money: plan access follows what the payment provider reports for a paid period,
      never a status the app writes after its own API call; pause, resume, trial and discount
      flows are tested with a Stripe test clock (`docs/stripe-checklist.md`). Why: pausing just
      before renewal and resuming after it gave a paid plan for free.
- [ ] **owner** Decide whether unverified accounts may use what costs money or sends mail
      (`authRule = "verified = true"` or a check in those routes).
- [ ] **agent** Invitations: token, expiry and inviter are set by the server, they expire, the
      plan is re-checked on accept, and re-sending has a cooldown.
- [ ] **agent** Anything billed per use (AI, OCR, SMS) has a per-user daily cap and, where it
      makes sense, a plan gate. Why: unmetered model calls for any free account.
- [ ] **owner** A spending limit at every paid API (AI provider, email), and separate keys for
      dev and production.

## 3. Services

- [ ] **agent** Every route verifies the PocketBase token (`requireAuth`) unless it is a webhook
      with its own signature check.
- [ ] **agent** Every route that takes a body limits it before reading (`hono/body-limit`); the
      edge limits each prefix too. Why: 150 MB posts exhausted 256 MB machines.
      Guard: `check-security.sh`, service tests, `e2e/edge`.
- [ ] **agent** Nothing the client sends is trusted beyond its own data: no user ids of others,
      no prices, no redirect targets off the app's origin, no system prompts or tool definitions.
      Why: a fake checkout took the user id from a form and granted any user a paid plan.
- [ ] **agent** AI routes build their prompt on the server, cap input and output, and treat tool
      results and attached files as data, never instructions; tools that change or send things
      need the user's confirmation. Model output is rendered as text or Markdown without images
      or raw HTML.
      Why: a model reply could carry data out in an image URL.
- [ ] **agent** Errors reach the client as fixed text; vendor messages stay in the log and the
      error report. Guard: `check-security.sh`, service tests.
- [ ] **agent** Public health routes say only what a client needs (no versions, models, counts).
- [ ] **agent** Development-only routes are enabled by an explicit flag, never by "not
      production". Why: dev routes that sent real email were one missing variable away from the
      internet.
- [ ] **agent** Internal tokens are compared in constant time (`timingSafeEqual`, `$security.equal`).
- [ ] **agent** Inbound webhooks verify a signature or token before reading anything; inbound mail
      trusts a sender only when SPF, DKIM or DMARC passed. Why: forged `From` headers placed fake
      receipts in a review queue.
- [ ] **agent** A headless browser that renders user input runs a current version with its sandbox
      on, JavaScript off and an allow-list for requests.
- [ ] **agent** A proxy to a third party strips the visitor's headers it does not need upstream
      (cookies, referer, IP) and `Set-Cookie`, `NEL`, `Report-To` downstream. Why: an exchange-rate
      proxy made browsers report every failed app request to a CDN.
- [ ] **agent** Access for outside agents (an MCP server, API tokens) runs with the user's own
      rights (a short impersonation token, never the superuser's), accepts only tokens it issued for
      itself (stored hashed, revocable, refresh tokens rotated and a reused one ending the
      connection), and asks the user per permission, with anything that deletes or sends opt-in.
      Guard: `services/mcp` tests, `e2e/security.spec.ts`.
- [ ] **agent** A server-side fetch of a URL someone else chose (an OAuth client document, a link
      preview, a webhook target) allows https only, checks the resolved address at connect time
      against private and link-local ranges, follows no redirects and caps size and time.
- [ ] **owner** Services that need PocketBase superuser access get their own superuser account,
      so the human one can have MFA.

## 4. Browser

- [ ] **agent** User and model text is rendered as text. No `dangerouslySetInnerHTML`,
      `innerHTML`, `eval`, `rehype-raw`; Markdown without images. Guard: `check-security.sh`.
- [ ] **agent** Links built from data allow `http(s)` (and plain `mailto:`) only.
- [ ] **agent** PocketBase filters with user input go through `pb.filter()`. Guard:
      `check-security.sh`.
- [ ] **agent** CSV exports prefix cells starting with `= + - @` (tab, CR) with `'`. Why: a
      `=HYPERLINK()` from a contact ran in Excel.
- [ ] **agent** Logout (or another user signing in) clears the query cache and anything else held
      in memory. Guard: `lib/auth-context.test.tsx`.
- [ ] **agent** HTML generated from user data is shown in a sandboxed iframe (`sandbox=""` with
      `srcdoc`), never as a `blob:` or `data:` page on the app's origin.
- [ ] **agent** A link in an email that changes state (unsubscribe, confirm) opens a page that
      asks before it acts; mail gateways open links to scan them.
- [ ] **agent** Nothing loads from another origin: scripts and analytics go through this origin
      (`/pl`, `/ph`), so the CSP stays `script-src 'self'`. Guard: `e2e/edge` (no CSP violation on
      any page).

## 5. Privacy

- [ ] **agent** Analytics and error reports get no personal data: users by id only, URLs through
      `redactUrl()` (no query, ids and tokens replaced), no autocapture, no session replay, no
      console breadcrumbs. Why: search terms with customer names and reset tokens in third-party
      dashboards. Guard: unit tests in `lib/analytics`, `lib/monitoring`, `lib/redact-url`.
- [ ] **agent** Nothing goes to `localStorage` that is not strictly needed (consent otherwise).
- [ ] **agent** Copies of personal data (chat histories, exports, logs, undo lists) are deleted
      with the record they came from, so an erasure request can be honoured.
- [ ] **owner** The privacy policy, the sub-processor list and in-app texts match what the code
      does: every vendor that receives data (hosting, email, AI, analytics, errors, backups, CDN,
      the browser's speech service when the assistant dictates through it), every storage key,
      retention including backups. Why: three apps promised things the code did not do ("data
      never leaves the EU", "everything in the export").
- [ ] **owner** AI provider: training opt-out confirmed, retention known (zero retention where
      offered), the provider listed as a processor.

## 6. Edge and deployment

- [ ] **agent** `deploy/Caddyfile` keeps the PocketBase admin UI, the superuser API and the mailer
      off the internet, sets HSTS, Permissions-Policy and the CSP, limits bodies, and proxies
      third parties path by path without cookies. Auth emails link to the app's own pages
      (`/auth/confirm-*`). Guard: `check-security.sh`, `e2e/edge` (`scripts/check-edge.sh`).
- [ ] **agent** Images run as an unprivileged user, base images are supported versions, binaries
      are checked against committed checksums, `.dockerignore` keeps secrets and data out of the
      build context. Source maps are not served.
- [ ] **owner** Admin access to PocketBase through an SSH tunnel or `fly proxy` only; a long,
      random superuser password; MFA once no service uses the human account.
- [ ] **owner** A dev or stage tier on the internet has its own keys (test mode, outbox or a
      separate sending domain), never prod's, and preferably basic auth in front.
- [ ] **owner** Backups off the server, encrypted, and restored once as a drill. They hold
      password hashes and the token signing key: restrict the bucket to this one access key.
- [ ] **owner** SPF, DKIM and DMARC for the sending domain, DMARC raised from `p=none` to
      `quarantine` once reports show only legitimate senders; dev sends from its own domain or not
      at all.
- [ ] **owner** Production on its own Fly organisation or server; deploy tokens expire.

## 7. Supply chain

- [ ] **agent** GitHub Actions pinned to commit SHAs (Dependabot keeps them current), a top-level
      `permissions: contents: read` in every workflow, untrusted text (PR titles, branch names)
      passed through `env:`.
      Why: a PR title was pasted into a shell script in CI. Guard: `check-security.sh`.
- [ ] **agent** pnpm's `minimumReleaseAge` stays; new packages are needed, maintained and
      reviewed; tools run from the lockfile, never `npx <tool>@latest` in a job with secrets.
- [ ] **owner** Production deploys from `main` only, through a protected environment (required
      reviewer) or from a laptop; repository secrets that are no longer used are deleted.
- [ ] **agent** `pnpm audit --prod` is clean before a release; the PocketBase version is current
      (security fixes appear only in its release notes).

## 8. Secrets

- [ ] **agent** No secret has a working default in production: services and hooks refuse to start
      (or to send) with a missing, short or placeholder value. Why: a token that ships in the
      repository signed unsubscribe links and authorised mail. Guard: env tests, `check-security.sh`.
- [ ] **agent** Keys never sit in a tracked file (`.env.example` included) and never in `VITE_*`.
      Guard: `check-security.sh`.
- [ ] **owner** A key that was ever pasted into a chat, an issue or a commit is rolled.
- [ ] **owner** Env files on servers are `chmod 600`.

## Re-running the checks

```sh
pnpm check                      # includes scripts/check-security.sh all
pnpm test:e2e                   # e2e/security.spec.ts among the rest
bash scripts/check-edge.sh      # the production Caddyfile in front of the built client
pnpm audit --prod
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/_/              # 404
curl -sI https://<domain>/ | grep -i -E 'strict-transport|content-security'
```
