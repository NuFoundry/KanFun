# Strategy

The business behind the app: what it is, for whom, how it finds customers, and what gets built in
which order. Written by **Business Discovery**: tell your AI agent "let's start Business Discovery"
and it interviews you, researches the market, and writes the documents below one at a time, each
after you read the one before. The agent follows `.agents/skills/business-discovery/SKILL.md`.

This folder is optional. Build straight away if you already know what you are building; come back
when you want the plan. Already have a business case or a requirements document? Drop it in here
(or in `references/`) and say so: the agent fits it into the set and fills only what is missing.

| #   | Document                                  | What it answers                                                                                                                                     |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
|     | `brief.md`                                | Your answers: the idea, the market, who you are, what exists, what success means. The input to everything else                                      |
|     | `research/`                               | The market research: `reports/<title>.md` (the report, with sources) and `notes/<title>/` (the findings per subtopic)                               |
| 00  | `00-direction.md`                         | The decision: the directions compared, the one chosen, the first customer, positioning, the assumptions and what kills them                         |
| 01  | `01-business-plan.md`                     | What we sell, to whom, for how much; unit economics; a 36-month model in three scenarios (`tools/revenue-model.ts`); milestones; risks; KPIs        |
| 02  | `02-marketing-strategy.md` + `marketing/` | Positioning and messages, segments in order, funnel targets, budget with gates, channels ranked by return, the first year; one playbook per channel |
| 03  | `03-market-analysis.md`                   | Market size, competitors, feature gap, where we can win, regulation and triggers, pricing benchmark, open questions                                 |
| 04  | `04-requirements-roadmap.md`              | Scope guard, phases (version 0, 1, 2, ...), every item written as a ready-to-file issue; `pnpm roadmap --phase 0` files a phase                     |
|     | `archive/`                                | Superseded versions, with the date in the file name                                                                                                 |

**Conventions**

- Feature IDs (`ACT-1`, `BIL-2`, ...) are defined in 04 and used in every document, in issues and in
  code comments.
- Numbers marked **(est.)** are our own estimates; **(unverified)** marks claims nobody could confirm.
  Every other figure links to a source.
- Re-check the market facts (prices, competitor moves, deadlines) every quarter; they change. When
  priorities change, change 04 first, then the issues (`pnpm roadmap` updates them).
- When an item ships, move it to the current-state section of 04 and close its issue.
- `research/` is not formatted by Prettier; everything else is.
