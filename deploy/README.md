# Deploying

The same images run everywhere: `server/Dockerfile` (PocketBase), `services/*/Dockerfile`
(Node services) and `deploy/Dockerfile.web` (Caddy + static client). Caddy routes `/api`
to PocketBase and each service prefix to its container (`deploy/Caddyfile`, upstreams from env),
and keeps the PocketBase admin UI, the superuser API and the mailer off the internet.
`pnpm deploy:prod` runs the script of the target picked in the setup wizard
(`deploy/deploy.sh` dispatches).

Each tier has one env file, git-ignored: `deploy/.env.prod`, `deploy/.env.dev`,
`deploy/.env.stage`. Copy `deploy/.env.prod.example` for each, fill it in and keep it out of git.
Tiers are named `dev`, `stage` and `prod` everywhere: env files, `DEPLOY_ENV`, server paths or app
names, and GitHub Environments.

## Environments

You start with local development (`pnpm dev`, seeded data, offline stand-ins, CI running the full
Playwright suite on every change) and `prod`. Two more tiers are there when you need them:

- **dev** follows `main`: a server (or Fly apps) where every change that passed CI lands on its own.
  Create `deploy/.env.dev` with its own domain, admin password and keys (Stripe test keys, a
  separate sending domain), deploy it once with `pnpm deploy:dev` (`--init` on Fly.io), create a
  `dev` GitHub Environment with the tier's secrets and set the repository variable
  `AUTO_DEPLOY_DEV` to `true`. From then on the Deploy workflow deploys every push to `main`
  whose CI run succeeded, exactly the commit CI tested.
- **stage** is for showing a build before release, rehearsing a migration on a copy of real data
  or testing Stripe webhooks on a public URL: `deploy/.env.stage`, then
  `DEPLOY_ENV=stage pnpm deploy:prod`, and a `stage` GitHub Environment.
- **prod** is deployed by hand: `pnpm deploy:prod` from a laptop, or the Deploy workflow with
  `prod` picked (only from `main`; add required reviewers on the `prod` Environment for a gate).

On Fly.io a tier other than prod gets apps named `<name>-<tier>-*` with their own volume and
secrets; on Hetzner its own small server (Caddy needs ports 80/443) and `/opt/<name>-<tier>`.
Nothing in the code knows the tier: the same images, migrations and seeds run in each, only the
env file differs.

## Fly.io

One Fly app per container (`<name>-pb`, `<name>-web`, `<name>-mailer`

, `<name>-ai`

) in one organisation, talking over Fly's private IPv6 network (`<app>.internal`). PocketBase
keeps its SQLite database and uploads on a Fly volume; Fly terminates TLS and gives you anycast
IPs. Expect roughly $5-15/month for the smallest machines.

### 1. First deploy

```sh
brew install flyctl && fly auth login          # https://fly.io/docs/flyctl/install/
cp deploy/.env.prod.example deploy/.env.prod   # DOMAIN, PB_ADMIN_*, keys
pnpm deploy:prod --init                        # creates the apps, pushes secrets, deploys
```

- No domain yet? Leave `DOMAIN` empty: the app runs on `https://<name>-web.fly.dev`, and every
  link, CORS origin and the MCP issuer follow. Set `DOMAIN` and run `--init` again once you have one.
- With `DOMAIN` set, `--init` prints the web app's IPs: create an `A` and `AAAA` record pointing at
  them and Fly issues the certificate (`fly certs show <domain> -a <name>-web`).
- App names are unique across all of Fly.io. "Name has already been taken" means someone else has
  `<name>-pb`: choose a prefix with `FLY_APP_PREFIX=<prefix> pnpm deploy:prod --init` (the apps are
  then `<prefix>-pb` and so on). Organisation: `FLY_ORG=<slug>`. Region: `primary_region` in
  `deploy/fly/*.toml` (`fly platform regions`).
- `--init` can run again after a failure; it skips what exists. The first deploy of `<name>-pb`
  creates the `pb_data` volume next to its machine. Should a deploy ever say "insufficient
  resources to create new machine with existing volume", that host is full: create a second empty
  volume (`fly volumes create pb_data -a <name>-pb --size 1 --yes`), deploy again, and destroy the
  one left unattached (`fly volumes list -a <name>-pb`).
- `scripts/check-deploy.sh` checks the Fly configs, the Dockerfiles and the Compose file in
  `pnpm check`, and CI builds every image, so a broken deploy file fails a pull request, not the
  deploy.

### 2. Every release

```sh
pnpm deploy:prod                 # deploys every app (secrets unchanged)
pnpm deploy:prod --secrets       # after editing deploy/.env.prod
```

