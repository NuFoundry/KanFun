import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";

// The website (web/): the landing page, its way into the app, the legal pages and the languages.
// playwright.config.ts starts `astro dev` on WEB_PORT with the app under test as PUBLIC_APP_URL.
const web = `http://localhost:${process.env.WEB_PORT || 4321}`;
const brand = JSON.parse(readFileSync("corporate-identity/brand.json", "utf8")) as {
  name: string;
  copy: Record<string, { headline: string; tagline: string }>;
};

test.describe("website", () => {
  test("the home page carries the brand's claims and a way into the app", async ({ page }) => {
    await page.goto(`${web}/`);
    await expect(page).toHaveTitle(new RegExp(brand.name));
    await expect(page.getByTestId("web-headline")).toHaveText(brand.copy.en!.headline);
    await expect(page.getByText(brand.copy.en!.tagline).first()).toBeVisible();
    await expect(page.getByTestId("web-logo").getByRole("img")).toHaveAttribute("alt", brand.name);

    await page.getByTestId("web-faq").first().locator("summary").click();
    await expect(page.getByTestId("web-faq").first()).toHaveAttribute("open", "");

    // Sign-up opens the app's registration form.
    await page.getByTestId("web-hero-signup").click();
    await expect(page).toHaveURL(/\/login\?tab=register$/);
    await expect(page.getByTestId("register-form")).toBeVisible();
  });

  test("imprint, privacy policy, robots.txt, sitemap and the 404 page", async ({ page }) => {
    await page.goto(`${web}/`);
    await page.getByTestId("web-imprint").click();
    await expect(page.getByTestId("web-imprint-page")).toBeVisible();
    await page.getByTestId("web-privacy").click();
    await expect(page.getByTestId("web-privacy-page")).toBeVisible();

    const robots = await page.request.get(`${web}/robots.txt`);
    expect(await robots.text()).toContain("User-agent: *");
    const sitemap = await (await page.request.get(`${web}/sitemap.xml`)).text();
    expect(sitemap).toContain("/privacy</loc>");

    const missing = await page.goto(`${web}/no-such-page`);
    expect(missing?.status()).toBe(404);
  });

  test("German lives under /de with its own pages and a switch back", async ({ page }) => {
    await page.goto(`${web}/`);
    await page.getByTestId("web-lang-de").click();
    await expect(page).toHaveURL(`${web}/de/`);
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expect(page.getByTestId("web-headline")).toHaveText(brand.copy.de!.headline);
    await page.getByTestId("web-imprint").click();
    await expect(page).toHaveURL(`${web}/de/impressum`);
    await page.getByTestId("web-lang-en").click();
    await expect(page).toHaveURL(`${web}/imprint`);
  });
});
