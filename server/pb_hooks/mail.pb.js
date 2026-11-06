/// <reference path="../pb_data/types.d.ts" />
// Email wiring for PocketBase. The mailer service (services/mailer) is the only thing that
// delivers email; PocketBase never talks to an SMTP server itself.
//
//  1. On every start (onBootstrap), sync the app name, app URL and sender from the environment
//     (.env is the source of truth) so the links and the From header in auth emails are right.
//  2. Every email PocketBase renders (verification, password reset, email change, OTP) is handed
//     to the mailer through POST /mail/send instead of PocketBase's own SMTP client. The mailer
//     picks the provider (Lettermint, Resend, SMTP relay) or, in development, keeps the mail in its
//     outbox, which the dev inbox at <APP_URL>/dev/mail shows.
//  3. After a user signs up: send the verification email (not to accounts that arrive verified,
//     such as OAuth sign-ups). The "welcome" email follows only once the address is verified: it
//     carries the name the person typed, and mail with user text to an unconfirmed address makes
//     the app a spam and phishing relay. Both are best-effort; signup never fails because of mail.
//  4. The links in auth emails lead to the app's own pages (/auth/confirm-*), not to PocketBase's
//     admin UI under /_/, which is not reachable in production (deploy/Caddyfile).

onBootstrap((e) => {
  e.next(); // app + DB are ready after this
  const settings = e.app.settings();
  const env = (name, fallback) => $os.getenv(name) || fallback || "";
  const isProd = env("NODE_ENV") === "production";

  settings.meta.appName = env("APP_NAME", settings.meta.appName);
  // Links in auth emails point at the client (Vite in dev, Caddy in prod).
  settings.meta.appURL = env(
    "APP_URL",
    isProd ? settings.meta.appURL : `http://localhost:${env("CLIENT_PORT", "5173")}`,
  );

  // MAIL_FROM is "Name <address>" or just "address".
  const from = env("MAIL_FROM", `${settings.meta.appName} <no-reply@example.com>`);
  const match = /^(.*?)\s*<([^>]+)>$/.exec(from);
  if (match) {
    settings.meta.senderName = match[1] || settings.meta.appName;
    settings.meta.senderAddress = match[2];
  } else if (from) {
    settings.meta.senderAddress = from;
  }

  e.app.save(settings);

  // Point the auth email links at the client: {APP_URL}/_/#/auth/confirm-... -> /auth/confirm-...
  const users = e.app.findCollectionByNameOrId("users");
  let changed = false;
  for (const key of [
    "verificationTemplate",
    "resetPasswordTemplate",
    "confirmEmailChangeTemplate",
  ]) {
    const body = users[key].body;
    const fixed = body.split("/_/#/auth/").join("/auth/");
    if (fixed !== body) {
      users[key].body = fixed;
      changed = true;
    }
  }
  if (changed) e.app.save(users);

  const mailUrl = $os.getenv("MAIL_URL") || "http://127.0.0.1:8788";
  console.log(`[mail] auth emails are delivered by the mailer at ${mailUrl}`);
});

// Replaces PocketBase's SMTP client: hand the rendered message to the mailer. Not calling
// e.next() skips the default send. Errors propagate so PocketBase logs them
// ("Failed to send password reset email") instead of pretending the mail went out.
onMailerSend((e) => {
  const message = e.message;
  const to = (message.to || []).map((addr) => addr.address);
  const mailUrl = $os.getenv("MAIL_URL") || "http://127.0.0.1:8788";
  const { internalToken } = require(`${__hooks}/lib/internal-token.js`);
  const token = internalToken();
  const res = $http.send({
    url: `${mailUrl}/mail/send`,
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      to,
      subject: message.subject,
      text: message.text || undefined,
      html: message.html || undefined,
      origin: "pocketbase",
    }),
    timeout: 10,
  });
  if (res.statusCode >= 300) {
    throw new Error(`mailer responded ${res.statusCode}: ${String(res.raw).slice(0, 200)}`);
  }
});

onRecordAfterCreateSuccess((e) => {
  if (e.record.verified()) {
    const { sendWelcome } = require(`${__hooks}/lib/welcome.js`);
    sendWelcome(e.record);
  } else {
    try {
      $mails.sendRecordVerification(e.app, e.record);
    } catch (err) {
      console.log("[mail] verification email failed:", String(err));
    }
  }
  e.next();
}, "users");

onRecordConfirmVerificationRequest((e) => {
  e.next();
  const { sendWelcome } = require(`${__hooks}/lib/welcome.js`);
  sendWelcome(e.record);
}, "users");
