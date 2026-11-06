# The documents

The outline of every file in `strategy/`. Section numbers are fixed, so documents can cite each
other (`[01 §6](01-business-plan.md#6-business-model-and-pricing)`) and a reader finds the same
thing in every project. Each starts with one italic line: _As of <date>. <what it is in one
sentence; where the evidence is>. **(est.)** marks our own estimates._ Markdown, Prettier
formatted (except `research/`), tables where things compare, bullets where they list, prose where
they argue. A number without a source gets **(est.)** or **(unverified)**.

| Document                     | Target length                                                |
| ---------------------------- | ------------------------------------------------------------ |
| `brief.md`                   | 1 page                                                       |
| `03-market-analysis.md`      | ≤ 400 lines                                                  |
| `00-direction.md`            | ≤ 200 lines                                                  |
| `01-business-plan.md`        | ≤ 450 lines                                                  |
| `02-marketing-strategy.md`   | ≤ 250 lines, each playbook ≤ 100                             |
| `04-requirements-roadmap.md` | 30 to 50 items for phases 0 to 2; later phases one line each |

## brief.md

The seven headings of interview.md §0, in the user's words: the idea, the market, you, what
exists, constraints, success, hypotheses. Date at the top. Nothing researched; this is the input.

## 03 · Market & competition analysis

The evidence. Everything later cites it; it cites the report and notes in `research/`.

1. **Summary.** The five to ten facts that decide the direction, as bullets, each with its number
   and source.
2. **Market size.** Firms or people by country and size class; who needs what; the value (top-down
   figures with their caveats, and a bottom-up TAM / SAM / SOM with the assumptions stated); search
   demand where it is known.
3. **Competitors.** A table (name, country, who it is for, price, strengths, weaknesses, funding or
   owner, source), grouped by kind; per-group commentary; what reviewers say, verbatim with links;
   recent moves (acquisitions, price changes, exits); a list of prices and claims to re-check before
   quoting them publicly.
4. **Feature gap.** What the competitors have that we do not, and what nobody combines.
5. **Where we can win.** The gaps and the reasons, honestly, including why the obvious segment may be
   a trap.
6. **Segments.** Scoring (size, fit, competition, willingness to pay, reachability, trigger, product
   fit), the beachhead and the expansion order.
7. **Regulation and triggers.** Dated events that make people buy (a mandate, a deadline, a
   platform change, a competitor leaving), retention and privacy rules that shape the product,
   funding programmes if any.
8. **Pricing benchmark.** Tier medians per kind of competitor; where we would sit.
9. **Open questions and what to validate.** Table: question, why it matters, method, when. Every
   **(est.)** that matters should appear here with the cheapest way to replace it.

## 00 · Direction

The decision document. Written after 03, read first.

1. **The decision in one paragraph.** What it becomes, who pays, who brings customers, what we do
   not do, when it widens.
2. **The options.** The directions from interview.md §3 in one table (who pays, what it takes,
   competition, time to first revenue, effort to run, who has to be convinced, fit with what
   exists, upside, verdict), then "why not" for each rejected one, in a few bullets with the
   evidence from 03.
3. **The chosen position.** The ideal first customer (a described person or firm, not a market;
   why they exist in numbers, feel the pain, will pay and are reachable), a second ring served but
   not targeted, who is not targeted; the positioning (one sentence, then the messages ranked by
   strength); the business model in short (plans and prices, partners, what comes later).
4. **What has to be true.** Three to five assumptions, each with a test, a deadline and a kill or
   pivot criterion, and what the business is if all of them fail.
5. **Why now.** The dated triggers from 03 §7 and what the incumbents are stuck on.

## 01 · Business plan

1. **Executive summary.** The product in one bold sentence, then the problem, the product, the
   market, the model, the go-to-market and the money as short bullets, and the scenario table from
   §9. End with what "success" from the brief means here.
2. **Problem.** Who has it, what it costs them today, what they do instead.
3. **Solution and product.** What exists and what the plan adds, as outcomes; what we never build.
4. **Target customers.** From 00 §3; the rings.
5. **Competition (summary).** The groups from 03 §3 in a paragraph each and our answer.
6. **Business model and pricing.** 6.1 prices, 6.2 plans and what each gates, 6.3 revenue streams,
   6.4 unit economics (ARPU, gross margin, LTV, affordable CAC, payback) **(est.)**.
7. **Go-to-market (summary).** The channel order from 02 and the first 90 days.
8. **Operations.** Team and hours, stack and hosting, monthly running costs, legal and admin
   (what to confirm with an accountant and a lawyer).
9. **Financial plan.** 9.1 the model's assumptions per scenario (the values in
   `tools/revenue-model.ts`), 9.2 the table `node strategy/tools/revenue-model.ts` prints, 9.3
   funding (bootstrapped, grants, loans, investors) and the cash low point.
