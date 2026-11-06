/// <reference path="../pb_data/types.d.ts" />
// First and last name, editable on the settings page. `name` stays the display name (shown in the
// header, on posts and in emails); the client writes it as "first last" whenever either changes,
// so everything that reads `name` keeps working, including OAuth sign-ups that only fill `name`.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new TextField({ name: "firstName", max: 100 }));
    users.fields.add(new TextField({ name: "lastName", max: 100 }));
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("firstName");
    users.fields.removeByName("lastName");
    app.save(users);
  },
);
