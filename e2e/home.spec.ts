import { expect, SEED, test } from "./fixtures";

test.describe("home", () => {
  test("lists published posts and opens one", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Latest posts" })).toBeVisible();

    const cards = page.getByTestId("post-card");
    await expect(cards.first()).toBeVisible();
    await expect(page.getByText(SEED.publishedPostTitle)).toBeVisible();
    // Drafts never appear publicly.
    await expect(page.getByText(SEED.draftPostTitle)).toHaveCount(0);

    await page.getByRole("link", { name: SEED.publishedPostTitle }).click();
    await expect(page).toHaveURL(new RegExp(`/posts/${SEED.publishedPostSlug}$`));
    await expect(page.getByTestId("post-title")).toHaveText(SEED.publishedPostTitle);
    await expect(page.getByTestId("post-content")).not.toBeEmpty();
  });

  test("shows a 404 page for unknown routes", async ({ page }) => {
    await page.goto("/does-not-exist");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });
});
