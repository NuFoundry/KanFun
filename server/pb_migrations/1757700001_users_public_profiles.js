/// <reference path="../pb_data/types.d.ts" />
// Let anyone view a single user record (name + avatar) so `expand: "author"` works on public
// posts. Emails stay hidden unless the user sets emailVisibility. Listing stays private.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.viewRule = ""; // security-allow: superseded by 1757700006_security_defaults.js
    users.listRule = "id = @request.auth.id";
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.viewRule = "id = @request.auth.id";
    users.listRule = "id = @request.auth.id";
    app.save(users);
  },
);
