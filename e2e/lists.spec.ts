import type { APIRequestContext } from "@playwright/test";
import { expect, login, test } from "./fixtures";

// Every list view sorts, filters and pages (AGENTS.md "Every list view"). The dashboard table
// and the home grid are the reference implementations; this spec drives both.
const PASSWORD = "password1234";

// Posts made by userWithPosts. They are deleted after each test: left behind, every run would
// add published posts until the seeded ones fall off the first page of the home grid.
const made: { token: string; ids: string[] }[] = [];
test.afterEach(async ({ request }) => {
  for (const { token, ids } of made.splice(0)) {
    for (const id of ids) {
      await request.delete(`/api/collections/posts/records/${id}`, {
        headers: { Authorization: token },
      });
    }
  }
});

/** A fresh user with 21 posts (5 published), created through the API. */
async function userWithPosts(request: APIRequestContext) {
  const email = `lists-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const created = await request.post("/api/collections/users/records", {
    data: { email, password: PASSWORD, passwordConfirm: PASSWORD, name: "Lisa Lists" },
  });
  expect(created.ok()).toBeTruthy();
  const auth = await request.post("/api/collections/users/auth-with-password", {
    data: { identity: email, password: PASSWORD },
  });
  const { token, record } = (await auth.json()) as { token: string; record: { id: string } };
  const stamp = Date.now().toString(36);
  const ids: string[] = [];
  made.push({ token, ids });
  for (let i = 1; i <= 21; i += 1) {
    const res = await request.post("/api/collections/posts/records", {
      headers: { Authorization: token },
      data: {
        title: `List post ${String(i).padStart(2, "0")} ${stamp}`,
        content: "Created by the lists spec.",
        published: i <= 5,
        author: record.id,
      },
    });
    expect(res.ok()).toBeTruthy();
    ids.push(((await res.json()) as { id: string }).id);
  }
  return { email, stamp };
}

test.describe("lists", () => {
  test("dashboard table pages, searches, filters and sorts", async ({ page, request }) => {
    const { email } = await userWithPosts(request);
    await login(page, email, PASSWORD);
    await page.goto("/dashboard");

    const rows = page.getByTestId("my-post-row");
    await expect(rows).toHaveCount(20);
    await expect(page.getByTestId("my-posts-showing")).toHaveText("Showing 1–20 of 21");

    await page.getByRole("link", { name: /next/i }).click();
    await expect(rows).toHaveCount(1);
    await expect(page).toHaveURL(/page=2/);

    await page.getByTestId("my-posts-search").fill("post 07");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("List post 07");
    await expect(page).not.toHaveURL(/page=/);

    await page.getByTestId("my-posts-search").fill("nothing like this");
    await expect(page.getByTestId("my-posts-empty")).toContainText("No matches");
    await page.getByTestId("my-posts-clear").click();
    await expect(rows).toHaveCount(20);

    await page.getByTestId("my-posts-status").click();
    await page.getByRole("option", { name: "Published" }).click();
    await expect(page.getByTestId("my-posts-showing")).toHaveText("Showing 1–5 of 5");
    await expect(page).toHaveURL(/status=true/);

    await page.getByTestId("sort-title").click();
    await expect(rows.first()).toContainText("List post 01");
    await expect(page).toHaveURL(/sort=title/);
    await page.getByTestId("sort-title").click();
    await expect(rows.first()).toContainText("List post 05");

    // Sitting on its own surface, not on the page background.
    await expect(page.getByTestId("my-posts")).toBeVisible();
  });

  test("home grid searches, sorts and pages", async ({ page, request }) => {
    const { stamp } = await userWithPosts(request);
    await page.goto("/");

    await page.getByTestId("posts-search").fill(stamp);
    const cards = page.getByTestId("post-card");
    await expect(cards).toHaveCount(5);
    await expect(page.getByTestId("posts-showing")).toHaveText("Showing 1–5 of 5");

    await page.getByTestId("posts-sort").click();
    await page.getByRole("option", { name: "Title Z–A" }).click();
    await expect(cards.first()).toContainText("List post 05");
    await expect(page).toHaveURL(/sort=-title/);

    await page.getByTestId("posts-sort").click();
    await page.getByRole("option", { name: "Title A–Z" }).click();
    await expect(cards.first()).toContainText("List post 01");

    await page.reload();
    await expect(page.getByTestId("posts-search")).toHaveValue(stamp);
    await expect(cards.first()).toContainText("List post 01");
  });
});
