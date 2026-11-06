/// <reference path="../../pb_data/types.d.ts" />
// The shared secret hooks send to the mailer (MAIL_INTERNAL_TOKEN). In development it falls back
// to the placeholder from .env.example; in production a missing, short or placeholder value is
// refused, so nothing is ever signed or sent with a value that sits in the repository.

const PLACEHOLDER = "dev-internal-token-change-me";
/** The example values in .env.example and deploy/.env.prod.example. */
const LOOKS_LIKE_PLACEHOLDER = /replace-with|change-?me|example/i;

/** Why the token is not fit for production, or "" when it is. */
function problem(token) {
  if (!token) return "MAIL_INTERNAL_TOKEN is not set";
  if (LOOKS_LIKE_PLACEHOLDER.test(token)) return "MAIL_INTERNAL_TOKEN is a placeholder";
  if (token.length < 32) return "MAIL_INTERNAL_TOKEN is shorter than 32 characters";
  return "";
}

function internalToken() {
  const token = $os.getenv("MAIL_INTERNAL_TOKEN");
  if ($os.getenv("NODE_ENV") !== "production") return token || PLACEHOLDER;
  const reason = problem(token);
  if (reason) throw new Error(`[security] ${reason}; generate one with: openssl rand -hex 32`);
  return token;
}

module.exports = { internalToken, problem, LOOKS_LIKE_PLACEHOLDER };
