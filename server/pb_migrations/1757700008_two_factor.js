/// <reference path="../pb_data/types.d.ts" />
// Two-factor sign-in, opt-in per user (Settings → Two-factor authentication, two-factor.pb.js).
// PocketBase's MFA asks for a second method only where the rule matches, i.e. once a user turned
// it on. Email one-time codes are PocketBase's OTP, used only as that second step. Every field is
// hidden and set by the hook's routes alone: no API answer contains the secret or the codes, and
// a stolen session cannot switch two-factor off by updating its own record.
const FIELDS = [
  "twoFactor",
  "totpSecret",
  "totpPending",
  "totpLastStep",
  "totpFailures",
  "recoveryCodes",
];

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(
      new SelectField({ name: "twoFactor", values: ["app", "email"], maxSelect: 1, hidden: true }),
    );
    users.fields.add(new TextField({ name: "totpSecret", hidden: true, max: 64 }));
    users.fields.add(new TextField({ name: "totpPending", hidden: true, max: 64 }));
    users.fields.add(new NumberField({ name: "totpLastStep", hidden: true, onlyInt: true }));
    users.fields.add(new NumberField({ name: "totpFailures", hidden: true, onlyInt: true }));
    // sha256 of each unused recovery code.
    users.fields.add(new JSONField({ name: "recoveryCodes", hidden: true, maxSize: 2_000 }));

    unmarshal(
      {
        mfa: { enabled: true, duration: 1800, rule: "twoFactor != ''" },
        otp: { enabled: true, duration: 300, length: 6 },
      },
      users,
    );
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    for (const name of FIELDS) users.fields.removeByName(name);
    unmarshal({ mfa: { enabled: false, rule: "" }, otp: { enabled: false } }, users);
    app.save(users);
  },
);
