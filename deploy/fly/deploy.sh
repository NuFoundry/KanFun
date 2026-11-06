#!/usr/bin/env bash
# Deploy to Fly.io: one Fly app per container, talking over Fly's private network.
#
#   pnpm deploy:prod             build and deploy every app (needs `fly auth login`)
#   pnpm deploy:prod --init      first time: create the apps, push secrets, deploy, add the cert
#   pnpm deploy:prod --secrets   push secrets from the env file again, then deploy
#   pnpm deploy:dev [...]        the same for the dev tier
#
# Tiers (DEPLOY_ENV): prod (default) uses apps `<name>-*` and deploy/.env.prod; dev and stage use
# `<name>-dev-*` / `<name>-stage-*` and deploy/.env.dev / .env.stage (each with its own volume,
# secrets and domain). Also: FLY_ORG (personal), FLY_ENV_FILE (another file), FLY_APP_PREFIX
# (app names are unique across all of Fly; `<prefix>-pb` and so on). The region is
# `primary_region` in deploy/fly/*.toml (fra).
# Without DOMAIN in the env file the app runs on https://<prefix>-web.fly.dev; `--init` is safe
# to run again after a failure (it skips what exists).
# Install flyctl: https://fly.io/docs/flyctl/install/
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

DEPLOY_ENV="${DEPLOY_ENV:-prod}"
PREFIX="${FLY_APP_PREFIX:-kan-fun}"
[ "$DEPLOY_ENV" != "prod" ] && PREFIX="$PREFIX-$DEPLOY_ENV"
ORG="${FLY_ORG:-personal}"
ENV_FILE="${FLY_ENV_FILE:-deploy/.env.$DEPLOY_ENV}"
INIT=0
SECRETS=0
for arg in "$@"; do
  case "$arg" in
    --init) INIT=1; SECRETS=1 ;;
    --secrets) SECRETS=1 ;;
    *) echo "unknown option $arg" >&2; exit 2 ;;
  esac
done

# GitHub's setup-flyctl action installs `flyctl` only; the install script gives both names.
if ! command -v fly >/dev/null; then
  command -v flyctl >/dev/null || { echo "✖ flyctl not found: https://fly.io/docs/flyctl/install/" >&2; exit 1; }
  fly() { flyctl "$@"; }
fi

# Private apps first, the public web app last.
APPS=(pb mailer)
APPS+=(ai)
APPS+=(mcp)
APPS+=(web)

# Services refuse a placeholder secret in production, which shows as a crash loop after the first
# deploy; say so before anything is built.
refuse_placeholders() {
  local name value
  for name in PB_ADMIN_PASSWORD MAIL_INTERNAL_TOKEN; do
    value="${!name:-}"
    case "$value" in
      "" | *replace-with* | *change-me* | *changeme* | *example*) ;;
      *) [ ${#value} -ge 16 ] && continue ;;
    esac
    echo "✖ $name in $ENV_FILE is missing, short or a placeholder: set a random one (openssl rand -hex 32)" >&2
    exit 1
  done
}

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  [ "$SECRETS" = 1 ] && refuse_placeholders
elif [ "$SECRETS" = 1 ]; then
  echo "✖ $ENV_FILE missing. Copy deploy/.env.prod.example to $ENV_FILE and fill it in." >&2
  exit 1
fi
# Without a custom domain the app lives on Fly's hostname: every link, CORS origin and the MCP
# issuer follow it, and no certificate is needed.
CUSTOM_DOMAIN="${DOMAIN:-}"
DOMAIN="${CUSTOM_DOMAIN:-$PREFIX-web.fly.dev}"
APP_URL="https://$DOMAIN"
# The website is served by the web app too, on its own domain (deploy/Caddyfile).
WEB_DOMAIN="${WEB_DOMAIN:?Set WEB_DOMAIN (the website, e.g. example.com) in $ENV_FILE}"

# Which variables each app needs (only non-empty ones are pushed).
secret_names() {
  case "$1" in
    pb) echo PB_ADMIN_EMAIL PB_ADMIN_PASSWORD APP_NAME APP_URL MAIL_FROM MAIL_INTERNAL_TOKEN RATE_LIMITS \
      OAUTH_GOOGLE_CLIENT_ID OAUTH_GOOGLE_CLIENT_SECRET OAUTH_GITHUB_CLIENT_ID OAUTH_GITHUB_CLIENT_SECRET \
      OAUTH_APPLE_CLIENT_ID OAUTH_APPLE_CLIENT_SECRET OAUTH_MICROSOFT_CLIENT_ID OAUTH_MICROSOFT_CLIENT_SECRET \
      OAUTH_MICROSOFT_TENANT ;;
    mailer) echo APP_NAME APP_URL MAIL_FROM MAIL_INTERNAL_TOKEN MAIL_PROVIDER LETTERMINT_TOKEN RESEND_API_KEY \
      SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_SECURE SENTRY_DSN ;;
    ai) echo APP_NAME AI_PROVIDER MISTRAL_API_KEY MISTRAL_MODEL MISTRAL_TRANSCRIPTION_MODEL OPENAI_API_KEY \
      OPENAI_MODEL OPENAI_TRANSCRIPTION_MODEL ANTHROPIC_API_KEY ANTHROPIC_MODEL OLLAMA_URL \
      OLLAMA_MODEL RATE_LIMITS SENTRY_DSN ;;
    billing) echo APP_URL PB_ADMIN_EMAIL PB_ADMIN_PASSWORD RATE_LIMITS STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET \
      STRIPE_PRICE_PRO STRIPE_AUTOMATIC_TAX STRIPE_TAX_ID_COLLECTION STRIPE_BILLING_ADDRESS \
      STRIPE_MANAGED_PAYMENTS SENTRY_DSN ;;
    pdf) echo RATE_LIMITS SENTRY_DSN ;;
    mcp) echo APP_URL APP_NAME PB_ADMIN_EMAIL PB_ADMIN_PASSWORD RATE_LIMITS SENTRY_DSN ;;
    web) echo ;;
  esac
}

