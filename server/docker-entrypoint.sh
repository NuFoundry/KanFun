#!/bin/sh
# Container entrypoint: ensure the superuser from env exists, then serve.
set -e
cd /pb
if [ -n "${PB_ADMIN_EMAIL:-}" ] && [ -n "${PB_ADMIN_PASSWORD:-}" ]; then
  ./pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" --dir=/pb/pb_data >/dev/null 2>&1 || true
fi
# PB_LISTEN: [::]:8090 (both families) in Docker Compose and on Fly; 0.0.0.0:8090 elsewhere.
exec ./pocketbase serve --http="${PB_LISTEN:-0.0.0.0:8090}" \
  --dir=/pb/pb_data --migrationsDir=/pb/pb_migrations --hooksDir=/pb/pb_hooks --publicDir=/pb/pb_public "$@"
