/// <reference path="../pb_data/types.d.ts" />
// Preferred UI language per user. The client sets it when the user switches language; the mail
// hook uses it to pick the email template language. Keep the values in sync with
// client/src/i18n/index.ts.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new SelectField({ name: "locale", maxSelect: 1, values: ["en", "de"] }));
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("locale");
    app.save(users);
  },
);
