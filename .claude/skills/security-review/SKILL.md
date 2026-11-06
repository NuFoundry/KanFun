---
name: security-review
description: Reviews this app's security and privacy before a launch and after big changes - API rules and tenancy, hooks and custom routes, the services, the client, the edge (Caddy, headers, CSP), CI and dependencies, secrets, and whether the privacy texts match the code. Probes the local stack with throwaway users, verifies every finding, fixes code bugs with a regression test, and writes docs/security-review-<date>.md. Use when the user says "review security", "is this safe to launch", "pentest", "check privacy/GDPR", before going live, or after adding collections, relations, routes, services or third-party vendors.
---

The skill is shared by every coding agent and lives in `.agents/skills/security-review/`. Read
`.agents/skills/security-review/SKILL.md` and follow it; the checklist it walks is
`docs/security-checklist.md`.
