// `pnpm roadmap --phase 0 [--dry-run]`: the items of strategy/04-requirements-roadmap.md as issues
// in the project's tracker (vibe.config.json → gitHost, gitCli). Idempotent: re-run after editing
// the roadmap and only what differs changes. The pure parts are in lib.ts.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  apply,
  ghTracker,
  glabTracker,
  parseArgs,
  parseRoadmap,
  plan,
  render,
  selectPhases,
  toIssue,
  USAGE,
  type Exec,
  type Tracker,
} from "./lib.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

const exec: Exec = (cmd, args, input) => {
  const result = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", input });
  if (result.error) die(`${cmd} is not installed or not on PATH (${result.error.message})`);
  if (result.status !== 0)
    die(`${cmd} ${args[0]} ${args[1] ?? ""} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (typeof args === "string") die(args);
  if (args.help) {
    console.log(USAGE);
    return;
  }
  const file = path.resolve(ROOT, args.file);
  if (!fs.existsSync(file))
    die(`${args.file} does not exist. Business Discovery writes it (strategy/README.md).`);
  const roadmap = parseRoadmap(fs.readFileSync(file, "utf8"));
  if (roadmap.items.length === 0)
    die(`${args.file} has no items: a "#### ID · title" heading per item is expected.`);
  let phases: string[];
  try {
    phases = selectPhases(roadmap, args);
  } catch (error) {
    die((error as Error).message);
  }
  const relative = path.relative(ROOT, file);
  const specs = roadmap.items
    .filter((item) => item.phase && phases.includes(item.phase))
    .map((item) => toIssue(item, roadmap, relative))
    .filter((spec) => spec !== null);
  if (specs.length === 0) die(`No items with a phase:<n> label for phase ${phases.join(", ")}.`);

  const configPath = path.join(ROOT, "vibe.config.json");
  const config = fs.existsSync(configPath)
    ? (JSON.parse(fs.readFileSync(configPath, "utf8")) as { gitHost?: string; gitCli?: boolean })
    : {};
  let tracker: Tracker | null = null;
  if (config.gitCli && config.gitHost === "github") tracker = ghTracker(exec);
  else if (config.gitCli && config.gitHost === "gitlab") tracker = glabTracker(exec);
  if (!tracker) {
    console.log(
      `No git CLI for this project (vibe.config.json: gitHost ${config.gitHost ?? "unset"}, gitCli ${String(config.gitCli ?? false)}). ` +
        `Paste these ${specs.length} issues by hand:\n`,
    );
    console.log(render(specs));
    return;
  }

  const p = plan(specs, {
    labels: tracker.labels(),
    milestones: tracker.milestones(),
    issues: tracker.issues(),
  });
  apply(p, tracker, (line) => console.log(line), args.dryRun);
}

main();
