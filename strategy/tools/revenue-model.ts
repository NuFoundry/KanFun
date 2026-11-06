// The 36-month revenue model behind strategy/01-business-plan.md §9, three scenarios.
//   node strategy/tools/revenue-model.ts     prints the table for §9.2 (markdown)
// Business Discovery fills SCENARIOS and ASSUMPTIONS from the plan; rerun it every quarter with real
// numbers. A business with more than one source of customers (partners, seats, usage) extends run():
// keep it pure, and keep revenue-model.test.ts green (`pnpm test`).

export type Scenario = {
  /** sign-ups (trials) in month 1 */
  trials0: number;
  /** monthly growth of sign-ups, until the channels' cap */
  growth: number;
  /** sign-ups per month the channels can carry at most */
  cap: number;
  /** share of sign-ups that pay */
  conversion: number;
  /** share of paying customers lost per month */
  churn: number;
  /** marketing spend in month 1 (€), growing by spendGrowth */
  spend0: number;
};

export const SCENARIOS: Record<string, Scenario> = {
  conservative: { trials0: 30, growth: 0.04, cap: 150, conversion: 0.1, churn: 0.04, spend0: 300 },
  base: { trials0: 45, growth: 0.06, cap: 250, conversion: 0.15, churn: 0.03, spend0: 400 },
  ambitious: { trials0: 70, growth: 0.08, cap: 500, conversion: 0.2, churn: 0.02, spend0: 700 },
};

export const ASSUMPTIONS = {
  /** net € per paying customer and month, after payment fees, blended over the plans */
  arpu: 20,
  /** € per month regardless of customers: hosting floor, domains, monitoring, tools */
  fixedCosts: 150,
  /** € per paying customer and month: hosting, AI calls, email */
  costPerCustomer: 0.5,
  /** monthly growth of the marketing spend */
  spendGrowth: 0.04,
  /** € per month the business should pay its founder */
  founderSalary: 3000,
  months: 36,
  /** calendar month of month 1 */
  firstMonth: "Jan 2027",
};

export type Assumptions = typeof ASSUMPTIONS;

export type Row = {
  month: number;
  trials: number;
  paying: number;
  mrr: number;
  cost: number;
  /** cumulative cash since month 1, before any founder salary */
  cash: number;
};

export function run(s: Scenario, a: Assumptions = ASSUMPTIONS): Row[] {
  const rows: Row[] = [];
  let paying = 0;
  let trials = s.trials0;
  let cash = 0;
  for (let month = 1; month <= a.months; month++) {
    const newTrials = Math.min(trials, s.cap);
    paying = paying * (1 - s.churn) + newTrials * s.conversion;
    const mrr = paying * a.arpu;
    const spend = s.spend0 * (1 + a.spendGrowth) ** (month - 1);
    const cost = spend + a.fixedCosts + a.costPerCustomer * paying;
    cash += mrr - cost;
    rows.push({ month, trials: newTrials, paying, mrr, cost, cash });
    trials *= 1 + s.growth;
  }
  return rows;
}

/** The first month whose profit covers the founder's salary, or null when none does. */
export function salaryCoveredFrom(rows: Row[], salary: number): number | null {
  return rows.find((r) => r.mrr - r.cost >= salary)?.month ?? null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Jan 2027" + 12 → "Jan 2028" */
export function monthLabel(firstMonth: string, month: number): string {
  const [name = "Jan", year = "2027"] = firstMonth.split(" ");
  const index = MONTHS.indexOf(name) + month - 1;
  return `${MONTHS[index % 12]} ${Number(year) + Math.floor(index / 12)}`;
}

const euro = (n: number) =>
  n >= 10_000 ? `€${(n / 1000).toFixed(1)}k` : `€${Math.round(n).toLocaleString("en-GB")}`;

/** The table for 01 §9.2: one row per scenario. */
export function table(scenarios = SCENARIOS, a: Assumptions = ASSUMPTIONS): string {
  const points = [12, 24, 36].filter((m) => m <= a.months);
  const head = [
    "Scenario",
    ...points.map((m) => `Month ${m} (${monthLabel(a.firstMonth, m)})`),
    "Cash low point",
    `€${a.founderSalary.toLocaleString("en-GB")}/month salary covered from`,
  ];
  const lines = [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`];
  for (const [name, scenario] of Object.entries(scenarios)) {
    const rows = run(scenario, a);
    const at = (m: number) => rows[m - 1]!;
    const low = rows.reduce((min, r) => Math.min(min, r.cash), 0);
    const covered = salaryCoveredFrom(rows, a.founderSalary);
    const cells = [
      name[0]!.toUpperCase() + name.slice(1),
      ...points.map((m) => `${Math.round(at(m).paying)} paying · ${euro(at(m).mrr)} MRR`),
      low < 0 ? `−${euro(-low)}` : "none",
      covered ? `month ${covered} (${monthLabel(a.firstMonth, covered)})` : "not within the model",
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  }
  return lines.join("\n");
}

if (process.argv[1] && import.meta.filename.endsWith(process.argv[1].replace(/^.*\//, ""))) {
  console.log(table());
}
