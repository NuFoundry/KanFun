// `node --test strategy/tools/*.test.ts` (part of `pnpm test`).
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ASSUMPTIONS,
  SCENARIOS,
  monthLabel,
  run,
  salaryCoveredFrom,
  table,
  type Scenario,
} from "./revenue-model.ts";

const flat: Scenario = { trials0: 100, growth: 0, cap: 100, conversion: 0.1, churn: 0, spend0: 0 };

test("run: one row per month, customers accumulate without churn", () => {
  const rows = run(flat, { ...ASSUMPTIONS, months: 3, spendGrowth: 0 });
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((r) => r.paying),
    [10, 20, 30],
  );
  assert.equal(rows[2]!.mrr, 30 * ASSUMPTIONS.arpu);
  assert.equal(rows[0]!.cost, ASSUMPTIONS.fixedCosts + 10 * ASSUMPTIONS.costPerCustomer);
});

test("run: sign-ups grow until the cap, churn removes customers", () => {
  const rows = run({ ...flat, trials0: 50, growth: 1, cap: 120, churn: 0.5 }, ASSUMPTIONS);
  assert.deepEqual(
    rows.slice(0, 3).map((r) => r.trials),
    [50, 100, 120],
  );
  // 5 paying after month 1; half churn, plus 10 new ones in month 2
  assert.equal(rows[1]!.paying, 5 * 0.5 + 10);
});

test("salaryCoveredFrom: the first month whose profit reaches the salary", () => {
  const rows = run(flat, { ...ASSUMPTIONS, spendGrowth: 0 });
  // profit per month: paying * 20 - 150 - paying * 0.5 = 19.5 * paying - 150; paying = 10 * month
  assert.equal(salaryCoveredFrom(rows, 3000), 17);
  assert.equal(salaryCoveredFrom(rows, 1_000_000), null);
});

test("monthLabel: counts calendar months from the first one", () => {
  assert.equal(monthLabel("Jan 2027", 1), "Jan 2027");
  assert.equal(monthLabel("Jan 2027", 12), "Dec 2027");
  assert.equal(monthLabel("Nov 2026", 3), "Jan 2027");
});

test("table: a markdown row per scenario with the three checkpoints", () => {
  const out = table(SCENARIOS, ASSUMPTIONS);
  const lines = out.split("\n");
  assert.equal(lines.length, 2 + Object.keys(SCENARIOS).length);
  assert.match(lines[0]!, /Month 12 \(Dec 2027\).*Month 24.*Month 36/);
  assert.match(lines[3]!, /^\| Base \| \d+ paying · €[\d.,k]+ MRR \|/);
  assert.match(out, /salary covered from/);
});
