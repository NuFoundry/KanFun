import { expect, test } from "./fixtures";

// The app on a phone's home screen. iOS draws it edge to edge (viewport-fit=cover), so everything
// that touches an edge pads by the safe-area insets. Chromium can pretend to have them: an iPhone
// with a Dynamic Island reports 59 px at the top and 34 px at the bottom.
const INSETS = { top: 59, bottom: 34, left: 0, right: 0 };

test.describe("pwa", () => {
  test("on a phone, nothing sits under the Dynamic Island or the home indicator", async ({
    authedPage: page,
  }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets: INSETS } as never);
    await page.goto("/dashboard");

    const header = page.locator("header").first();
    await expect(header).toHaveCSS("padding-top", `${INSETS.top}px`);
    const brand = (await page.getByTestId("brand").boundingBox())!;
    expect(brand.y).toBeGreaterThanOrEqual(INSETS.top);
    const footer = page.locator("footer");
    await expect(footer).toHaveCSS("padding-bottom", `${INSETS.bottom}px`);

    // The links live in a menu on phones; it clears the island too.
    await page.getByTestId("nav-menu").click();
    const sheet = page.getByTestId("nav-sheet");
    await expect(sheet).toBeVisible();
    expect((await sheet.boundingBox())!.y).toBeGreaterThanOrEqual(INSETS.top);
    await sheet.getByRole("link", { name: "Dashboard" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("the home-screen tags and the theme colour follow the theme", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      "href",
      "/apple-touch-icon.png",
    );
    const color = page.locator('meta[name="theme-color"]');
    await expect(color).toHaveAttribute("content", "#fbfaf8");
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(color).toHaveAttribute("content", "#0b0a09");
  });
});
