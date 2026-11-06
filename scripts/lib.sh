#!/usr/bin/env bash
# Shared helpers for the scripts in this folder. Source it, don't run it.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
TMP_DIR="$SERVER_DIR/.tmp"

log()  { printf "\033[1;34m▶ %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m✔ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m! %s\033[0m\n" "$*"; }
die()  { printf "\033[1;31m✖ %s\033[0m\n" "$*" >&2; exit 1; }

# Load the root .env into the environment (exported), with sane defaults.
load_env() {
  if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT_DIR/.env"
    set +a
  fi
  export PB_HOST="${PB_HOST:-127.0.0.1}"
  export PB_PORT="${PB_PORT:-8090}"
  export POCKETBASE_URL="${POCKETBASE_URL:-http://$PB_HOST:$PB_PORT}"
  export PB_ADMIN_EMAIL="${PB_ADMIN_EMAIL:-admin@example.com}"
  export PB_ADMIN_PASSWORD="${PB_ADMIN_PASSWORD:-changeme-admin-1234}"
}

ensure_env_file() {
  if [ ! -f "$ROOT_DIR/.env" ]; then
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    warn "Created .env from .env.example. Add API keys when you get a chance; everything works without them."
  fi
}

ensure_pocketbase() {
  bash "$SERVER_DIR/scripts/download-pocketbase.sh"
}

pb_flags() {
  echo "--dir=pb_data --migrationsDir=pb_migrations --hooksDir=pb_hooks --publicDir=pb_public"
}

# Create or update the first superuser (admin UI login) from env. Safe to re-run.
pb_superuser_upsert() {
  # shellcheck disable=SC2046
  (cd "$SERVER_DIR" && ./pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" $(pb_flags) >/dev/null)
  ok "Superuser $PB_ADMIN_EMAIL is ready (admin UI: $POCKETBASE_URL/_/)"
}

pb_is_running() {
  curl -sf --max-time 2 "$POCKETBASE_URL/api/health" >/dev/null 2>&1
}

# A running instance is only usable if it is this project's (our superuser can log in).
# Another project on the same port answers /api/health too, then seeding would fail later.
pb_assert_ours() {
  local body
  body="$(printf '{"identity":"%s","password":"%s"}' "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD")"
  if ! curl -sf --max-time 3 -X POST -H "Content-Type: application/json" -d "$body" \
    "$POCKETBASE_URL/api/collections/_superusers/auth-with-password" >/dev/null 2>&1; then
    die "A PocketBase answers at $POCKETBASE_URL but it is not this project's (admin login failed).
  Another project probably uses port ${PB_PORT}. Stop it, or change PB_PORT and POCKETBASE_URL
  in .env, then run: pnpm bootstrap"
  fi
}

# Start PocketBase in the background (used by bootstrap/reset to run seeds).
pb_start_background() {
  mkdir -p "$TMP_DIR"
  (
    cd "$SERVER_DIR"
    # Background only the binary (not a `cd && ...` list) so $! is PocketBase itself.
    # shellcheck disable=SC2046
    ./pocketbase serve --http="$PB_HOST:$PB_PORT" $(pb_flags) >"$TMP_DIR/pocketbase.log" 2>&1 &
    echo $! >"$TMP_DIR/pocketbase.pid"
  )
}

pb_wait() {
  local tries=0
  until pb_is_running; do
    tries=$((tries + 1))
    if [ "$tries" -gt 60 ]; then
      cat "$TMP_DIR/pocketbase.log" 2>/dev/null || true
      die "PocketBase did not become healthy at $POCKETBASE_URL"
    fi
    sleep 0.5
  done
}

pb_stop_background() {
  if [ -f "$TMP_DIR/pocketbase.pid" ]; then
    kill "$(cat "$TMP_DIR/pocketbase.pid")" 2>/dev/null || true
    rm -f "$TMP_DIR/pocketbase.pid"
  fi
}

run_seed() {
  (cd "$ROOT_DIR" && pnpm --filter server seed "$@")
}
