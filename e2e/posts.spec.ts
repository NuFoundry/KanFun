import { expect, SEED, test } from "./fixtures";

test.describe("posts", () => {
  test("shows the author's drafts on the dashboard", async ({ authedPage: page }) => {
    await page.goto("/dashboard");
    const rows = page.getByTestId("my-post-row");
    await expect(rows.filter({ hasText: SEED.draftPostTitle })).toBeVisible();
  });

  test("creates, publishes and deletes a post", async ({ authedPage: page }) => {
    const title = `E2E post ${Date.now()}`;
    await page.goto("/dashboard");

    await page.getByTestId("new-post").click();
    const form = page.getByTestId("post-form");
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Content").fill("Written by Playwright.");
    await form.getByRole("button", { name: "Save" }).click();

    const row = page.getByTestId("my-post-row").filter({ hasText: title });
    await expect(row).toBeVisible();
    await expect(row.getByText("Draft")).toBeVisible();

    // Publish it and check it shows up on the public home page.
    await row.getByRole("switch", { name: `Publish ${title}` }).click();
    await expect(row.getByText("Draft")).toHaveCount(0);
    await page.goto("/");
    await expect(page.getByRole("link", { name: title })).toBeVisible();

    // Delete it again.
    await page.goto("/dashboard");
    await row.getByRole("button", { name: `Delete ${title}` }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(row).toHaveCount(0);
  });
});
