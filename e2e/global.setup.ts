import { execSync } from "node:child_process";
import { test as setup } from "@playwright/test";

// Runs once before the browser projects (see playwright.config.ts `dependencies`).
setup("seed the database", () => {
  execSync("pnpm --filter server seed", { stdio: "inherit" });
});
