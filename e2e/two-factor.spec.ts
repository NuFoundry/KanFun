import type { APIRequestContext, Page } from "@playwright/test";
import { expect, login, test, totpCode, waitForMail, type OutboxMail } from "./fixtures";

// Two-factor sign-in: an authenticator app (QR code + recovery codes) or codes by email, turned on
// in Settings and asked for after the password.

const PASSWORD = "password1234";

async function freshUser(request: APIRequestContext, prefix: string) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const res = await request.post("/api/collections/users/records", {
    data: { email, password: PASSWORD, passwordConfirm: PASSWORD, name: "Tess Factor" },
  });
  expect(res.ok()).toBeTruthy();
  return email;
}

async function signInUntilCode(page: Page, email: string) {
  await page.goto("/login");
  const form = page.getByTestId("login-form");
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(PASSWORD);
  await form.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByTestId("two-factor-challenge-form")).toBeVisible();
  await expect(page.getByTestId("user-menu")).toHaveCount(0);
}

async function logout(page: Page) {
  await page.getByTestId("user-menu").click();
  await page.getByTestId("logout").click();
  await expect(page.getByTestId("user-menu")).toHaveCount(0);
}

/** The newest one-time code email that is not one of `seen`. */
async function nextCode(request: APIRequestContext, email: string, seen: Set<string>) {
  let mail: OutboxMail | undefined;
  await expect
    .poll(async () => {
      mail = await waitForMail(request, { to: email, subject: "OTP" });
      return seen.has(mail.id) ? "" : mail.id;
    })
    .not.toBe("");
  seen.add(mail!.id);
  return /\b(\d{6})\b/.exec(mail!.text || mail!.html || "")![1]!;
}

test.describe("two-factor", () => {
  test("an authenticator app: QR code, sign-in with a code, a recovery code, turn off", async ({
    page,
    request,
  }) => {
    const email = await freshUser(request, "tfa-app");
    await login(page, email, PASSWORD);
    await page.goto("/settings");

    const card = page.getByTestId("two-factor");
    await expect(card.getByTestId("two-factor-off")).toBeVisible();
    await card.getByTestId("two-factor-setup-app").click();
    await expect(
      page.getByRole("img", { name: "QR code for your authenticator app" }),
    ).toBeVisible();
    const secret = (await page.getByTestId("two-factor-secret").innerText()).replace(/\s/g, "");
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);

    const setup = page.getByTestId("two-factor-app-form");
    await setup.getByLabel("Code").fill("000000");
    await setup.getByLabel("Current password").fill(PASSWORD);
    await setup.getByRole("button", { name: "Confirm" }).click();
    await expect(setup.getByText("That code is not right")).toBeVisible();
    await setup.getByLabel("Code").fill(totpCode(secret));
    await setup.getByRole("button", { name: "Confirm" }).click();

    const list = page.getByTestId("two-factor-codes").locator("li");
    await expect(list).toHaveCount(10);
    const codes = (await list.allInnerTexts()).map((code) => code.trim());
    await page.getByTestId("two-factor-codes-done").click();
    await expect(card.getByTestId("two-factor-method")).toHaveText("Authenticator app");
    await expect(card.getByTestId("two-factor-recovery-left")).toHaveText("10 recovery codes left");

    // The password alone no longer signs in. A code works once, so the sign-in uses the next one.
    await logout(page);
    await signInUntilCode(page, email);
    await page.getByLabel("Code").fill(totpCode(secret, 1));
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByTestId("user-menu")).toBeVisible();

    // A lost phone: one recovery code signs in, once.
    await logout(page);
    await signInUntilCode(page, email);
    await page.getByTestId("two-factor-use-recovery").click();
    await page.getByLabel("Recovery code").fill(codes[0]!.toUpperCase());
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByTestId("user-menu")).toBeVisible();
    await page.goto("/settings");
    await expect(card.getByTestId("two-factor-recovery-left")).toHaveText("9 recovery codes left");

    await card.getByTestId("two-factor-disable").click();
    const off = page.getByTestId("two-factor-disable-form");
    await off.getByLabel("Current password").fill(PASSWORD);
    await off.getByRole("button", { name: "Confirm" }).click();
    await expect(card.getByTestId("two-factor-off")).toBeVisible();
    await logout(page);
    await login(page, email, PASSWORD);
  });

  test("codes by email: confirmed with a mailed code, asked for after the password", async ({
    page,
    request,
  }) => {
    const email = await freshUser(request, "tfa-mail");
    const seen = new Set<string>();
    await login(page, email, PASSWORD);
    await page.goto("/settings");

    await page.getByTestId("two-factor-setup-email").click();
    const setup = page.getByTestId("two-factor-email-form");
    await setup.getByLabel("Code").fill(await nextCode(request, email, seen));
    await setup.getByLabel("Current password").fill(PASSWORD);
    await setup.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByTestId("two-factor-method")).toHaveText("Codes by email");

    await logout(page);
    await signInUntilCode(page, email);
    await expect(page.getByText("We emailed you a 6-digit code")).toBeVisible();
    await page.getByLabel("Code").fill(await nextCode(request, email, seen));
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByTestId("user-menu")).toBeVisible();
  });
});
