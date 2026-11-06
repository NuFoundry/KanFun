import nodemailer from "nodemailer";
import type { Outbox } from "./outbox";
import { toList, type MailProvider } from "./types";

/** No delivery: stores the message in the local outbox (dev, CI, e2e). */
export function createOutboxProvider(outbox: Outbox): MailProvider {
  return {
    name: "outbox",
    async send(message) {
      const stored = outbox.add({
        from: message.from,
        to: toList(message.to),
        subject: message.subject,
        text: message.text,
        html: message.html,
        source: message.origin ?? "api",
      });
      return { id: stored.id };
    },
  };
}

/** Resend HTTP API (https://resend.com/docs/api-reference/emails/send-email). */
export function createResendProvider(options: {
  apiKey: string;
  fetchImpl?: typeof fetch;
}): MailProvider {
  const doFetch = options.fetchImpl ?? fetch;
  return {
    name: "resend",
    async send(message) {
      const res = await doFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: message.from,
          to: toList(message.to),
          subject: message.subject,
          text: message.text,
          html: message.html,
          reply_to: message.replyTo,
        }),
      });
      if (!res.ok) {
        // The answer can quote addresses: it goes to the log, not into the error.
        console.error(
          `[mailer] Resend responded ${res.status}: ${(await res.text()).slice(0, 300)}`,
        );
        throw new Error(`Resend responded ${res.status}`);
      }
      const data = (await res.json()) as { id: string };
      return { id: data.id };
    },
  };
}

/**
 * Any SMTP relay (Lettermint, Postmark, Mailgun, Amazon SES, your own). With a login on port 587
 * the connection must upgrade to TLS (STARTTLS) before the password is sent.
 */
export function createSmtpProvider(options: {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  /** What the log and /mail/health report: "smtp" unless a named relay. */
  name?: string;
  /** Sent with every message, e.g. a relay's instructions (it removes them before delivery). */
  headers?: Record<string, string>;
}): MailProvider {
  const transport = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: options.secure,
    requireTLS: !options.secure && Boolean(options.user),
    auth: options.user ? { user: options.user, pass: options.pass ?? "" } : undefined,
  });
  return {
    name: options.name ?? "smtp",
    async send(message) {
      const info = await transport.sendMail({
        from: message.from,
        to: toList(message.to),
        subject: message.subject,
        text: message.text,
        html: message.html,
        replyTo: message.replyTo,
        headers: options.headers,
      });
      return { id: info.messageId };
    },
  };
}
