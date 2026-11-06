import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { StoredMail } from "./types";

export type OutboxFilter = { to?: string; subject?: string };

/**
 * In-memory store of captured mail, optionally mirrored to JSON files so it survives restarts.
 * Used by the outbox provider (no real delivery); the dev inbox in the client reads it.
 */
export class Outbox {
  private mails: StoredMail[] = [];

  constructor(
    private readonly dir?: string,
    private readonly limit = 200,
  ) {
    if (dir) {
      mkdirSync(dir, { recursive: true });
      this.load();
    }
  }

  add(
    mail: Omit<StoredMail, "id" | "receivedAt"> & Partial<Pick<StoredMail, "id" | "receivedAt">>,
  ) {
    const stored: StoredMail = {
      ...mail,
      id: mail.id ?? randomUUID(),
      receivedAt: mail.receivedAt ?? new Date().toISOString(),
    };
    this.mails.unshift(stored);
    if (this.mails.length > this.limit) this.mails.length = this.limit;
    if (this.dir) writeFileSync(this.fileFor(stored), JSON.stringify(stored, null, 2));
    return stored;
  }

  list(filter: OutboxFilter = {}): StoredMail[] {
    const to = filter.to?.toLowerCase();
    const subject = filter.subject?.toLowerCase();
    return this.mails.filter(
      (m) =>
        (!to || m.to.some((addr) => addr.toLowerCase().includes(to))) &&
        (!subject || m.subject.toLowerCase().includes(subject)),
    );
  }

  get(id: string): StoredMail | undefined {
    return this.mails.find((m) => m.id === id);
  }

  clear() {
    this.mails = [];
    if (this.dir && existsSync(this.dir)) rmSync(this.dir, { recursive: true, force: true });
    if (this.dir) mkdirSync(this.dir, { recursive: true });
  }

  get size() {
    return this.mails.length;
  }

  private fileFor(mail: StoredMail) {
    const stamp = mail.receivedAt.replace(/[:.]/g, "-");
    return path.join(this.dir!, `${stamp}-${mail.id}.json`);
  }

  private load() {
    const files = readdirSync(this.dir!)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, this.limit);
    for (const file of files) {
      try {
        this.mails.push(JSON.parse(readFileSync(path.join(this.dir!, file), "utf8")) as StoredMail);
      } catch {
        // skip unreadable files
      }
    }
  }
}