Or run the **Deploy (Fly.io)** GitHub Action (`.github/workflows/deploy-fly.yml`) with the
`FLY_API_TOKEN` secret: an expiring organisation token (`fly tokens create org <org> -x 2160h`,
90 days, then renew), one per GitHub Environment. Keep prod in its own Fly organisation
(`FLY_ORG`) so a dev token never reaches it, and protect the `prod` Environment (required
reviewer). With `AUTO_DEPLOY_DEV=true` the workflow deploys dev after every green CI run on
`main` (see Environments). On GitLab the same deploy is the manual `deploy:fly` job in
`.gitlab-ci.yml`; put `FLY_API_TOKEN` in Settings → CI/CD → Variables (masked, scoped to the
environment) and run the job from the pipeline on `main`.

### 3. Operate

```sh
fly logs -a <name>-pb                          # logs (any app)
fly ssh console -a <name>-pb                   # shell inside PocketBase
fly ssh console -a <name>-pb -C "/pb/pocketbase superuser upsert you@x.com 'newpass' --dir=/pb/pb_data"
fly volumes list -a <name>-pb                  # the pb_data volume
fly scale memory 1024 -a <name>-pb             # more RAM
```

- Admin UI: not on the internet. `fly proxy 8090:8090 -a <name>-pb`, then
  `http://localhost:8090/_/`.
- Backups: PocketBase admin → Settings → Backups (store them on S3-compatible storage such as
  Tigris, which Fly offers) or `fly volumes snapshots list -a <name>-pb` for volume snapshots.
- Files are on the volume; for many uploads switch PocketBase to S3 (Settings → Files storage).
- Upgrades: bump `server/.pocketbase-version`, replace `server/.pocketbase-checksums` with the
  release's `checksums.txt`, then `pnpm deploy:prod`. Watch PocketBase's release notes: security
  fixes are announced only there.

## Email

One setting covers every email, PocketBase's verification and reset mails included: the mailer
service delivers them all, nothing is sent from the server itself. Pick one provider in
`deploy/.env.prod`:

| Provider             | Variable           | Data location                                | Notes                                                     |
| -------------------- | ------------------ | -------------------------------------------- | --------------------------------------------------------- |
| Lettermint (default) | `LETTERMINT_TOKEN` | EU (Dutch company, own servers in the EU)    | open and click tracking off on every message              |
| Resend               | `RESEND_API_KEY`   | US, under DPA + Standard Contractual Clauses | US company; turn click tracking off for the domain        |
| Any SMTP relay       | `SMTP_*`           | depends on the relay                         | Postmark, Mailgun, SES; port 587 (25 is blocked on VPSes) |

Link tracking matters: a password-reset link is a password. A provider that rewrites links for
click tracking sends it through its own domain first. The mailer turns Lettermint's tracking off
on every message (`X-LM-Override-Track-Opens/Clicks: false`); with Resend, leave click and open
tracking off in the domain's settings.

**Lettermint:** sign up at lettermint.co and accept its DPA (lettermint.co/dpa). Create one
project per tier with SMTP enabled, add the `MAIL_FROM` domain to it, and copy its DNS records
(two DKIM CNAMEs, the return-path CNAME, which also covers SPF, and a DMARC record; on Cloudflare
as **DNS only**). The project's API token is `LETTERMINT_TOKEN`; the mailer uses Lettermint's SMTP
relay (`smtp.lettermint.co`, STARTTLS on 587). Lettermint keeps message content and metadata 28
days; say so in the privacy policy.

Before the first real send:

1. Verify the `MAIL_FROM` domain at the provider and add the SPF, DKIM and DMARC DNS records it
   gives you. Without them mail is refused or lands in spam, whatever the provider.
2. Set a real `MAIL_INTERNAL_TOKEN` (`openssl rand -hex 32`).
3. After deploying, the mailer's start-up log must name your provider, not `outbox` (which means
   no key was set and nothing is delivered): `fly logs -a <name>-mailer` or
   `docker compose logs mailer`. The mailer is internal; `https://<domain>/mail/*` answers 404.

## Security after every deploy

`docs/security-checklist.md` lists everything a production app has to satisfy. After a deploy,
check what only production shows:

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/_/                 # 404
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/mail/health        # 404
curl -sI https://<domain>/ | grep -i -E 'strict-transport|content-security'  # both present
```

PocketBase logs `[security] trusted proxy header and rate limits are on` at start; without it,
`NODE_ENV` is not `production` there. Every service refuses to start in production with a
placeholder secret (`MAIL_INTERNAL_TOKEN`, `PB_ADMIN_PASSWORD`): a crash loop right after the
first deploy usually means one is missing. Keep env files on servers at `chmod 600`.
