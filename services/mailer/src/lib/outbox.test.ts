import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Outbox } from "./outbox";

const base = { from: "a@x.test", subject: "Hello", text: "hi", source: "api" as const };

describe("Outbox", () => {
  it("stores newest first, filters by recipient and subject", () => {
    const box = new Outbox();
    box.add({ ...base, to: ["alice@x.test"] });
    box.add({ ...base, to: ["bob@x.test"], subject: "Reset your password" });
    expect(box.list().map((m) => m.to[0])).toEqual(["bob@x.test", "alice@x.test"]);
    expect(box.list({ to: "ALICE" })).toHaveLength(1);
    expect(box.list({ subject: "reset" })).toHaveLength(1);
    expect(box.list({ to: "nobody" })).toHaveLength(0);
  });

  it("caps the number of stored mails", () => {
    const box = new Outbox(undefined, 2);
    for (let i = 0; i < 5; i++) box.add({ ...base, to: [`u${i}@x.test`] });
    expect(box.size).toBe(2);
  });

  it("persists to disk and reloads", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "outbox-"));
    try {
      const box = new Outbox(dir);
      const stored = box.add({ ...base, to: ["alice@x.test"] });
      expect(readdirSync(dir)).toHaveLength(1);
      const reloaded = new Outbox(dir);
      expect(reloaded.get(stored.id)?.subject).toBe("Hello");
      reloaded.clear();
      expect(reloaded.size).toBe(0);
      expect(readdirSync(dir)).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
