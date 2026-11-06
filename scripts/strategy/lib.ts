// The pure parts of `pnpm roadmap` (scripts/strategy/roadmap.ts): reading the roadmap, deciding what
// to create or update, and the two trackers. Tested in lib.test.ts against a fake CLI.

export const USAGE = `Usage: pnpm roadmap --phase <n> [--phase <n> ...] [--all] [--dry-run] [--file <path>]

Files the items of strategy/04-requirements-roadmap.md as issues: creates the labels and milestones
that are missing, one issue per item that has none, and updates the ones that changed (matched by
the ID at the start of the title). Re-run after editing the roadmap; it changes only what differs.

  --phase <n>   file this phase (repeat the flag for several)
  --all         every phase that has a milestone in the "At a glance" table
  --dry-run     print what would change, change nothing
  --file <path> another roadmap file (default strategy/04-requirements-roadmap.md)
`;

export type Args = { phases: string[]; all: boolean; dryRun: boolean; help: boolean; file: string };

export function parseArgs(argv: string[]): Args | string {
  const args: Args = {
    phases: [],
    all: false,
    dryRun: false,
    help: false,
    file: "strategy/04-requirements-roadmap.md",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--phase" || arg === "--file") {
      const value = argv[++i];
      if (!value) return `${arg} needs a value\n${USAGE}`;
      if (arg === "--phase") args.phases.push(value);
      else args.file = value;
    } else if (arg === "--all") args.all = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else return `Unknown option ${arg}\n${USAGE}`;
  }
  if (!args.help && !args.all && args.phases.length === 0) return USAGE;
  return args;
}

// --- the roadmap ---------------------------------------------------------------------------------

export type Item = {
  id: string;
  title: string;
  labels: string[];
  /** the value of the `phase:` label, if any */
  phase: string | null;
  body: string;
};

export type Roadmap = {
  /** phase number → milestone title, from the "At a glance" table (`**0 · Launch-ready**`) */
  milestones: Record<string, string>;
  items: Item[];
};

