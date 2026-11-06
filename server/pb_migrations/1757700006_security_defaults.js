/// <reference path="../pb_data/types.d.ts" />
// Safer defaults found by security reviews of apps built on this template:
//  - A profile (name, avatar) is visible to its owner, and to everyone only while the user is the
//    author of a published post (expand: "author" on the home page). Before, any profile was
//    public by id.
//  - Accounts are not deleted through the API: PocketBase's default rule lets a user delete their
//    own record, which skips every cleanup (a running subscription keeps charging). Build an
//    account-deletion route when the app needs one (AGENTS.md, "Security rules").
//  - An update rule is checked against the stored record, so it has to stop the author from being
//    handed to someone else in the same request.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.viewRule =
      "id = @request.auth.id || (@collection.posts.author ?= id && @collection.posts.published ?= true)";
    users.deleteRule = null;
    app.save(users);

    const posts = app.findCollectionByNameOrId("posts");
    posts.updateRule =
      "author = @request.auth.id && (@request.body.author:isset = false || @request.body.author = @request.auth.id)";
    app.save(posts);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.viewRule = ""; // security-allow: down migration restores the old rule
    users.deleteRule = "id = @request.auth.id";
    app.save(users);

    const posts = app.findCollectionByNameOrId("posts");
    posts.updateRule = "author = @request.auth.id";
    app.save(posts);
  },
);
