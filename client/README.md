# client — React + Vite + Tailwind v4 + shadcn/ui

- `src/routes/` one file per page, wired in `src/App.tsx`
- `src/components/ui/` shadcn components (add more with `pnpm --filter client ui:add <name>`)
- `src/lib/api/` pure data-access functions, `src/hooks/` React Query hooks around them
- `src/lib/env.ts` is the only place that reads `import.meta.env`
- `src/lib/pb-types.ts` generated collection types (`pnpm typegen`)

- `src/i18n/` i18next setup and `locales/*.json`; every visible string goes through `t()`

- `*.test.tsx` next to the code, run with `pnpm --filter client test`

All URLs are relative. The dev server proxies these prefixes, and Caddy does the same in
production:

- `/api` PocketBase (`/_` admin UI: development only, an SSH tunnel in production)
- `/mail` mailer dev inbox (development only; production answers 404, the mailer is internal)
- `/ai` AI service
- `/mcp`, `/.well-known/oauth-*` MCP server for AI agents
