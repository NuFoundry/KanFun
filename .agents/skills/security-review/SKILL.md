---
name: security-review
description: Reviews this app's security and privacy before a launch and after big changes - API rules and tenancy, hooks and custom routes, the services, the client, the edge (Caddy, headers, CSP), CI and dependencies, secrets, and whether the privacy texts match the code. Probes the local stack with throwaway users, verifies every finding, fixes code bugs with a regression test, and writes docs/security-review-<date>.md. Use when the user says "review security", "is this safe to launch", "pentest", "check privacy/GDPR", before going live, or after adding collections, relations, routes, services or third-party vendors.
---

# Security review

Goal: before people trust the app with their data, find what lets one user see or change
another's data, abuse the app's resources or reputation, or reach a third party with personal
data, and fix what is code. The checklist is `docs/security-checklist.md`; this skill is how to
walk it so that every finding is real and every fix stays fixed.

Three reviews of apps built on this template found about 90 issues; most of the serious ones
were in code the app added, not in the template: relations into other tenants, update rules that
let a record move, client-writable server fields, races on limits, open relays. Spend the time
there.

## Ground rules

1. **Local stack only.** Probe `pnpm dev` (or an isolated copy) with throwaway users named
   `sec-review-<role>-<timestamp>@example.com`, and delete them afterwards. Against prod
   and stage send only unauthenticated, read-only requests (headers, 404 checks), never logins,
   writes or load.
2. **Never print a secret.** Report the file and line or the variable name, never the value.
   Comparing two secrets (dev vs prod) means comparing hashes or lengths.
3. **Every finding is verified twice**: once by reproducing it (a request that shows it, or a
   failing test), once by trying to refute it (a rule, hook or proxy that already stops it).
   Unverified points go to a separate list, never into the findings.
4. **Fix code with a test that failed before.** Tenancy and rule fixes get a probe in
   `e2e/security.spec.ts`; logic gets a unit test. Owner decisions (retention, plans, legal
   texts, dashboard settings) are listed, not decided.
5. **Nothing irreversible** without the user: no deploys, no key rotation, no history rewrite.

## 1. Map the attack surface (30 minutes)

- Collections and their five rules: read `server/pb_migrations/` in order, or dump them from the
  local admin API (`GET /api/collections` as superuser). Note every relation and which side owns
  the record (user, workspace, team).
- Custom routes: `grep -rn routerAdd server/pb_hooks`; record hooks: `onRecord*`.
- Service routes: `app.(get|post|put|patch|delete)` in `services/*/src/app.ts`.
- The edge: `deploy/Caddyfile`; what reaches the internet besides the client.
- Every third party the code talks to (grep for `https://` in services, hooks, client, Caddy).
- What leaves the browser: `track()` calls, Sentry, localStorage keys, anything on another origin.

## 2. Run the machines

```sh
pnpm check                         # includes scripts/check-security.sh all
pnpm test:e2e                      # e2e/security.spec.ts with the rest
bash scripts/check-edge.sh         # production Caddyfile in front of the built client
pnpm audit --prod
git log -p | grep -nE 'sk_live|rk_live|whsec_|xkeysib-|BEGIN [A-Z ]*PRIVATE KEY' | cut -d: -f1,2
```

A key in the history is a finding even when the file is gone: it must be rolled.

## 3. Probe tenancy and rules (most of the time goes here)

Create two owners in two tenants (A, B), a member of A without owner rights, and a stranger.
For every collection, as the member, the stranger and the owner of B:

- list, view, create, update, delete a record of A (expect empty or 404, never data);
- filter, sort and `expand` through relations into A (`filter=customer.email~"x"`): no oracle;
- update an own record so it **moves**: change `owner`/`user`/`workspace`/`team` to A's id;
- create or update an own record **referencing** A's records by id (every relation field), then
  call every custom route and service that reads that relation (exports, PDFs, emails, AI tools);
- set **server-owned fields** directly (numbers, dates, `createdBy`, status jumps, tokens,
  `verified`, plan, terms) on create and on update, multipart included;
- delete something a finalised or locked record points to, and check what the cascade did;
- remove a member, then check scheduled jobs, emails and realtime events they still receive;
- fire 10-20 **parallel** requests at every limit (quota, daily sends, numbering, imports).

Then every custom route and service route with foreign ids, missing auth, a member's token where
the owner is required, and bodies far over the limit.

## 4. Abuse, edge, supply chain, privacy

- **Abuse**: sign-up, login, reset and invitation flows without limits (rate rules in
  `server/pb_hooks/security.pb.js`); mail with user text to unverified addresses; anything billed
  per use without a per-user cap; dev-only routes or fake providers reachable when `NODE_ENV` is
  unset.
- **Edge**: `/_/`, `/api/collections/_superusers/*`, `/mail/*` answer 404 (also case and
  `%5f` variants); HSTS, CSP and Permissions-Policy present; no source maps; proxies to third
  parties pass only the paths they need, without cookies.
- **Supply chain**: actions pinned to SHAs, `permissions:` minimal, untrusted text through
  `env:`, production deploys only from `main`; base images supported; binaries checksummed;
  `minimumReleaseAge` intact.
- **Privacy**: list what each vendor receives and compare it with the privacy policy, the
  sub-processor list and in-app texts sentence by sentence; check that erasure reaches every copy
  (chat histories, exports, logs, undo lists, backups' retention).

## 5. Verify, fix, report

For each finding: reproduce, try to refute, rate (critical: cross-tenant data or money; high:
account takeover, admin exposure, unlimited abuse; medium; low; info). Fix code findings on a
branch with the regression test, run `pnpm check` and `pnpm test:e2e`, and commit per area.

Write `docs/security-review-<YYYY-MM-DD>.md`:

1. **Summary**: scope, method, the one-paragraph verdict (does tenant isolation hold?), counts.
2. **What you need to do**: owner steps in order (deploy, keys, dashboards, legal).
3. **Fixed**: one row per finding: severity, what, proof (test or request), fix, commit.
4. **Open**: findings that need a decision or an owner step, with the recommended fix.
5. **Checked and found safe**: what was tried and held, so the next review can skip or re-run it.
6. **Re-running the checks**: the commands above plus anything specific to this app.

Then extend `docs/security-checklist.md` with any rule the review taught that it does not have
yet, and `e2e/security.spec.ts` keeps the probes.
