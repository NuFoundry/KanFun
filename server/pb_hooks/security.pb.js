/// <reference path="../pb_data/types.d.ts" />
// Production hardening that PocketBase leaves off by default: per-IP rate limits and the header
// that carries the visitor's IP. Off in development so the e2e suite is never throttled.
//
// Caddy sets X-Real-IP to the visitor's address (deploy/Caddyfile) and overwrites any value a
// client sent. Requests from the services reach PocketBase inside the private network without it
// and count against their own address, which is why the catch-all limit applies to guests only.
// RATE_LIMITS=off turns the limits off (load tests); every rule is per IP.

onBootstrap((e) => {
  e.next();
  // The settings live in the database: a production backup restored locally would otherwise
  // keep throttling development and the e2e suite.
  if ($os.getenv("NODE_ENV") !== "production") {
    const current = e.app.settings();
    if (current.rateLimits.enabled) {
      current.rateLimits.enabled = false;
      e.app.save(current);
      console.log("[security] rate limits off outside production");
    }
    return;
  }

  const { problem, LOOKS_LIKE_PLACEHOLDER } = require(`${__hooks}/lib/internal-token.js`);
  const reason = problem($os.getenv("MAIL_INTERNAL_TOKEN"));
  if (reason) console.log(`[security] ${reason}: no email will be sent until it is fixed`);
  const admin = $os.getenv("PB_ADMIN_PASSWORD");
  if (admin && (LOOKS_LIKE_PLACEHOLDER.test(admin) || admin.length < 16)) {
    console.log("[security] PB_ADMIN_PASSWORD is a placeholder or short: set a long random one");
  }

  const per = (label, maxRequests, duration, audience) => ({
    label,
    maxRequests,
    duration,
    audience: audience || "",
  });
  const settings = e.app.settings();
  unmarshal(
    {
      trustedProxy: { headers: ["X-Real-IP"], useLeftmostIP: false },
      rateLimits: {
        enabled: $os.getenv("RATE_LIMITS") !== "off",
        rules: [
          // Password guessing: logins, and the superuser login inside the private network.
          per("*:auth", 10, 60),
          per("_superusers:auth", 5, 300),
          // Everything that sends an email to an address the caller chose.
          per("*:requestPasswordReset", 3, 60),
          per("*:requestVerification", 3, 60),
          per("*:requestEmailChange", 3, 60),
          per("*:requestOTP", 3, 60),
          per("*:confirmPasswordReset", 10, 60),
          per("*:confirmEmailChange", 10, 600),
          // Sign-ups, and password changes (they check oldPassword).
          per("users:create", 5, 60, "@guest"),
          per("users:update", 30, 600, "@auth"),
          // Two-factor routes check passwords and codes and send email codes (two-factor.pb.js).
          per("/api/two-factor/", 20, 60),
          // Bulk creation and anonymous traffic in general.
          per("*:create", 60, 60, "@auth"),
          per("/api/batch", 20, 10),
          per("/api/", 300, 10, "@guest"),
        ],
      },
    },
    settings,
  );
  e.app.save(settings);
  console.log("[security] trusted proxy header and rate limits are on");
});
