<!-- Title: <type>(<scope>): <subject>   e.g. feat(client): add settings page -->

## What and why

<!-- Two sentences: what changes for the user, and why. Link the issue if there is one. -->

## How to test

<!-- Commands and the path to click. e.g. `pnpm dev`, log in as alice, open /settings -->

## Checklist

- [ ] `pnpm check` is green
- [ ] `pnpm test:e2e` is green; new or changed flows have a Playwright spec
- [ ] Schema change: migration, `pnpm typegen`, seeds and API rules updated
- [ ] Docs touched where behaviour changed (AGENTS.md, README, `.env.example`, `docs/handbook.md`)
- [ ] UI change: screenshot or recording below

## Out of scope

<!-- What this PR deliberately leaves out, and where it is tracked. -->
