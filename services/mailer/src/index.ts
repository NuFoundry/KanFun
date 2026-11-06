import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { isDevTools, lettermintOptions, loadEnv, resolveProvider } from "./env";
import { Outbox } from "./lib/outbox";
import { createOutboxProvider, createResendProvider, createSmtpProvider } from "./lib/providers";
import type { MailProvider } from "./lib/types";

const env = loadEnv();
const devTools = isDevTools(env);
const outbox = new Outbox(devTools && env.MAIL_OUTBOX_DIR ? env.MAIL_OUTBOX_DIR : undefined);

let provider: MailProvider;
switch (resolveProvider(env)) {
  case "lettermint":
    provider = createSmtpProvider(lettermintOptions(env));
    break;
  case "resend":
    provider = createResendProvider({ apiKey: env.RESEND_API_KEY! });
    break;
  case "smtp":
    provider = createSmtpProvider({
      host: env.SMTP_HOST!,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    });
    break;
  default:
    provider = createOutboxProvider(outbox);
    if (env.NODE_ENV === "production") {
      console.warn(
        "[mailer] No LETTERMINT_TOKEN, RESEND_API_KEY or SMTP_HOST: emails are NOT delivered.",
      );
    }
}

const app = createApp({
  provider,
  outbox,
  internalToken: env.MAIL_INTERNAL_TOKEN,
  from: env.MAIL_FROM,
  appName: env.APP_NAME,
  appUrl: env.APP_URL,
  devTools,
});

const server = serve({ fetch: app.fetch, hostname: env.MAIL_HOST, port: env.MAIL_PORT }, (info) => {
  console.info(
    `[mailer] listening on http://${info.address}:${info.port}/mail (provider: ${provider.name})`,
  );
  if (devTools) console.info(`[mailer] dev inbox: ${env.APP_URL}/dev/mail`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
    process.exit(0);
  });
}
