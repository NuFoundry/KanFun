/// <reference path="../pb_data/types.d.ts" />
// Assistant conversations: one record per chat with its messages ([{ role, content }], newest
// last), private to the user who had it.
const OWNER = '@request.auth.id != "" && user = @request.auth.id';
const KEEP_USER = "(@request.body.user:isset = false || @request.body.user = user)";

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const conversations = new Collection({
      type: "base",
      name: "conversations",
      listRule: OWNER,
      viewRule: OWNER,
      createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
      updateRule: `${OWNER} && ${KEEP_USER}`,
      deleteRule: OWNER,
      fields: [
        {
          name: "user",
          type: "relation",
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: "title", type: "text", max: 200 },
        { name: "messages", type: "json", maxSize: 2 * 1024 * 1024 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_conversations_user ON conversations (user, updated)"],
    });
    app.save(conversations);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("conversations"));
  },
);
