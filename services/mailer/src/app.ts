import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { Outbox } from "./lib/outbox";
import { isTemplateName, renderTemplate, textFromHtml } from "./lib/templates";
import { isReservedAddress, toList, type MailProvider } from "./lib/types";

export type AppDeps = {
  provider: MailProvider;
  outbox: Outbox;
  internalToken: string;
  from: string;
  appName: string;
  appUrl: string;
  /** Exposes the outbox endpoints for the dev inbox (never in production). */
  devTools: boolean;
  /** Called with unexpected errors (e.g. Sentry.captureException). */
  reportError?: (error: unknown) => void;
};

const recipient = z.union([z.email(), z.array(z.email()).min(1).max(50)]);

const sendSchema = z
  .object({
    to: recipient,
    subject: z.string().min(1).max(300).optional(),
    text: z.string().min(1).max(100_000).optional(),
    html: z.string().max(500_000).optional(),
    replyTo: z.email().optional(),
    template: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    /** Shown in the dev inbox; PocketBase sends "pocketbase". Defaults to the template name. */
    origin: z.string().max(40).optional(),
  })
  .refine((v) => v.template || (v.subject && (v.text || v.html)), {
    message: "Provide either `template` (+ `data`) or `subject` and `text`/`html`",
  });

/** Compares the bearer token in constant time, so its length and bytes cannot be timed. */
export function sameToken(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createApp(deps: AppDeps) {
  const app = new Hono();

  app.get("/mail/health", (c) =>
    c.json({ ok: true, provider: deps.provider.name, devTools: deps.devTools }),
  );

  // Templates and HTML are small; attachments are not part of this API.
  const sendLimit = bodyLimit({
    maxSize: 1024 * 1024,
    onError: (c) => c.json({ error: "Request too large" }, 413),
  });

  app.post("/mail/send", sendLimit, async (c) => {
    const header = c.req.header("Authorization") ?? "";
    const token = header.replace(/^Bearer\s+/i, "").trim();
    if (!token || !sameToken(token, deps.internalToken)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    let json: unknown;
    try {
      json = await c.req.json();
    } catch {
      return c.json({ error: "Body must be JSON" }, 400);
    }
    const parsed = sendSchema.safeParse(json);
    if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400);
    const body = parsed.data;

    let subject = body.subject ?? "";
    let text = body.text ?? (body.html ? textFromHtml(body.html) : "");
    let html = body.html;
    if (body.template) {
      if (!isTemplateName(body.template)) {
        return c.json({ error: `Unknown template "${body.template}"` }, 400);
      }
      try {
        const rendered = renderTemplate(body.template, {
          appName: deps.appName,
          appUrl: deps.appUrl,
          ...(body.data ?? {}),
        });
        subject = body.subject ?? rendered.subject;
        text = rendered.text;
        html = rendered.html;
      } catch (error) {
        const message = error instanceof z.ZodError ? z.prettifyError(error) : String(error);
        return c.json({ error: `Invalid template data: ${message}` }, 400);
      }
    }

    // Reserved domains (seed users, fixtures) never receive mail: a real provider would only
    // bounce them and lose the sender's reputation. The outbox keeps them for the dev inbox.
    let to = toList(body.to);
    if (deps.provider.name !== "outbox") to = to.filter((a) => !isReservedAddress(a));
    if (to.length === 0) {
      console.info("[mailer] skipped a message: every address is on a reserved domain");
      return c.json({ id: "", provider: deps.provider.name, skipped: true });
    }

    const { id } = await deps.provider.send({
      from: deps.from,
      to,
      subject,
      text,
      html,
      replyTo: body.replyTo,
      origin: body.origin ?? body.template,
    });
    return c.json({ id, provider: deps.provider.name });
  });

  if (deps.devTools) {
    app.get("/mail/outbox", (c) => {
      const list = deps.outbox.list({ to: c.req.query("to"), subject: c.req.query("subject") });
      return c.json(list);
    });
    app.delete("/mail/outbox", (c) => {
      deps.outbox.clear();
      return c.body(null, 204);
    });
    app.get("/mail/outbox/:id", (c) => {
      const mail = deps.outbox.get(c.req.param("id"));
      return mail ? c.json(mail) : c.json({ error: "Not found" }, 404);
    });
  }

  app.notFound((c) => c.json({ error: "Not found" }, 404));
  app.onError((error, c) => {
    console.error(error);
    deps.reportError?.(error);
    // Provider messages (account ids, quota details) stay in the log and the error report.
    return c.json({ error: "Internal error" }, 500);
  });

  return app;
}
