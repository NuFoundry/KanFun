/// <reference path="../pb_data/types.d.ts" />
// Two-factor sign-in, opt-in per user (Settings → Two-factor authentication).
//
// PocketBase's MFA runs the sign-in: for a user with `twoFactor` set, a password or OAuth sign-in
// answers 401 with an mfaId, and a second, different method completes it. The second step is
//  - "app":   a code from an authenticator app (TOTP) or a recovery code: POST /verify below.
//  - "email": PocketBase's one-time code (authWithOTP with the mfaId); /challenge sends it.
// PocketBase accepts any two different methods. The policy hook requires the user's own second
// factor, so an app user cannot fall back to an email code or a Google sign-in, and email codes
// are never a way to sign in on their own.
//
// Turning it on, off or renewing recovery codes needs the current password: a stolen session
// alone cannot lock the owner out or remove the second factor. Every route here is rate limited
// (security.pb.js); five wrong codes end the pending sign-in.

onRecordAuthRequest((e) => {
  const own = e.record.getString("twoFactor");
  if (e.authMethod === "otp" && own !== "email") {
    throw new BadRequestError("Sign in with your password.");
  }
  if (own && e.authMethod) {
    const info = e.requestInfo();
    const mfaId = String((info.query || {}).mfaId || (info.body || {}).mfaId || "");
    let first = "";
    try {
      if (mfaId) first = e.app.findMFAById(mfaId).method();
    } catch (_) {
      // Unknown or expired: PocketBase's own MFA check answers.
    }
    const allowed = own === "app" ? ["totp", "recovery"] : ["otp"];
    if (first && !allowed.includes(first) && !allowed.includes(e.authMethod)) {
      throw new BadRequestError("Use the second factor you set up.");
    }
  }
  e.next();
}, "users");

onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) require(`${__hooks}/lib/two-factor.js`).off(e.record);
  e.next();
}, "users");

// A superuser may still switch it off in the admin UI for someone who lost every factor.
onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) require(`${__hooks}/lib/two-factor.js`).keepStored(e.record);
  e.next();
}, "users");

routerAdd(
  "GET",
  "/api/two-factor",
  (e) => {
    const tf = require(`${__hooks}/lib/two-factor.js`);
    return e.json(200, tf.status(e.app.findRecordById("users", e.auth.id)));
  },
  $apis.requireAuth("users"),
);

routerAdd(
  "POST",
  "/api/two-factor/app/setup",
  (e) => {
    const { BASE32, otpauthUri } = require(`${__hooks}/lib/totp.js`);
    const record = e.app.findRecordById("users", e.auth.id);
    if (record.getString("twoFactor")) return e.json(409, { message: "Turn it off first." });
    const secret = $security.randomStringWithAlphabet(32, BASE32);
    record.set("totpPending", secret);
    e.app.save(record);
    const uri = otpauthUri(e.app.settings().meta.appName, record.email(), secret);
    return e.json(200, { secret, uri });
  },
  $apis.requireAuth("users"),
);

routerAdd(
  "POST",
  "/api/two-factor/app/enable",
  (e) => {
    const tf = require(`${__hooks}/lib/two-factor.js`);
    const { verify } = require(`${__hooks}/lib/totp.js`);
    const body = e.requestInfo().body;
    const record = e.app.findRecordById("users", e.auth.id);
    if (record.getString("twoFactor")) return e.json(409, { message: "Turn it off first." });
    if (!record.validatePassword(String(body.password || ""))) {
      return e.json(400, tf.problem("password", "Wrong password."));
    }
    const pending = record.getString("totpPending");
    const step = pending ? verify(pending, String(body.code || ""), Date.now(), 0) : -1;
    if (step < 0) return e.json(400, tf.problem("code", "Invalid code."));
    tf.off(record);
    record.set("twoFactor", "app");
    record.set("totpSecret", pending);
    record.set("totpLastStep", step);
    const recoveryCodes = tf.newRecoveryCodes(record);
    e.app.save(record);
    return e.json(200, { recoveryCodes });
  },
  $apis.requireAuth("users"),
);

routerAdd(
  "POST",
  "/api/two-factor/email/setup",
  (e) => {
    const tf = require(`${__hooks}/lib/two-factor.js`);
    const record = e.app.findRecordById("users", e.auth.id);
    if (record.getString("twoFactor")) return e.json(409, { message: "Turn it off first." });
    try {
      return e.json(200, { otpId: tf.sendCode(e.app, record) });
    } catch (err) {
      console.log("[two-factor] code email failed:", String(err));
      return e.json(503, { message: "The code could not be sent." });
    }
  },
  $apis.requireAuth("users"),
);

