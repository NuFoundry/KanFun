import { expect, login, test, tokenFromMail, waitForMail } from "./fixtures";

// Every email goes through the mailer (PocketBase hands its auth mails over too) and lands in
// the dev outbox, which the dev inbox at /dev/mail shows.
test.describe("email", () => {
  test("signup sends a verification email, the welcome email only once verified", async ({
    page,
    request,
  }) => {
    const email = `verify-${Date.now()}@example.com`;
    const create = await request.post("/api/collections/users/records", {
      data: { email, password: "password1234", passwordConfirm: "password1234", name: "Vera" },
    });
    expect(create.ok()).toBeTruthy();

    const verification = await waitForMail(request, { to: email, subject: "verify" });
    expect(verification.source).toBe("pocketbase");
    // The link opens the app, never PocketBase's admin UI (not reachable in production).
    expect(`${verification.html}`).toContain("/auth/confirm-verification/");
    expect(`${verification.html}`).not.toContain("/_/");
    // The welcome email carries the typed name, so it waits for a confirmed address.
    const early = await request.get(`/mail/outbox?to=${encodeURIComponent(email)}&subject=welcome`);
    expect(await early.json()).toEqual([]);

    const token = tokenFromMail(verification, "confirm-verification");
    await page.goto(`/auth/confirm-verification/${token}`);
    await expect(page.getByTestId("confirm-verification")).toHaveAttribute("data-state", "done");

    const welcome = await waitForMail(request, { to: email, subject: "welcome" });
    expect(welcome.source).toBe("welcome");
    expect(welcome.text).toContain("Hi Vera,");

    await page.goto("/login");
    await login(page, email, "password1234");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("the dev inbox shows every email with its links", async ({ page, request }) => {
    const email = `inbox-${Date.now()}@example.com`;
    await request.post("/api/collections/users/records", {
      data: { email, password: "password1234", passwordConfirm: "password1234", name: "Ines" },
    });
    await waitForMail(request, { to: email, subject: "verify" });

    await page.goto("/dev/mail");
    await page.getByTestId("inbox-filter").fill(email);
    const list = page.getByTestId("inbox-list");
    await expect(list.getByRole("button", { name: /verify/i })).toBeVisible();

    await list.getByRole("button", { name: /verify/i }).click();
    await expect(list.getByRole("button", { name: /welcome/i })).toHaveCount(0);
    await expect(page.getByTestId("inbox-subject")).toContainText(/verify/i);
    await expect(page.getByTestId("inbox-preview")).toHaveAttribute(
      "srcdoc",
      /confirm-verification/,
    );
    await page.getByTestId("inbox-tab-links").click();
    await expect(
      page.getByTestId("inbox-links").getByRole("link", { name: /confirm-verification/ }),
    ).toBeVisible();
  });

  test("forgot password sends a reset link that works", async ({ page, request }) => {
    const email = `reset-${Date.now()}@example.com`;
    await request.post("/api/collections/users/records", {
      data: { email, password: "password1234", passwordConfirm: "password1234", name: "Rae" },
    });

    await page.goto("/login");
    await page.getByTestId("forgot-password").click();
    const form = page.getByTestId("reset-form");
    await form.getByLabel("Email").fill(email);
    await form.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/reset link is on its way/i)).toBeVisible();

    const mail = await waitForMail(request, { to: email, subject: "reset" });
    const token = tokenFromMail(mail, "confirm-password-reset");
    await page.goto(`/auth/confirm-password-reset/${token}`);
    const reset = page.getByTestId("new-password-form");
    await reset.getByLabel("New password", { exact: true }).fill("new-password-5678");
    await reset.getByLabel("Confirm new password").fill("new-password-5678");
    await reset.getByRole("button", { name: "Save password" }).click();
    await page.getByTestId("reset-to-login").click();

    await login(page, email, "new-password-5678");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
