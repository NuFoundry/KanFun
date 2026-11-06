// `node --test scripts/strategy/*.test.ts` (part of `pnpm test`).
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  apply,
  ghTracker,
  labelColor,
  parseArgs,
  parseRoadmap,
  plan,
  render,
  selectPhases,
  toIssue,
  USAGE,
  type Existing,
  type IssueSpec,
  type Tracker,
} from "./lib.ts";

const ROADMAP = `# 04 · Requirements & Roadmap

## At a glance

| Phase | When | Goal | Items |
| --- | --- | --- | --- |
| **0 · Launch-ready** (2) | Now → Jan 2027 | A trial converts by itself | \`ACT-1\` \`BIL-1\` |
| **1 · Trust** (1) | Jan – Jun 2027 | Exports | \`TRU-1\` |
| **Later** | 2028+ | With evidence | \`AI-1\` |

## 5. Issue-ready specifications

### Activation

#### ACT-1 · feat(client): guide every trial to a first quote
\`area:activation\` \`priority:P0\` \`size:M\` \`phase:0\` · wave 0a (13 Nov 2026)

**Why:** half of conversions happen in the first week.

**Acceptance criteria**
- [ ] e2e spec passes

#### BIL-1 · Plans with a 30-day trial

\`area:billing\` \`priority:P0\` \`size:L\` \`plan:all\` \`phase:0\`

**Scope:** Stripe plans.

### Trust

#### TRU-1 · Export everything as a ZIP

\`area:trust\` \`priority:P2\` \`size:S\` \`phase:1\`

Body.

#### AI-1 · A labelled assistant

\`area:ai\` \`priority:P3\` \`size:L\` \`phase:later\`

Later.

## 6. Turning this into issues

Not an item.
`;

test("parseArgs: phases, flags and errors", () => {
  assert.deepEqual(parseArgs(["--phase", "0", "--phase", "1", "--dry-run"]), {
    phases: ["0", "1"],
    all: false,
    dryRun: true,
    help: false,
    file: "strategy/04-requirements-roadmap.md",
  });
  assert.equal(parseArgs([]), USAGE);
  assert.match(parseArgs(["--phase"]) as string, /needs a value/);
  assert.match(parseArgs(["--nope"]) as string, /Unknown option/);
  assert.equal((parseArgs(["--all", "--file", "x.md"]) as { file: string }).file, "x.md");
});

