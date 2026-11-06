export type MailMessage = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
  /** Who asked for the send (shown in the dev inbox): "pocketbase", a template name, "api". */
  origin?: string;
};

export type StoredMail = {
  id: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  receivedAt: string;
  /** Origin of the send: "pocketbase" (auth mails), a template name, or "api" (raw send). */
  source: string;
};

export interface MailProvider {
  readonly name: string;
  send(message: MailMessage & { from: string }): Promise<{ id: string }>;
}

export function toList(to: string | string[]): string[] {
  return (Array.isArray(to) ? to : [to]).map((s) => s.trim()).filter(Boolean);
}

/** Domains that can never receive mail (RFC 2606, RFC 6761): seed users, test fixtures. */
const RESERVED_DOMAIN = /(^|\.)(example\.(com|net|org)|example|test|invalid|localhost)$/i;

export function isReservedAddress(address: string): boolean {
  return RESERVED_DOMAIN.test(address.trim().split("@").pop() ?? "");
}
