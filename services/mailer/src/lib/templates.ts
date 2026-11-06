/**
 * Transactional email templates. Each template = zod schema for its data + a render function
 * returning subject, text and html. Keep them plain: short, one call to action, both formats.
 */
import { z } from "zod";

export type Rendered = { subject: string; text: string; html: string };

/** Languages emails can be rendered in. Keep in sync with client/src/i18n/index.ts. */
export const LOCALES = ["en", "de"] as const;

const base = z.object({
  appName: z.string().min(1),
  appUrl: z.string().min(1),
  locale: z.enum(LOCALES).default("en"),
});

/** Wording per language. Templates read `copy(data)` so English-only apps keep working. */
const COPY = {
  en: {
    welcomeSubject: (app: string) => `Welcome to ${app}`,
    greeting: (name?: string) => (name ? `Hi ${name},` : "Hi,"),
    thanks: (app: string, url: string) =>
      `Thanks for signing up for ${app}. You can log in any time at ${url}.`,
    thanksHtml: "Thanks for signing up. You can log in any time.",
    ignore: "If you did not create this account, you can ignore this email.",
    open: "Open the app",
    view: "View",
  },
  de: {
    welcomeSubject: (app: string) => `Willkommen bei ${app}`,
    greeting: (name?: string) => (name ? `Hallo ${name},` : "Hallo,"),
    thanks: (app: string, url: string) =>
      `Danke für deine Registrierung bei ${app}. Du kannst dich jederzeit unter ${url} anmelden.`,
    thanksHtml: "Danke für deine Registrierung. Du kannst dich jederzeit anmelden.",
    ignore: "Falls du dieses Konto nicht erstellt hast, kannst du diese E-Mail ignorieren.",
    open: "App öffnen",
    view: "Ansehen",
  },
};

function copy(data: object) {
  const locale = (data as { locale?: string }).locale ?? "en";
  return COPY[locale as keyof typeof COPY] ?? COPY.en;
}

/** Plain-text fallback for HTML-only messages (PocketBase renders HTML only). */
export function textFromHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Minimal responsive layout that renders well in every client. `body` must be HTML-safe. */
export function layout(appName: string, title: string, body: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f6f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f1f1f">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
    <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:10px;padding:32px">
      <tr><td style="font-size:14px;color:#777;padding-bottom:16px">${escapeHtml(appName)}</td></tr>
      <tr><td style="font-size:22px;font-weight:600;padding-bottom:16px">${escapeHtml(title)}</td></tr>
      <tr><td style="font-size:15px;line-height:1.6">${body}</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function button(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#1f1f1f;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${escapeHtml(label)}</a></p>`;
}

export const templates = {
  welcome: {
    schema: base.extend({ name: z.string().optional() }),
    render(data: z.infer<typeof base> & { name?: string }): Rendered {
      const c = copy(data);
      const greeting = c.greeting(data.name);
      const subject = c.welcomeSubject(data.appName);
      return {
        subject,
        text: `${greeting}\n\n${c.thanks(data.appName, data.appUrl)}\n\n${c.ignore}`,
        html: layout(
          data.appName,
          subject,
          `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(c.thanksHtml)}</p>${button(data.appUrl, c.open)}<p style="color:#777;font-size:13px">${escapeHtml(c.ignore)}</p>`,
        ),
      };
    },
  },
  notification: {
    schema: base.extend({
      title: z.string().min(1),
      message: z.string().min(1),
      actionUrl: z.string().optional(),
      actionLabel: z.string().optional(),
    }),
    render(
      data: z.infer<typeof base> & {
        title: string;
        message: string;
        actionUrl?: string;
        actionLabel?: string;
      },
    ): Rendered {
      const action = data.actionUrl
        ? button(data.actionUrl, data.actionLabel ?? copy(data).view)
        : "";
      return {
        subject: data.title,
        text: `${data.message}${data.actionUrl ? `\n\n${data.actionUrl}` : ""}`,
        html: layout(data.appName, data.title, `<p>${escapeHtml(data.message)}</p>${action}`),
      };
    },
  },
} as const;

export type TemplateName = keyof typeof templates;

export function isTemplateName(name: string): name is TemplateName {
  return Object.hasOwn(templates, name);
}

export function renderTemplate(name: TemplateName, data: unknown): Rendered {
  const template = templates[name];
  const parsed = template.schema.parse(data);
  // Each render() accepts exactly its schema's output; the cast keeps the union call site simple.
  return (template.render as (d: unknown) => Rendered)(parsed);
}