const ITEM_HEADING = /^####\s+([A-Z][A-Z0-9]*-\d+)\s*[·:-]\s*(.+?)\s*$/;
const PHASE_ROW = /^\|\s*\*\*(\d+)\s*·\s*([^*|]+?)\*\*/;
const TAG = /`([^`\s]+:[^`\s]+)`/g;

/** The items (one per `#### ID · title`) and the milestones of a roadmap document. */
export function parseRoadmap(text: string): Roadmap {
  const milestones: Record<string, string> = {};
  const items: Item[] = [];
  let current: (Item & { lines: string[] }) | null = null;
  const finish = () => {
    if (!current) return;
    const lines = [...current.lines];
    const first = lines.findIndex((l) => l.trim() !== "");
    if (first >= 0 && (lines[first]!.match(TAG) ?? []).length > 0) {
      const line = lines[first]!;
      current.labels = [...line.matchAll(TAG)].map((m) => m[1]!);
      const rest = line.replace(TAG, "").replace(/^[\s·]+|[\s·]+$/g, "");
      lines.splice(first, 1, ...(rest ? [rest] : []));
    }
    current.phase = current.labels.find((l) => l.startsWith("phase:"))?.slice(6) ?? null;
    current.body = lines.join("\n").trim();
    const { lines: _, ...item } = current;
    items.push(item);
    current = null;
  };
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const phase = raw.match(PHASE_ROW);
    if (phase)
      milestones[phase[1]!] =
        `Phase ${phase[1]} · ${phase[2]!.replace(/\s*\(\d+\)\s*$/, "").trim()}`;
    const heading = raw.match(ITEM_HEADING);
    if (heading) {
      finish();
      current = {
        id: heading[1]!,
        title: heading[2]!,
        labels: [],
        phase: null,
        body: "",
        lines: [],
      };
    } else if (/^#{1,3}\s/.test(raw)) finish();
    else if (current) current.lines.push(raw);
  }
  finish();
  return { milestones, items };
}

// --- what an issue looks like --------------------------------------------------------------------

export type IssueSpec = {
  id: string;
  title: string;
  labels: string[];
  milestone: string | null;
  body: string;
};

export const FOOTER = (id: string, file: string) =>
  `---\n_${id} in \`${file}\`. The definition of done is AGENTS.md §3._`;

/** The issue for an item, or null when its phase has no milestone (later phases are not filed). */
export function toIssue(item: Item, roadmap: Roadmap, file: string): IssueSpec | null {
  const milestone = item.phase ? (roadmap.milestones[item.phase] ?? null) : null;
  if (!milestone) return null;
  return {
    id: item.id,
    title: `${item.id} · ${item.title}`,
    labels: [...item.labels].sort(),
    milestone,
    body: `${item.body}\n\n${FOOTER(item.id, file)}`.trim(),
  };
}

export function selectPhases(roadmap: Roadmap, args: Pick<Args, "phases" | "all">): string[] {
  if (args.all) return Object.keys(roadmap.milestones);
  const unknown = args.phases.filter((p) => !roadmap.milestones[p]);
  if (unknown.length)
    throw new Error(
      `No milestone for phase ${unknown.join(", ")}: the "At a glance" table needs a row starting with "| **${unknown[0]} · <name>**"`,
    );
  return args.phases;
}

// --- the plan ------------------------------------------------------------------------------------

export type Existing = {
  number: number;
  title: string;
  labels: string[];
  milestone: string | null;
  body: string;
};

export type Update = { number: number; spec: IssueSpec; removeLabels: string[]; changes: string[] };

export type Plan = {
  labels: string[];
  milestones: string[];
  create: IssueSpec[];
  update: Update[];
  unchanged: number;
};

/** Label families the roadmap owns: a stale one of these is removed from an issue on update. */
export const MANAGED = ["area:", "priority:", "size:", "plan:", "phase:"];

const norm = (s: string) => s.replace(/\r\n/g, "\n").trim();

export function plan(
  specs: IssueSpec[],
  tracker: { labels: string[]; milestones: string[]; issues: Existing[] },
): Plan {
  const result: Plan = { labels: [], milestones: [], create: [], update: [], unchanged: 0 };
  const have = new Set(tracker.labels);
  for (const spec of specs)
    for (const label of spec.labels)
      if (!have.has(label) && !result.labels.includes(label)) result.labels.push(label);
  const milestones = new Set(tracker.milestones);
  for (const spec of specs)
    if (
      spec.milestone &&
      !milestones.has(spec.milestone) &&
      !result.milestones.includes(spec.milestone)
    )
      result.milestones.push(spec.milestone);
  for (const spec of specs) {
    const existing = tracker.issues.find((i) => new RegExp(`^${spec.id}\\s*[·:-]`).test(i.title));
    if (!existing) {
      result.create.push(spec);
      continue;
    }
    const changes: string[] = [];
    if (existing.title !== spec.title) changes.push("title");
    const removeLabels = existing.labels.filter(
      (l) => MANAGED.some((m) => l.startsWith(m)) && !spec.labels.includes(l),
    );
    if (removeLabels.length || spec.labels.some((l) => !existing.labels.includes(l)))
      changes.push("labels");
    if ((existing.milestone ?? null) !== spec.milestone) changes.push("milestone");
    if (norm(existing.body) !== norm(spec.body)) changes.push("body");
    if (changes.length)
      result.update.push({ number: existing.number, spec, removeLabels, changes });
    else result.unchanged++;
  }
  return result;
}

export function labelColor(name: string): string {
  if (name.startsWith("priority:P0")) return "b60205";
  if (name.startsWith("priority:P1")) return "d93f0b";
  if (name.startsWith("priority:P2")) return "fbca04";
  if (name.startsWith("priority:")) return "c2e0c6";
  if (name.startsWith("area:")) return "1d76db";
  if (name.startsWith("plan:")) return "0e8a16";
  if (name.startsWith("phase:")) return "5319e7";
  return "ededed";
}

// --- applying it ---------------------------------------------------------------------------------

export interface Tracker {
  labels(): string[];
  milestones(): string[];
  issues(): Existing[];
  createLabel(name: string, color: string): void;
  createMilestone(title: string): void;
  /** returns the new issue's number */
  createIssue(spec: IssueSpec): number;
  updateIssue(update: Update): void;
}

export function apply(p: Plan, tracker: Tracker, log: (line: string) => void, dryRun: boolean) {
  const would = (verb: string, what: string) =>
    log(dryRun ? `Would ${verb.toLowerCase()} ${what}` : `✔ ${verb}d ${what}`);
  for (const label of p.labels) {
    if (!dryRun) tracker.createLabel(label, labelColor(label));
    would("Create", `label ${label}`);
  }
  for (const title of p.milestones) {
    if (!dryRun) tracker.createMilestone(title);
    would("Create", `milestone "${title}"`);
  }
  for (const spec of p.create) {
    const number = dryRun ? null : tracker.createIssue(spec);
    would("Create", `${number ? `#${number} ` : ""}${spec.title}`);
  }
  for (const update of p.update) {
    if (!dryRun) tracker.updateIssue(update);
    would("Update", `#${update.number} ${update.spec.title} (${update.changes.join(", ")})`);
  }
  log(
    `${p.create.length} to create, ${p.update.length} to update, ${p.unchanged} unchanged` +
      (dryRun ? " (dry run)" : ""),
  );
}

/** Runs a CLI and returns its stdout; `input` goes to stdin. Throws with stderr on failure. */
export type Exec = (cmd: string, args: string[], input?: string) => string;

const json = <T>(text: string): T => JSON.parse(text || "null") as T;

/** GitHub through `gh`. `{owner}/{repo}` is resolved by gh from the current repository. */
export function ghTracker(exec: Exec): Tracker {
  const gh = (args: string[], input?: string) => exec("gh", args, input);
  return {
    labels: () =>
      json<{ name: string }[]>(gh(["label", "list", "--limit", "500", "--json", "name"])).map(
        (l) => l.name,
      ),
    milestones: () =>
      json<{ title: string }[]>(
        gh(["api", "repos/{owner}/{repo}/milestones?state=all&per_page=100"]),
      ).map((m) => m.title),
    issues: () =>
      json<
        {
          number: number;
          title: string;
          labels: { name: string }[];
          milestone: { title: string } | null;
          body: string;
        }[]
      >(
        gh([
          "issue",
          "list",
          "--state",
          "all",
          "--limit",
          "1000",
          "--json",
          "number,title,labels,milestone,body",
        ]),
      ).map((i) => ({
        number: i.number,
        title: i.title,
        labels: i.labels.map((l) => l.name),
        milestone: i.milestone?.title ?? null,
        body: i.body,
      })),
    createLabel: (name, color) => void gh(["label", "create", name, "--color", color, "--force"]),
    createMilestone: (title) =>
      void gh(["api", "repos/{owner}/{repo}/milestones", "-f", `title=${title}`]),
    createIssue: (spec) => {
      const url = gh(
        [
          "issue",
          "create",
          "--title",
          spec.title,
          "--body-file",
          "-",
          ...(spec.labels.length ? ["--label", spec.labels.join(",")] : []),
          ...(spec.milestone ? ["--milestone", spec.milestone] : []),
        ],
        spec.body,
      ).trim();
      return Number(url.split("/").pop());
    },
    updateIssue: ({ number, spec, removeLabels }) =>
      void gh(
        [
          "issue",
          "edit",
          String(number),
          "--title",
          spec.title,
          "--body-file",
          "-",
          ...(spec.labels.length ? ["--add-label", spec.labels.join(",")] : []),
          ...(removeLabels.length ? ["--remove-label", removeLabels.join(",")] : []),
          ...(spec.milestone ? ["--milestone", spec.milestone] : []),
        ],
        spec.body,
      ),
  };
}

/** GitLab through `glab` (untested against a real project, like the vendor code in services/). */
export function glabTracker(exec: Exec): Tracker {
  const glab = (args: string[], input?: string) => exec("glab", args, input);
  return {
    labels: () =>
      json<{ name: string }[]>(
        glab(["label", "list", "--per-page", "100", "--output", "json"]),
      ).map((l) => l.name),
    milestones: () =>
      json<{ title: string }[]>(
        glab(["api", "projects/:id/milestones?state=all&per_page=100"]),
      ).map((m) => m.title),
    issues: () =>
      json<
        {
          iid: number;
          title: string;
          labels: string[];
          milestone: { title: string } | null;
          description: string;
        }[]
      >(glab(["issue", "list", "--all", "--per-page", "100", "--output", "json"])).map((i) => ({
        number: i.iid,
        title: i.title,
        labels: i.labels,
        milestone: i.milestone?.title ?? null,
        body: i.description ?? "",
      })),
    createLabel: (name, color) =>
      void glab(["label", "create", "--name", name, "--color", `#${color}`]),
    createMilestone: (title) =>
      void glab(["api", "projects/:id/milestones", "-f", `title=${title}`]),
    createIssue: (spec) => {
      const url = glab([
        "issue",
        "create",
        "--yes",
        "--title",
        spec.title,
        "--description",
        spec.body,
        ...(spec.labels.length ? ["--label", spec.labels.join(",")] : []),
        ...(spec.milestone ? ["--milestone", spec.milestone] : []),
      ]).trim();
      return Number(url.split("/").pop());
    },
    updateIssue: ({ number, spec, removeLabels }) =>
      void glab([
        "issue",
        "update",
        String(number),
        "--title",
        spec.title,
        "--description",
        spec.body,
        ...(spec.labels.length ? ["--label", spec.labels.join(",")] : []),
        ...(removeLabels.length ? ["--unlabel", removeLabels.join(",")] : []),
        ...(spec.milestone ? ["--milestone", spec.milestone] : []),
      ]),
  };
}

/** Without a git CLI: the issues as text to paste into the tracker by hand. */
export function render(specs: IssueSpec[]): string {
  return specs
    .map(
      (s) =>
        `## ${s.title}\n\nLabels: ${s.labels.join(", ") || "none"}\nMilestone: ${s.milestone ?? "none"}\n\n${s.body}\n`,
    )
    .join("\n");
}
