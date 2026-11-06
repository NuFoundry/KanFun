import { expect, login, test } from "./fixtures";

test.describe("i18n", () => {
  test("switches language and remembers it in the browser", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Latest posts" })).toBeVisible();

    await page.getByTestId("language").click();
    await page.getByTestId("language-de").click();
    await expect(page.getByRole("heading", { name: "Neueste Beiträge" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Neueste Beiträge" })).toBeVisible();
  });

  test("stores the language on the user and applies it on the next login", async ({
    page,
    request,
  }) => {
    // A dedicated user so the seeded ones keep their English UI for the other specs.
    const email = `i18n-${Date.now()}@example.com`;
    await request.post("/api/collections/users/records", {
      data: { email, password: "password1234", passwordConfirm: "password1234", name: "Ina" },
    });
    await login(page, email, "password1234");

    await page.getByTestId("language").click();
    await page.getByTestId("language-de").click();
    await expect(page.getByRole("heading", { name: "Deine Beiträge" })).toBeVisible();

    // Forget the browser preference and sign in again: the saved locale wins.
    await page.evaluate(() => localStorage.clear());
    await page.goto("/login");
    await login(page, email, "password1234");
    await expect(page.getByRole("heading", { name: "Deine Beiträge" })).toBeVisible();
  });
});
