/// <reference path="../pb_data/types.d.ts" />
// Creates the `posts` collection. Run automatically on `pocketbase serve`.
// Docs: https://pocketbase.io/docs/js-migrations/
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    const posts = new Collection({
      type: "base",
      name: "posts",
      // Anyone can read published posts; authors can always read their own.
      listRule: "published = true || author = @request.auth.id",
      viewRule: "published = true || author = @request.auth.id",
      // Only signed-in users can create, and only as themselves.
      createRule: '@request.auth.id != "" && author = @request.auth.id',
      updateRule: "author = @request.auth.id",
      deleteRule: "author = @request.auth.id",
      fields: [
        { name: "title", type: "text", required: true, min: 1, max: 200 },
        {
          name: "slug",
          type: "text",
          required: true,
          min: 1,
          max: 200,
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        },
        { name: "content", type: "text", max: 20000 },
        { name: "published", type: "bool" },
        {
          name: "author",
          type: "relation",
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_posts_slug ON posts (slug)",
        "CREATE INDEX idx_posts_author ON posts (author)",
        "CREATE INDEX idx_posts_published_created ON posts (published, created)",
      ],
    });

    app.save(posts);
  },
  (app) => {
    const posts = app.findCollectionByNameOrId("posts");
    app.delete(posts);
  },
);
