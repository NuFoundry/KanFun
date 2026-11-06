# server — PocketBase

The backend is a single [PocketBase](https://pocketbase.io) binary (pinned in `.pocketbase-version` and checked against `.pocketbase-checksums`,
downloaded by `scripts/download-pocketbase.sh`). Everything that describes the database lives in git:

| Path             | What                                                                            |
| ---------------- | ------------------------------------------------------------------------------- |
| `pb_migrations/` | JS migrations (schema, API rules, settings). Applied automatically on start.    |
| `pb_hooks/`      | Server-side JS (`*.pb.js`): custom routes, record hooks, cron jobs.             |
| `seed/`          | TypeScript seed script that talks to the running server via the JS SDK.         |
| `pb_data/`       | Runtime data (SQLite + uploads). **Git-ignored.** `pnpm db:reset` recreates it. |
| `pb_public/`     | Optional static files served at `/`. Git-ignored.                               |

Commands (run from the repo root):

```sh
pnpm --filter server dev          # serve on $PB_HOST:$PB_PORT with migrations + hooks
pnpm --filter server dev -- --dev # same, plus every SQL statement in the log
pnpm seed                         # upsert seed data (server must be running)
pnpm db:reset                     # wipe pb_data, recreate superuser, seed
pnpm typegen                      # regenerate client/src/lib/pb-types.ts from pb_data/data.db
pnpm --filter server migrate:create "add_comments"     # blank migration file
pnpm --filter server migrate:snapshot                 # snapshot current collections into a migration
```

Admin UI: `http://127.0.0.1:8090/_/` with `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` from `.env`.

Schema changes made in the admin UI are written to `pb_migrations/` automatically (automigrate),
so commit them. Prefer hand-written migrations for anything reviewed in a PR.
