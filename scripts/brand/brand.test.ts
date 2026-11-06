// `node --test scripts/brand/*.test.ts` (part of `pnpm test`).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { APP_ICONS, brandSvgs, readMark, wordmark, type Brand } from "./brand.ts";
import { webTheme } from "./brand.ts";

const root = path.resolve(import.meta.dirname, "../..");
const brand = JSON.parse(
  fs.readFileSync(path.join(root, "corporate-identity/brand.json"), "utf8"),
) as Brand;
const mark = fs.readFileSync(path.join(root, "corporate-identity/logo/mark.svg"), "utf8");
const svg = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${inner}</svg>`;

test("the mark follows the conventions the build relies on", () => {
  assert.match(readMark(mark), /class="bg"/);
  assert.throws(() => readMark(mark.replace("0 0 24 24", "0 0 48 48")), /viewBox/);
  assert.throws(() => readMark(svg('<rect class="bg"/>')), /class="fg"/);
  assert.throws(() => readMark(svg('<rect class="bg"/><text class="fg">A</text>')), /shapes only/);
});

test("every version of the logo exists, the one-colour ones with the symbol cut out", () => {
  const svgs = brandSvgs(mark, brand);
  assert.deepEqual(Object.keys(svgs).sort(), [
    "icon.svg",
    "logo-black.svg",
    "logo-dark.svg",
    "logo-light.svg",
    "logo-white.svg",
    "mark-black.svg",
    "mark-white.svg",
    "mark.svg",
  ]);
  // Clear space of a quarter mark on every side: 240 + 2 × 60.
  assert.match(svgs["mark.svg"], /viewBox="0 0 360 360"/);
  assert.match(svgs["icon.svg"], /viewBox="0 0 240 240"/);
  assert.match(svgs["mark-black.svg"], /mask="url\(#cut\)"/);
  assert.match(svgs["mark-black.svg"], new RegExp(`fill="${brand.colors.ink}"`));
  assert.match(svgs["logo-light.svg"], /<path d="M[^"]+" fill="#ffffff"\/>/);
  // The wordmark is outlined: no text element, no font needed.
  for (const file of Object.values(svgs)) assert.doesNotMatch(file, /<text/);
});

test("the wordmark is the app name, kerned, and refuses letters Inter does not have", () => {
  const narrow = wordmark("Vibe", 600);
  const wide = wordmark("KanFun", 600);
  assert.ok(wide.width > narrow.width);
  assert.ok(wide.cap > 100 && wide.cap < 120);
  assert.throws(() => wordmark("应用", 600), /no glyph/);
});

test("app icons cover iOS (opaque, full bleed) and Android's maskable safe zone", () => {
  const apple = APP_ICONS.find((icon) => icon.file === "apple-touch-icon.png")!;
  assert.equal(apple.size, 180);
  assert.equal(apple.fill, true);
  const maskable = APP_ICONS.find((icon) => icon.file === "icon-maskable-512.png")!;
  assert.ok(maskable.mark <= 0.8);
});

test("the app's icons in client/public are the current build", () => {
  const favicon = fs.readFileSync(path.join(root, "client/public/favicon.svg"), "utf8");
  assert.equal(favicon, brandSvgs(mark, brand)["icon.svg"]);
});

// The logos spell the name and are redrawn by `pnpm brand` once the wizard has renamed the app;
// the icon and the colours do not depend on it.
test("the website's icon and colours are the current build", () => {
  const web = (file: string) => fs.readFileSync(path.join(root, "web", file), "utf8");
  assert.equal(web("public/favicon.svg"), brandSvgs(mark, brand)["icon.svg"]);
  assert.equal(web("src/styles/brand.css"), webTheme(brand));
  assert.match(webTheme(brand), /--color-brand-foreground: #ffffff;/);
});