10. **Milestones.** Dated: beta, launch, first paid euro, salary covered, the gate reviews.
11. **Risks.** Table: risk, likelihood, impact, what we do about it.
12. **KPIs.** The numbers watched monthly with their targets per scenario; the gates that pause
    spending.

`tools/revenue-model.ts`: fill `SCENARIOS` and `ASSUMPTIONS`; extend `run()` for a second source of
customers (partner referrals, seats per account, usage) and keep `revenue-model.test.ts` green.

## 02 · Marketing strategy

1. **Goal.** The arithmetic: LTV, affordable CAC, affordable cost per trial, and what that rules
   out. What the user can and cannot do themselves (from the brief), and the channel order that
   follows.
2. **Positioning.** The sentence from 00, the messages ranked, objection handling (the five
   objections and the answer to each).
3. **Who we target first.** Segments in order, the buying group (who decides, who uses, who
   influences).
4. **Funnel and targets.** Visitor → sign-up → activated → paid → retained, with the rates assumed
   **(est.)** and the counts the base case needs per month.
5. **Budget.** What each euro does; phases and gates (what must be true before the next phase
   spends); kill rules per paid channel.
6. **Channel ranking.** Table: channel, expected CAC, time to first result, effort per week,
   verdict (now / later / never), the playbook it links to.
7. **Calendar.** The first 12 months, month by month: what ships, what starts, what is measured.
8. **Measurement.** The events and dashboards; what "working" means per channel.
9. **What has to happen before we spend money.** Interviews, proof assets, production readiness;
   these become roadmap items.

`marketing/NN-<channel>.md`, one per channel that survived §6: why this channel (the arithmetic),
what it needs from us first, the play step by step, numbers and targets, how we measure it, when we
stop.

## 04 · Requirements & roadmap

The at-a-glance table and the item format are read by `pnpm roadmap`; keep their shape.

- Opening italic line, then **in one sentence** what ships before any money goes into acquisition.
- **At a glance.** One row per phase: `| **<N> · <name>** (<items>) | when | goal | exit criteria |
metric it serves | items |`. The row must start with `**<N> · <name>**`: the milestone becomes
  "Phase <N> · <name>". Phase 0 is "Launch-ready". Phases map to versions: phase 0 is version 0,
  phase 1 version 1. A "Later" row has no number and is not filed.

1. **Scope guard.** One sentence for what the product is; a table of in scope / out of scope / why
   (evidence from 03 and 00); two tests for every new request.
2. **Current state.** What is built (from AGENTS.md §1 and the code), with IDs once items ship;
   gaps found in the code that the strategy depends on.
3. **Phases.** Sizes (S ≤ 2 days, M ≤ 1 week, L 2–4 weeks) and priorities (P0 blocks launch, paid
   acquisition or the law; P1 conversion, a gate or a channel; P2 valuable; P3 later); the phase
   table with themes and item IDs; the critical path; the cut order if phase 0 slips, and what is
   never cut.
4. **Items by area (overview).** Table: ID, title, priority, size, plan, phase.
5. **Issue-ready specifications.** Grouped by area (`### <Area>`), one item per heading:

   ```markdown
   #### ACT-1 · Guide every trial to the core outcome on day one

   `area:activation` `priority:P0` `size:M` `plan:all` `phase:0`

   **Links:** 02 §4, the e2e spec it extends, an existing issue if any

   **Why:** the evidence, with its source or section.

   **Scope**

   - what changes, file by file where known; what stays out

   **Acceptance criteria**

   - [ ] the Playwright spec and what it proves
   - [ ] the unit tests, the states, the migration, the docs (AGENTS.md §3 applies to every item)

   **Open decisions:** what the user still has to say, with a recommendation.
   ```

   The ID is `<AREA>-<n>` with a two-to-four-letter area code, defined here and used everywhere.
   The heading text after the ID is the issue title. The first non-empty line holds the labels as
   backtick tags `family:value` (families: `area`, `priority`, `size`, `plan`, `phase`); text after
   the tags on that line stays in the body. The body runs to the next heading. Items with
   `phase:later` or no phase are not filed.

6. **What was cut, and why.** When the user brought a requirements document: a table of its
   requirements, the decision (kept, narrowed, later, cut, replaced) and the reason.
7. **Turning this into issues.** `pnpm roadmap --phase 0 --dry-run`, then with the user's yes without
   the flag; later phases at their gate review. Title `<ID> · <title>`, labels from the tag line,
   milestone from the phase, body as written; re-runs update changed issues and never duplicate.
   Keep the document current: an item that ships moves to §2 and its issue closes.

## README.md

The index table (kept in sync with the files that exist), the direction in one line under the
title once 00 is accepted, and the conventions. Everything the user needs to know about the
folder in one screen.

## archive/

Superseded versions as `<name>-<yyyy-mm-dd>.md`, and documents the user brought in their original
form. Never edited; cited from the current documents when the reasoning matters.
