// Codes from authenticator apps (TOTP, RFC 6238): Google and Microsoft Authenticator, 1Password,
// Bitwarden, Authy. Those apps only compute HMAC-SHA1 with 6 digits every 30 seconds, whatever an
// otpauth link asks for, and the hook runtime has no SHA-1, hence the implementation below.
// Pure functions (no PocketBase globals), so Jest tests them (totp.test.ts).

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD = 30;

function rotl(x, n) {
  return (x << n) | (x >>> (32 - n));
}

/** SHA-1 of a byte array, as a byte array. */
function sha1(bytes) {
  const bits = bytes.length * 8;
  const msg = bytes.slice();
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  for (let i = 7; i >= 0; i--) msg.push(i >= 4 ? 0 : (bits >>> (i * 8)) & 0xff);

  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Array(80);
  for (let off = 0; off < msg.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      w[i] = (msg[j] << 24) | (msg[j + 1] << 16) | (msg[j + 2] << 8) | msg[j + 3];
    }
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    for (let i = 0; i < 80; i++) {
      let f = b ^ c ^ d;
      let k = i < 40 ? 0x6ed9eba1 : 0xca62c1d6;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i >= 40 && i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      }
      const t = (rotl(a, 5) + f + e + k + w[i]) | 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = t;
    }
    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0;
  }
  const out = [];
  for (const word of h)
    out.push((word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff);
  return out;
}

function hmacSha1(key, message) {
  let k = key.length > 64 ? sha1(key) : key.slice();
  while (k.length < 64) k.push(0);
  const inner = sha1(k.map((b) => b ^ 0x36).concat(message));
  return sha1(k.map((b) => b ^ 0x5c).concat(inner));
}

/** Base32 (RFC 4648) to bytes; spaces, dashes, padding and case are ignored. */
function base32Decode(text) {
  const clean = String(text)
    .toUpperCase()
    .replace(/[\s=-]/g, "");
  const out = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = BASE32.indexOf(char);
    if (value < 0) throw new Error("invalid base32");
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >>> bits) & 0xff);
    }
  }
  return out;
}

/** The code for one 30-second step. */
function codeAt(secret, step, digits) {
  const n = digits || 6;
  const counter = [];
  const high = Math.floor(step / 0x100000000);
  for (let i = 3; i >= 0; i--) counter.push((high >>> (i * 8)) & 0xff);
  for (let i = 3; i >= 0; i--) counter.push((step >>> (i * 8)) & 0xff);
  const digest = hmacSha1(base32Decode(secret), counter);
  const o = digest[19] & 0xf;
  const value =
    ((digest[o] & 0x7f) << 24) | (digest[o + 1] << 16) | (digest[o + 2] << 8) | digest[o + 3];
  let code = String(value % Math.pow(10, n));
  while (code.length < n) code = "0" + code;
  return code;
}

function stepAt(nowMs) {
  return Math.floor(nowMs / 1000 / PERIOD);
}

/** Same length, same time: no early exit that would tell how many digits were right. */
function sameCode(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The step a code belongs to (the current one, or one before or after for clock drift), or -1.
 * Steps up to `lastStep` were used already: a code works once.
 */
function verify(secret, code, nowMs, lastStep) {
  const given = String(code).replace(/\s/g, "");
  if (!/^\d{6}$/.test(given)) return -1;
  const now = stepAt(nowMs);
  for (const step of [now - 1, now, now + 1]) {
    if (step > (lastStep || 0) && sameCode(codeAt(secret, step), given)) return step;
  }
  return -1;
}

/** What the QR code holds: the app shows "<issuer> (<account>)" and adds codes for it. */
function otpauthUri(issuer, account, secret) {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${PERIOD}`;
}

/** Recovery codes are typed by hand: compare without case, spaces or dashes. */
function normalizeRecoveryCode(code) {
  return String(code)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

module.exports = {
  BASE32,
  sha1,
  hmacSha1,
  base32Decode,
  codeAt,
  stepAt,
  verify,
  otpauthUri,
  normalizeRecoveryCode,
};