routerAdd(
  "POST",
  "/api/two-factor/email/enable",
  (e) => {
    const tf = require(`${__hooks}/lib/two-factor.js`);
    const body = e.requestInfo().body;
    const record = e.app.findRecordById("users", e.auth.id);
    if (record.getString("twoFactor")) return e.json(409, { message: "Turn it off first." });
    if (!record.validatePassword(String(body.password || ""))) {
      return e.json(400, tf.problem("password", "Wrong password."));
    }
    if (!tf.useEmailCode(e.app, record, body.otpId, body.code)) {
      return e.json(400, tf.problem("code", "Invalid code."));
    }
    tf.off(record);
    record.set("twoFactor", "email");
    e.app.save(record);
    return e.json(200, tf.status(record));
  },
  $apis.requireAuth("users"),
);

routerAdd(
  "POST",
  "/api/two-factor/disable",
  (e) => {
    const tf = require(`${__hooks}/lib/two-factor.js`);
    const record = e.app.findRecordById("users", e.auth.id);
    if (!record.validatePassword(String(e.requestInfo().body.password || ""))) {
      return e.json(400, tf.problem("password", "Wrong password."));
    }
    tf.off(record);
    e.app.save(record);
    return e.json(200, tf.status(record));
  },
  $apis.requireAuth("users"),
);

routerAdd(
  "POST",
  "/api/two-factor/recovery-codes",
  (e) => {
    const tf = require(`${__hooks}/lib/two-factor.js`);
    const record = e.app.findRecordById("users", e.auth.id);
    if (record.getString("twoFactor") !== "app") return e.json(409, { message: "Not in use." });
    if (!record.validatePassword(String(e.requestInfo().body.password || ""))) {
      return e.json(400, tf.problem("password", "Wrong password."));
    }
    const recoveryCodes = tf.newRecoveryCodes(record);
    e.app.save(record);
    return e.json(200, { recoveryCodes });
  },
  $apis.requireAuth("users"),
);

// The second step of a sign-in: which factor it needs. For email codes this sends one; the
// mfaId comes only from a correct first step, so nobody else can trigger the email.
routerAdd("POST", "/api/two-factor/challenge", (e) => {
  const tf = require(`${__hooks}/lib/two-factor.js`);
  const signIn = tf.findSignIn(e.app, e.requestInfo().body.mfaId);
  if (!signIn) return e.json(400, tf.problem("mfaId", "Sign in again."));
  const method = signIn.record.getString("twoFactor");
  if (method !== "email") return e.json(200, { method });
  try {
    return e.json(200, { method, otpId: tf.sendCode(e.app, signIn.record) });
  } catch (err) {
    console.log("[two-factor] code email failed:", String(err));
    return e.json(503, { message: "The code could not be sent." });
  }
});

// Completes a sign-in with an authenticator code or a recovery code. PocketBase's MFA check in
// recordAuthResponse reads the same mfaId from the body and ends the pending sign-in.
routerAdd("POST", "/api/two-factor/verify", (e) => {
  const tf = require(`${__hooks}/lib/two-factor.js`);
  const { verify } = require(`${__hooks}/lib/totp.js`);
  const body = e.requestInfo().body;
  const signIn = tf.findSignIn(e.app, body.mfaId);
  if (!signIn || signIn.record.getString("twoFactor") !== "app") {
    return e.json(400, tf.problem("mfaId", "Sign in again."));
  }
  const record = signIn.record;
  const code = String(body.code || "");
  let method = "";
  const step = verify(
    record.getString("totpSecret"),
    code,
    Date.now(),
    record.getInt("totpLastStep"),
  );
  if (step >= 0) {
    record.set("totpLastStep", step);
    method = "totp";
  } else if (tf.useRecoveryCode(record, code)) {
    method = "recovery";
  }
  if (!method) {
    const failures = record.getInt("totpFailures") + 1;
    record.set("totpFailures", failures >= tf.MAX_FAILURES ? 0 : failures);
    e.app.save(record);
    if (failures >= tf.MAX_FAILURES) {
      e.app.delete(signIn.mfa);
      return e.json(400, tf.problem("mfaId", "Too many wrong codes. Sign in again."));
    }
    return e.json(400, tf.problem("code", "Invalid code."));
  }
  record.set("totpFailures", 0);
  e.app.save(record);
  return $apis.recordAuthResponse(e, record, method, null);
});
