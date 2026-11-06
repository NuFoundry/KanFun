/// <reference path="../pb_data/types.d.ts" />
// Server-side logic that must not live in the browser. Files here must end in `.pb.js`.
// Docs: https://pocketbase.io/docs/js-overview/
//
// Rules of thumb:
//  - Handlers run in isolated VMs: no top-level variables, use require() inside handlers.
//  - No async/await or Promises; the runtime is synchronous.
//  - Always call e.next() in event hooks.

// Auto-generate a URL slug for posts when the client doesn't provide one.
onRecordCreate((e) => {
  if (!e.record.get("slug")) {
    const { slugify } = require(`${__hooks}/lib/slug.js`);
    const suffix = $security.randomStringWithAlphabet(6, "abcdefghijklmnopqrstuvwxyz0123456789");
    e.record.set("slug", `${slugify(e.record.get("title"))}-${suffix}`);
  }
  e.next();
}, "posts");

// Example custom route: GET /api/app/info
routerAdd("GET", "/api/app/info", (e) => {
  return e.json(200, {
    name: "kan-fun",
    time: new Date().toISOString(),
    authenticated: !!e.auth,
  });
});