test("parseRoadmap: milestones from the at-a-glance table, one item per #### heading", () => {
  const roadmap = parseRoadmap(ROADMAP);
  assert.deepEqual(roadmap.milestones, { "0": "Phase 0 · Launch-ready", "1": "Phase 1 · Trust" });
  assert.deepEqual(
    roadmap.items.map((i) => i.id),
    ["ACT-1", "BIL-1", "TRU-1", "AI-1"],
  );
  const act = roadmap.items[0]!;
  assert.equal(act.title, "feat(client): guide every trial to a first quote");
  assert.deepEqual(act.labels, ["area:activation", "priority:P0", "size:M", "phase:0"]);
  assert.equal(act.phase, "0");
  // the label line's tail stays in the body, the tags do not
  assert.match(act.body, /^wave 0a \(13 Nov 2026\)\n\n\*\*Why:\*\*/);
  assert.match(act.body, /- \[ \] e2e spec passes$/);
  assert.doesNotMatch(act.body, /`area:/);
  assert.equal(roadmap.items[1]!.body, "**Scope:** Stripe plans.");
  assert.equal(roadmap.items[3]!.phase, "later");
});

test("toIssue: title with the ID, sorted labels, milestone, footer; later phases are not filed", () => {
  const roadmap = parseRoadmap(ROADMAP);
  const issue = toIssue(roadmap.items[1]!, roadmap, "strategy/04-requirements-roadmap.md")!;
  assert.equal(issue.title, "BIL-1 · Plans with a 30-day trial");
  assert.deepEqual(issue.labels, ["area:billing", "phase:0", "plan:all", "priority:P0", "size:L"]);
  assert.equal(issue.milestone, "Phase 0 · Launch-ready");
  assert.match(
    issue.body,
    /^\*\*Scope:\*\* Stripe plans\.\n\n---\n_BIL-1 in `strategy\/04-requirements-roadmap.md`/,
  );
  assert.equal(toIssue(roadmap.items[3]!, roadmap, "f.md"), null);
});

test("selectPhases: --all takes every milestone, an unknown phase is an error", () => {
  const roadmap = parseRoadmap(ROADMAP);
  assert.deepEqual(selectPhases(roadmap, { phases: [], all: true }), ["0", "1"]);
  assert.deepEqual(selectPhases(roadmap, { phases: ["1"], all: false }), ["1"]);
  assert.throws(
    () => selectPhases(roadmap, { phases: ["7"], all: false }),
    /No milestone for phase 7/,
  );
});

const specs = (): IssueSpec[] => {
  const roadmap = parseRoadmap(ROADMAP);
  return roadmap.items.map((i) => toIssue(i, roadmap, "f.md")).filter((s) => s !== null);
};

test("plan: missing labels and milestones, creates, updates by ID, unchanged", () => {
  const [act, bil, tru] = specs() as [IssueSpec, IssueSpec, IssueSpec];
  const existing: Existing[] = [
    {
      number: 3,
      title: "ACT-1 · old title",
      labels: ["area:activation", "priority:P1", "bug"],
      milestone: null,
      body: act.body,
    },
    {
      number: 4,
      title: bil.title,
      labels: bil.labels,
      milestone: bil.milestone,
      body: `${bil.body}\r\n`,
    },
  ];
  const p = plan([act, bil, tru], {
    labels: ["area:activation", "priority:P0", "priority:P1", "bug"],
    milestones: ["Phase 0 · Launch-ready"],
    issues: existing,
  });
  assert.deepEqual(p.labels, [
    "phase:0",
    "size:M",
    "area:billing",
    "plan:all",
    "size:L",
    "area:trust",
    "phase:1",
    "priority:P2",
    "size:S",
  ]);
  assert.deepEqual(p.milestones, ["Phase 1 · Trust"]);
  assert.deepEqual(
    p.create.map((s) => s.id),
    ["TRU-1"],
  );
  assert.equal(p.update.length, 1);
  const update = p.update[0]!;
  assert.equal(update.number, 3);
  assert.deepEqual(update.changes, ["title", "labels", "milestone"]);
  // a stale managed label goes, a foreign one stays
  assert.deepEqual(update.removeLabels, ["priority:P1"]);
  assert.equal(p.unchanged, 1);
});

function fakeTracker() {
  const calls: string[] = [];
  let next = 10;
  const tracker: Tracker = {
    labels: () => [],
    milestones: () => [],
    issues: () => [],
    createLabel: (name, color) => void calls.push(`label ${name} ${color}`),
    createMilestone: (title) => void calls.push(`milestone ${title}`),
    createIssue: (spec) => {
      calls.push(`create ${spec.title}`);
      return next++;
    },
    updateIssue: (u) => void calls.push(`update #${u.number} -${u.removeLabels.join(",")}`),
  };
  return { tracker, calls };
}

test("apply: dry run only prints, a real run calls the tracker in order", () => {
  const [act, bil] = specs() as [IssueSpec, IssueSpec];
  const p = plan([act, bil], {
    labels: [],
    milestones: [],
    issues: [
      { number: 2, title: "BIL-1: plans", labels: ["priority:P3"], milestone: null, body: "" },
    ],
  });
  const dry = fakeTracker();
  const dryLog: string[] = [];
  apply(p, dry.tracker, (l) => dryLog.push(l), true);
  assert.deepEqual(dry.calls, []);
  assert.match(dryLog[0]!, /^Would create label area:activation$/);
  assert.match(dryLog.at(-1)!, /1 to create, 1 to update, 0 unchanged \(dry run\)/);

  const real = fakeTracker();
  const log: string[] = [];
  apply(p, real.tracker, (l) => log.push(l), false);
  assert.equal(real.calls[0], "label area:activation 1d76db");
  assert.ok(real.calls.includes("milestone Phase 0 · Launch-ready"));
  assert.ok(real.calls.includes(`create ${act.title}`));
  assert.ok(real.calls.includes("update #2 -priority:P3"));
  assert.ok(log.includes(`✔ Created #10 ${act.title}`));
  assert.match(log.at(-1)!, /1 to create, 1 to update, 0 unchanged$/);
});

test("labelColor: by family", () => {
  assert.equal(labelColor("priority:P0"), "b60205");
  assert.equal(labelColor("area:billing"), "1d76db");
  assert.equal(labelColor("size:M"), "ededed");
});

test("ghTracker: reads gh's JSON and creates through gh", () => {
  const calls: string[][] = [];
  const outputs: Record<string, string> = {
    label: JSON.stringify([{ name: "bug" }]),
    api: JSON.stringify([{ title: "Phase 0 · Launch-ready" }]),
    issue: JSON.stringify([
      {
        number: 5,
        title: "ACT-1 · x",
        labels: [{ name: "bug" }],
        milestone: { title: "Phase 0 · Launch-ready" },
        body: "b",
      },
    ]),
  };
  const tracker = ghTracker((cmd, args, input) => {
    assert.equal(cmd, "gh");
    calls.push([...args, ...(input ? [`<${input}>`] : [])]);
    if (args[1] === "create") return "https://github.com/o/r/issues/42\n";
    return outputs[args[0]!] ?? "";
  });
  assert.deepEqual(tracker.labels(), ["bug"]);
  assert.deepEqual(tracker.milestones(), ["Phase 0 · Launch-ready"]);
  assert.deepEqual(tracker.issues(), [
    {
      number: 5,
      title: "ACT-1 · x",
      labels: ["bug"],
      milestone: "Phase 0 · Launch-ready",
      body: "b",
    },
  ]);
  const [act] = specs() as [IssueSpec];
  assert.equal(tracker.createIssue(act), 42);
  const create = calls.at(-1)!;
  assert.deepEqual(create.slice(0, 4), ["issue", "create", "--title", act.title]);
  assert.ok(create.includes("--milestone") && create.includes(`<${act.body}>`));
});

test("render: text to paste without a CLI", () => {
  const out = render(specs().slice(0, 1));
  assert.match(out, /^## ACT-1 · feat\(client\)/);
  assert.match(
    out,
    /Labels: area:activation, phase:0, priority:P0, size:M\nMilestone: Phase 0 · Launch-ready/,
  );
});
