import type { APIRequestContext } from "@playwright/test";
import { expect, login, test } from "./fixtures";

// Account settings: edit first/last name (display name follows) and change the password.
test.describe("settings", () => {
  async function freshUser(request: APIRequestContext) {
    const email = `settings-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
    const res = await request.post("/api/collections/users/records", {
      data: {
        email,
        password: "password1234",
        passwordConfirm: "password1234",
        name: "Sam Settings",
      },
    });
    expect(res.ok()).toBeTruthy();
    return email;
  }

  test("the user menu leads to settings, where the name can be changed", async ({
    page,
    request,
  }) => {
    const email = await freshUser(request);
    await page.goto("/login");
    await login(page, email, "password1234");

    await page.getByTestId("user-menu").click();
    await page.getByTestId("settings-link").click();
    await expect(page).toHaveURL(/\/settings$/);

    const form = page.getByTestId("profile-form");
    await expect(form.getByLabel("First name")).toHaveValue("Sam");
    await expect(form.getByLabel("Last name")).toHaveValue("Settings");
    await form.getByLabel("First name").fill("Samira");
    await form.getByLabel("Last name").fill("Changed");
    await form.getByRole("button", { name: "Save profile" }).click();
    const saved = page.locator("[data-sonner-toast]").filter({ hasText: "Profile saved" });
    await expect(saved).toBeVisible();
    // Toasts stay clear of the header (the user menu) once they slid in, and close right away.
    const header = (await page.locator("header").boundingBox())!;
    await expect
      .poll(async () => (await saved.boundingBox())?.y ?? 0)
      .toBeGreaterThanOrEqual(header.y + header.height);
    await saved.getByRole("button", { name: "Close notification" }).click();
    await expect(saved).toHaveCount(0);

    await page.getByTestId("user-menu").click();
    await expect(page.getByTestId("user-name")).toHaveText("Samira Changed");
  });

  test("the password can be changed with the current one and works on the next login", async ({
    page,
    request,
  }) => {
    const email = await freshUser(request);
    await page.goto("/login");
    await login(page, email, "password1234");
    await page.goto("/settings");
    // The cookie banner sits over the bottom of the page where the submit button is.
    await page
      .getByTestId("consent-decline")
      .click({ timeout: 2000 })
      .catch(() => undefined);

    const form = page.getByTestId("password-form");
    await form.getByLabel("Current password").fill("wrong-password-1");
    await form.getByLabel("New password", { exact: true }).fill("new-password-5678");
    await form.getByLabel("Confirm new password").fill("new-password-5678");
    await form.getByRole("button", { name: "Change password" }).click();
    await expect(form.getByText(/old password/i)).toBeVisible();

    await form.getByLabel("Current password").fill("password1234");
    await form.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed")).toBeVisible();
    await expect(page.getByTestId("user-menu")).toBeVisible();

    await page.getByTestId("user-menu").click();
    await page.getByTestId("logout").click();
    await page.goto("/login");
    await login(page, email, "new-password-5678");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
