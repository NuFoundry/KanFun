---
name: business-discovery
description: Business Discovery - the interview and research that turn an idea ("an app like X for Y") into the strategy/ documents the app is built from - brief, market research, direction, business plan, marketing strategy with playbooks, market analysis, and a requirements roadmap whose items become issues. Use only when the user says "Business Discovery" ("let's start Business Discovery"), asks for market research, a business plan, a marketing plan, a requirements document or roadmap, asks to file the roadmap as issues, or wants a later step of the process (a gate review, new prices, a new market). Never start it on your own - a user who wants to code starts elsewhere.
---

# Business Discovery

Goal: `strategy/` holds a decided direction, a plan with numbers, a way to find customers, and a
roadmap whose first phase is filed as issues, so that every feature built afterwards has a reason.
You interview, research and write; the user decides. One document at a time, and you stop after
each one so the user reads it before the next one builds on it.

Files: `references/interview.md` (what to ask at each stage), `references/documents.md` (the
outline of every document, section by section, and the item format `pnpm roadmap` reads),
`references/research.md` (the research brief: subtopics, questions, the note format, sources).
The folder is explained in `strategy/README.md`; keep its index and one-line direction current.

## Ground rules

1. **Only on the trigger.** The process starts when the user says "Business Discovery" or asks
   for one of its documents. If `strategy/` has no `brief.md`, a request for a feature is a request
   for a feature: build it, and mention once that "let's start Business Discovery" exists.
2. **One document per turn, then stop.** End every step with a short message: what the document
   concluded in three sentences, the two or three decisions it needs, and "read it, then say go".
   Do not write the next document in the same turn, even when the user said "do everything".
3. **Research before opinions.** No market size, price, competitor claim or trend goes into a
   document without a source link, or without **(est.)** when it is our own estimate and
   **(unverified)** when nobody could confirm it. Never invent numbers, quotes or reviews.
4. **The user decides.** Direction, first customer, prices, scope and what gets cut are decisions;
   present two to four options with a recommendation and wait. Record the decision and its date in
   the document.
5. **Short enough to be read.** Size targets are in `references/documents.md`. A document that
   passes them says less and is read; one that does not is skimmed and wrong.
6. **Bring your own.** When the user already has a business case, a requirements document, a
   pitch deck or research (in `strategy/`, `references/` or named in the message), read it first,
   say which documents of the set it covers, and run only the steps that are missing. Keep the
   original in `strategy/archive/` with its date; the set's documents cite it.
7. **Issues only after a yes.** Say how many items a phase has and wait before `pnpm roadmap`.
   Phase 0 is filed when the roadmap is accepted; later phases at their gate review, never all at
   once.
8. **Language.** The documents are written in the language the user writes in; proper names,
   laws and quotes stay in the original.

## The steps

Writing order differs from reading order: the evidence (03) is written before the decision (00).

| Step | Output                                                    | Input                                          | Checkpoint                                                        |
| ---- | --------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| 0    | `strategy/brief.md`                                       | the interview (interview.md §0)                | the brief, read back in one paragraph; "is this right?"           |
| 1    | `strategy/research/reports/<title>.md` + `notes/`         | the brief → research.md                        | the report's summary and what it found that contradicts the brief |
| 2    | `strategy/03-market-analysis.md`                          | the report and notes                           | the three facts that decide the direction; open questions         |
| 3    | `strategy/00-direction.md`                                | 03, interview.md §3                            | the options table; the user picks one                             |
| 4    | `strategy/01-business-plan.md` + `tools/revenue-model.ts` | 00, 03, interview.md §4                        | prices and the base-case numbers; "do you believe them?"          |
| 5    | `strategy/02-marketing-strategy.md` + `marketing/`        | 00, 01, 03                                     | the channel ranking and the budget gates                          |
| 6    | `strategy/04-requirements-roadmap.md`                     | everything, AGENTS.md §1, the code             | the scope guard and phase 0's item list                           |
| 7    | issues of phase 0                                         | `pnpm roadmap --phase 0 --dry-run`, then a yes | the created issues, and what to build first                       |

### 0. Brief

Ask the questions in interview.md §0 in one message; the user's first message usually answers
several. Write `brief.md` from the answers in the user's words, with the hypotheses they already
hold listed as hypotheses (the research tests them). Create `strategy/archive/` and move any
document the user brought there.

