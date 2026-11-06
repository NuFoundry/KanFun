/**
 * The form of a URL that may leave the browser (analytics, error reports): no query, no hash,
 * record ids and tokens replaced. Lists keep search text in the query (?q=<a customer name>),
 * detail pages carry record ids, and auth links carry one-time tokens; none of that is a third
 * party's business.
 *
 *   https://app.example.com/posts/abc123def456ghi?q=Smith -> https://app.example.com/posts/:id
 *   /auth/confirm-password-reset/eyJhbGciOi.eyJpZCI6.sig   -> /auth/confirm-password-reset/:token
 */

/** PocketBase record ids: 15 lowercase letters and digits. */
const RECORD_ID = /^[a-z0-9]{15}$/;
/** JWTs (a.b.c), and long strings with capitals or underscores (keys); slugs are lower case. */
const TOKEN = /^[\w-]+\.[\w.-]+$|^(?=[\w-]*[A-Z_])[\w-]{24,}$/;

function redactPath(path: string): string {
  return path
    .split("/")
    .map((segment) => (RECORD_ID.test(segment) ? ":id" : TOKEN.test(segment) ? ":token" : segment))
    .join("/");
}

/** Absolute URLs stay absolute (same origin), relative ones stay relative. */
export function redactUrl(url: string): string {
  if (!url) return url;
  const absolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
  try {
    const parsed = new URL(url, "http://relative.invalid");
    const path = redactPath(parsed.pathname);
    return absolute ? `${parsed.origin}${path}` : path;
  } catch {
    return "";
  }
}