push_secrets() {
  local app="$1" pairs=()
  for name in $(secret_names "$app"); do
    local value="${!name:-}"
    [ -n "$value" ] && pairs+=("$name=$value")
  done
  # Services only accept the browser origin, which is the web app's domain.
  case "$app" in ai | billing | pdf | mcp) pairs+=("CORS_ORIGINS=$APP_URL") ;; esac
  [ ${#pairs[@]} -eq 0 ] && return 0
  echo "▶ Secrets for $PREFIX-$app: ${#pairs[@]} values"
  fly secrets set --stage -a "$PREFIX-$app" "${pairs[@]}" >/dev/null
}

if [ "$INIT" = 1 ]; then
  for app in "${APPS[@]}"; do
    # Asked per app: the `apps list` table is indented and differs between flyctl versions.
    fly status -a "$PREFIX-$app" >/dev/null 2>&1 ||
      fly apps create "$PREFIX-$app" --org "$ORG"
  done
  # The volume (`[[mounts]]` in pb.toml) is created by the first `fly deploy`, on the host that
  # also fits the machine; a volume created ahead of time can land on one that no longer does.
fi

# Private hostnames follow the app prefix, so dev and stage never talk to prod.
internal_env() {
  case "$1" in
    pb) echo "--env" "MAIL_URL=http://$PREFIX-mailer.internal:8788" ;;
    ai | billing | pdf | mcp) echo "--env" "POCKETBASE_URL=http://$PREFIX-pb.internal:8090" ;;
    web) echo "--env" "PB_UPSTREAM=$PREFIX-pb.internal:8090" "--env" "AI_UPSTREAM=$PREFIX-ai.internal:8787" \
      "--env" "BILLING_UPSTREAM=$PREFIX-billing.internal:8789" "--env" "PDF_UPSTREAM=$PREFIX-pdf.internal:8790" \
      "--env" "MCP_UPSTREAM=$PREFIX-mcp.internal:8791" ;;
  esac
}

echo "▶ Environment: $DEPLOY_ENV (apps $PREFIX-*, env file $ENV_FILE)"
for app in "${APPS[@]}"; do
  [ "$SECRETS" = 1 ] && push_secrets "$app"
  echo "▶ Deploying $PREFIX-$app"
  extra=()
  # shellcheck disable=SC2207
  extra+=($(internal_env "$app"))
  if [ "$app" = web ]; then
    extra+=(--build-arg "VITE_APP_NAME=${APP_NAME:-KanFun}")
    extra+=(--env "WEB_SITE=http://$WEB_DOMAIN:8080" --build-arg "DOMAIN=$DOMAIN" --build-arg "WEB_DOMAIN=$WEB_DOMAIN" --build-arg "WEB_NOINDEX=${WEB_NOINDEX:-false}")
  fi
  # ${extra[@]+...}: macOS ships bash 3.2, where an empty array is "unbound" under set -u.
  fly deploy --config "deploy/fly/$app.toml" --app "$PREFIX-$app" --remote-only --yes \
    ${extra[@]+"${extra[@]}"}
done

if [ "$INIT" = 1 ] && [ -n "$CUSTOM_DOMAIN" ]; then
  fly certs add "$DOMAIN" -a "$PREFIX-web" >/dev/null 2>&1 || true
  fly certs add "$WEB_DOMAIN" -a "$PREFIX-web" >/dev/null 2>&1 || true
  echo
  echo "▶ Point DNS at the web app, then Fly issues the certificate automatically:"
  fly ips list -a "$PREFIX-web"
  fly certs show "$DOMAIN" -a "$PREFIX-web" || true
fi

echo "✔ Deployed. https://$DOMAIN"