### 1. Research

Turn the brief into the research brief of research.md: the subtopics, each with its questions,
constrained to the user's geography and segment. With the deep-research skill available, run it
with those subtopics and have it write into `strategy/research/` (`reports/<title>.md`,
`notes/<title>/`). Without it, research each subtopic yourself with web search, one note file per
subtopic in the note format, then write the report. Either way the report is narrative with inline
source links; Prettier leaves `strategy/research/` alone.

### 2. Market analysis (03)

Write 03 from the report and notes per documents.md. It is the evidence document: every later
document cites it by section (`[03 §2](03-market-analysis.md#2-market-size)`). Flag what the user
should re-check before quoting it publicly, and end with the open questions, each with a cheap
way to answer it and a date.

### 3. Direction (00)

Lay out the directions on the table (interview.md §3 says how to find them: at least the user's
idea as stated, a narrower niche, and the adjacent business the research surfaced) in one
comparison table, recommend one, and stop. After the choice, write 00: the chosen position, the
ideal first customer, positioning and ranked messages, the business model in short, the
assumptions with a test, a deadline and a kill criterion each, and why now. Write the one-line
direction into `strategy/README.md`.

### 4. Business plan (01)

Fill `strategy/tools/revenue-model.ts` with the plan's assumptions (interview.md §4: prices,
conversion, churn, spend; three scenarios), run `node strategy/tools/revenue-model.ts`, and paste
the table into §9.2. Extend the model when the business has a second source of customers
(partners, seats); keep `run()` pure and its test green. Milestones, risks and KPIs close the plan.

### 5. Marketing (02)

Start from the arithmetic: lifetime value, the affordable cost per customer, and what that
excludes. Rank the channels by expected return for this user (what they can do themselves, what
costs money), with gates and kill rules for any paid channel. One playbook per channel that
survives, in `strategy/marketing/NN-<channel>.md`. Section 9 says what must ship before money is
spent: those become roadmap items.

### 6. Requirements and roadmap (04)

The scope guard first (in and out, with the evidence), then the current state from AGENTS.md §1
and the code, then the phases: **Phase 0 · Launch-ready** is the smallest set that lets a user sign
up, get the core outcome, pay, and be measured, with what 02 §9 needs; **1** and **2** follow the
plan's milestones; later phases are one-liners with the trigger that would start them. Every item
of phases 0 to 2 is written in the item format of documents.md (title, labels, why, scope,
acceptance criteria, open decisions). A requirements document the user brought is narrowed here,
with a section "what was cut, and why".

### 7. Issues

`pnpm roadmap --phase 0 --dry-run` shows what would be created; after the user's yes, run it
without `--dry-run`. It creates labels and milestones, files one issue per item and updates
changed ones on re-runs (matched by ID). Without a git CLI it prints the issues to paste. Then
say what to build first: the critical path of 04 §3.

## Later

- **An item ships:** move it to 04 §2 (current state) with its ID, close the issue; the commit or
  PR names the ID.
- **Gate review** (end of a phase, or the first real numbers): update the KPIs in 01 §12 and the
  model, re-rank 02 §6, move items between phases in 04, then `pnpm roadmap --phase <next>`.
  Archive the previous version of a document that changed substantially
  (`archive/<name>-<date>.md`).
- **New prices** change 01 §6 and `services/billing/src/lib/plans.ts` together, then the Stripe
  skill (`pnpm stripe:setup`).
- **A new market or segment:** research it (step 1 with a new title), then 03, 00 §3 and 02.
- **Quarterly:** re-check the facts flagged in 03 (prices, competitors, deadlines).

## What feeds what

| From                            | To                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------- |
| 00 §3 (customer, positioning)   | `docs/product.md` and the website skill; `corporate-identity/brand.json` claims   |
| 01 §6 (plans, prices)           | `services/billing/src/lib/plans.ts`, the Stripe skill                             |
| 04 §1 and the at-a-glance table | AGENTS.md §1: the one-paragraph "what this is" and the status against the roadmap |
| 04 §5 items                     | issues (`pnpm roadmap`), the IDs in commits and code comments                     |
| 02 §8 (measurement)             | the events tracked with `track()` and the funnel the status report shows          |

Write the AGENTS.md §1 paragraph when 00 is accepted and the status line when 04 is accepted; the
`status` shortcut reads the roadmap's milestones from the tracker.
