import { expect, login, SEED, test } from "./fixtures";

test.describe("auth", () => {
  test("redirects anonymous users away from protected pages", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("logs in, lands on the dashboard, and logs out", async ({ page }) => {
    await login(page, SEED.alice.email);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Your posts" })).toBeVisible();

    await page.getByTestId("user-menu").click();
    await expect(page.getByTestId("user-name")).toHaveText(SEED.alice.name);
    await page.getByTestId("logout").click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("login-link")).toBeVisible();
  });

  test("rejects a wrong password", async ({ page }) => {
    await page.goto("/login");
    const form = page.getByTestId("login-form");
    await form.getByLabel("Email").fill(SEED.alice.email);
    await form.getByLabel("Password").fill("definitely-wrong");
    await form.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText(/failed to authenticate/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a link to /login?tab=register opens the sign-up form", async ({ page }) => {
    await page.goto("/login?tab=register");
    await expect(page.getByTestId("register-form")).toBeVisible();
  });

  test("registers a new account", async ({ page }) => {
    const email = `e2e-${Date.now()}@example.com`;
    await page.goto("/login");
    await page.getByTestId("tab-register").click();
    const form = page.getByTestId("register-form");
    await form.getByLabel("Name").fill("E2E User");
    await form.getByLabel("Email").fill(email);
    await form.getByLabel("Password").fill("password1234");
    await form.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Signed in as E2E User")).toBeVisible();
  });
});
