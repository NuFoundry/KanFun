#!/usr/bin/env bash
# Run PocketBase with this repo's migrations/hooks. Extra args are passed to `pocketbase serve`
# (e.g. `pnpm --filter server dev -- --dev` to log every SQL statement).
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

bash "$DIR/scripts/download-pocketbase.sh" >/dev/null
cd "$DIR"

FLAGS=(--dir=pb_data --migrationsDir=pb_migrations --hooksDir=pb_hooks --publicDir=pb_public)

# Keep the superuser in sync with .env so the admin UI login always works.
if [ -n "${PB_ADMIN_EMAIL:-}" ] && [ -n "${PB_ADMIN_PASSWORD:-}" ]; then
  ./pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" "${FLAGS[@]}" >/dev/null 2>&1 || true
fi

exec ./pocketbase serve --http="${PB_HOST:-127.0.0.1}:${PB_PORT:-8090}" "${FLAGS[@]}" "$@"
