/**
 * Dev inbox: reads the mailer's outbox (services/mailer, dev only). Every email the stack sends
 * in development lands there instead of being delivered.
 */
import { env } from "@/lib/env";

export type OutboxMail = {
  id: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  receivedAt: string;
  /** "pocketbase" (auth mails), a template name, or "api". */
  source: string;
};

export async function listOutbox(filter: { to?: string } = {}): Promise<OutboxMail[]> {
  const params = new URLSearchParams();
  if (filter.to) params.set("to", filter.to);
  const res = await fetch(`${env.mailUrl}/outbox?${params}`);
  if (!res.ok) throw new Error(`Outbox request failed (${res.status})`);
  return (await res.json()) as OutboxMail[];
}

export async function clearOutbox(): Promise<void> {
  const res = await fetch(`${env.mailUrl}/outbox`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Outbox request failed (${res.status})`);
}

/** Every link in the email (HTML hrefs first, then bare URLs in the text), without duplicates. */
export function linksIn(mail: Pick<OutboxMail, "html" | "text">): string[] {
  const found = [
    ...Array.from((mail.html ?? "").matchAll(/href="(https?:\/\/[^"]+)"/g), (m) => m[1]!),
    ...Array.from(mail.text.matchAll(/https?:\/\/[^\s<>"')]+/g), (m) => m[0]),
  ].map((url) => url.replace(/&amp;/g, "&").replace(/[.,;:!?)]+$/, ""));
  return Array.from(new Set(found));
}
