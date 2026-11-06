/// <reference path="../../pb_data/types.d.ts" />
// Helpers for two-factor.pb.js. Called from inside handlers, so PocketBase globals are fine here.

/** The fields only the routes in two-factor.pb.js (or a superuser) may change. */
const FIELDS = [
  "twoFactor",
  "totpSecret",
  "totpPending",
  "totpLastStep",
  "totpFailures",
  "recoveryCodes",
];
const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const MAX_FAILURES = 5;

/** A PocketBase-shaped validation error for one field, so the client marks that input. */
function problem(field, message) {
  return { status: 400, message, data: { [field]: { code: "invalid", message } } };
}

function status(record) {
  const method = record.getString("twoFactor");
  return { method, recoveryCodes: method === "app" ? recoveryHashes(record).length : 0 };
}

function off(record) {
  record.set("twoFactor", "");
  record.set("totpSecret", "");
  record.set("totpPending", "");
  record.set("totpLastStep", 0);
  record.set("totpFailures", 0);
  record.set("recoveryCodes", []);
}

/** Puts back what the stored record says: a user cannot write these fields through the API. */
function keepStored(record) {
  const stored = record.original();
  for (const field of FIELDS) record.set(field, stored.get(field));
}

function recoveryHashes(record) {
  try {
    const value = JSON.parse(record.getString("recoveryCodes") || "[]");
    return Array.isArray(value) ? value : [];
  } catch (_) {
    return [];
  }
}

/** Ten new one-time codes; only their hashes are stored. Returns the codes to show once. */
function newRecoveryCodes(record) {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    const raw = $security.randomStringWithAlphabet(10, RECOVERY_ALPHABET);
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  const { normalizeRecoveryCode } = require(`${__hooks}/lib/totp.js`);
  record.set(
    "recoveryCodes",
    codes.map((code) => $security.sha256(normalizeRecoveryCode(code))),
  );
  return codes;
}

/** Uses up a recovery code: true when it was one of the stored ones. */
function useRecoveryCode(record, code) {
  const { normalizeRecoveryCode } = require(`${__hooks}/lib/totp.js`);
  const normalized = normalizeRecoveryCode(code);
  if (normalized.length !== 10) return false;
  const hash = $security.sha256(normalized);
  const hashes = recoveryHashes(record);
  const index = hashes.findIndex((stored) => $security.equal(stored, hash));
  if (index < 0) return false;
  hashes.splice(index, 1);
  record.set("recoveryCodes", hashes);
  return true;
}

/**
 * Emails a one-time code to the user's own address (PocketBase's OTP, its template and the
 * mailer through onMailerSend). Returns the otpId the code is checked against.
 */
function sendCode(app, record) {
  const code = $security.randomStringWithAlphabet(record.collection().otp.length, "0123456789");
  const otp = new Record(app.findCollectionByNameOrId("_otps"));
  otp.set("collectionRef", record.collection().id);
  otp.set("recordRef", record.id);
  otp.set("sentTo", record.email());
  otp.setPassword(code);
  app.save(otp);
  $mails.sendRecordOTP(app, record, otp.id, code);
  return otp.id;
}

/** Checks (and uses up) an emailed code that belongs to this user. */
function useEmailCode(app, record, otpId, code) {
  let otp;
  try {
    otp = app.findOTPById(String(otpId || ""));
  } catch (_) {
    return false;
  }
  const ok =
    otp.recordRef() === record.id &&
    !otp.hasExpired(record.collection().otp.durationTime()) &&
    otp.validatePassword(String(code || "").trim());
  if (ok) app.delete(otp);
  return ok;
}

/** The pending sign-in an mfaId stands for, with its user, or null when it is gone or expired. */
function findSignIn(app, mfaId) {
  try {
    const users = app.findCollectionByNameOrId("users");
    const mfa = app.findMFAById(String(mfaId || ""));
    if (mfa.collectionRef() !== users.id || mfa.hasExpired(users.mfa.durationTime())) return null;
    return { mfa, record: app.findRecordById("users", mfa.recordRef()) };
  } catch (_) {
    return null;
  }
}

module.exports = {
  FIELDS,
  MAX_FAILURES,
  problem,
  status,
  off,
  keepStored,
  newRecoveryCodes,
  useRecoveryCode,
  sendCode,
  useEmailCode,
  findSignIn,
};
