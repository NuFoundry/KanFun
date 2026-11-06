/**
 * `pnpm brand`: every file of the brand, from corporate-identity/logo/mark.svg and
 * corporate-identity/brand.json. Rendered with the repo's Playwright Chromium and the Inter font
 * from node_modules, so the output does not depend on installed fonts. Never edit the output by hand.
 *
 *   corporate-identity/logo/svg/*.svg      mark, one-colour marks, app icon, four logos
 *   corporate-identity/logo/png/*-<w>.png  each SVG at 2000, 1000, 500 and 250 px, transparent
 *   corporate-identity/social/...          avatars, link preview, banners and posts per channel
 *   corporate-identity/stripe/...          Stripe's branding icon and logo (Stripe feature)
 *   client/public/                         favicon.svg, apple-touch-icon.png, icon-*.png
 *   web/public/, web/src/styles/brand.css  the website's logos, icons, link previews, colours
 *
 * `pnpm brand --preview` draws nothing of the above: it puts every draft mark in
 * corporate-identity/logo/drafts/*.svg on one sheet (drafts/preview.png) at 128, 48 and 16 px, on
 * light and dark, and as the full logo, to compare options before one becomes logo/mark.svg.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { APP_ICONS, brandSvgs, PNG_WIDTHS, readMark, SOCIAL, type Brand } from "./brand.ts";
import { LANGS } from "../../web/src/i18n.ts";
import { webTheme } from "./brand.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CI = path.join(ROOT, "corporate-identity");
const PUBLIC = path.join(ROOT, "client/public");
const brand = JSON.parse(fs.readFileSync(path.join(CI, "brand.json"), "utf8")) as Brand;
const markSource = fs.readFileSync(path.join(CI, "logo/mark.svg"), "utf8");
const mark = readMark(markSource);
const C = brand.colors;

const inter = (weight: number) =>
  fs
    .readFileSync(
      path.join(ROOT, `node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff2`),
    )
    .toString("base64");
const CSS = `
  @font-face { font-family: Inter; src: url(data:font/woff2;base64,${inter(400)}) format("woff2"); font-weight: 400; }
  @font-face { font-family: Inter; src: url(data:font/woff2;base64,${inter(brand.wordmarkWeight)}) format("woff2"); font-weight: ${brand.wordmarkWeight}; }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: Inter, sans-serif; color: ${C.ink}; -webkit-font-smoothing: antialiased; }
`;
const uri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
/** The mark's symbol alone, in one colour (a decorative band on banners). */
const symbol = (color: string) =>
  `<svg viewBox="0 0 24 24" style="width:100%;height:100%"><style>.bg{display:none}.fg{fill:${color};fill-opacity:1}</style>${mark}</svg>`;
/** The mark full bleed on its brand colour: corners never show (iOS and launchers round icons). */
const tile = (share: number) =>
  `<div style="width:100%;height:100%;background:${C.brand};display:grid;place-items:center">
     <svg viewBox="0 0 24 24" style="width:${share * 100}%;height:${share * 100}%">${mark}</svg></div>`;

async function shoot(
  page: Page,
  html: string,
  w: number,
  h: number,
  file: string,
  transparent = false,
) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(
    `<!doctype html><html><head><style>${CSS}</style></head><body style="width:${w}px;height:${h}px">${html}</body></html>`,
  );
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({
    path: file,
    omitBackground: transparent,
    clip: { x: 0, y: 0, width: w, height: h },
  });
}

/** Logo, headline and tagline on paper, the symbol large on the right; `safe` keeps text inside. */
function banner(
  lang: string,
  o: { w: number; h: number; scale: number; safe?: { w: number; h: number } },
  logo: string,
) {
  const t = brand.copy[lang]!;
  const s = o.scale;
  const safe = o.safe ?? { w: o.w, h: o.h };
  const band = o.safe && o.h > 1000 ? safe : { w: o.w, h: o.h };
  return `
  <div style="position:relative;width:${o.w}px;height:${o.h}px;background:${C.paper};overflow:hidden">
    <div style="position:absolute;right:${(o.w - band.w) / 2 - 0.12 * band.h}px;top:${(o.h - band.h) / 2 + 0.075 * band.h}px;width:${0.85 * band.h}px;height:${0.85 * band.h}px">${symbol(C.brand)}</div>
    <div style="position:absolute;left:${(o.w - safe.w) / 2}px;top:${(o.h - safe.h) / 2}px;width:${safe.w}px;height:${safe.h}px;display:flex;flex-direction:column;justify-content:center;padding:0 ${48 * s}px">
      <img src="${uri(logo)}" style="height:${46 * s}px;width:auto;align-self:flex-start;margin-left:${-11.5 * s}px">
      <h1 style="margin-top:${14 * s}px;max-width:${0.56 * safe.w}px;font-size:${44 * s}px;line-height:1.05;font-weight:${brand.wordmarkWeight};letter-spacing:-0.035em">${t.headline}</h1>
      <p style="margin-top:${14 * s}px;font-size:${17 * s}px;color:${C.inkSoft}">${t.tagline} · ${brand.domain}</p>
    </div>
  </div>`;
}

/** A square or tall post: the headline large, the logo at the bottom. */
function post(lang: string, w: number, h: number, logo: string) {
  const t = brand.copy[lang]!;
  const s = w / 1080;
  return `
  <div style="position:relative;width:${w}px;height:${h}px;background:${C.paper};overflow:hidden;padding:${96 * s}px;display:flex;flex-direction:column;justify-content:space-between">
    <div style="position:absolute;right:${-120 * s}px;top:${-60 * s}px;width:${640 * s}px;height:${640 * s}px">${symbol(C.brand)}</div>
    <div></div>
    <h1 style="position:relative;font-size:${104 * s}px;line-height:1.02;font-weight:${brand.wordmarkWeight};letter-spacing:-0.04em;max-width:${880 * s}px">${t.headline}</h1>
    <div style="display:flex;align-items:center;justify-content:space-between">
      <img src="${uri(logo)}" style="height:${84 * s}px;margin-left:${-21 * s}px">
      <span style="font-size:${30 * s}px;color:${C.inkSoft}">${brand.domain}</span>
    </div>
  </div>`;
}

const browser = await chromium.launch();
const page = await browser.newPage();

if (process.argv.includes("--preview")) {
  const drafts = path.join(CI, "logo/drafts");
  const files = fs.existsSync(drafts)
    ? fs.readdirSync(drafts).filter((f) => f.endsWith(".svg"))
    : [];
  if (!files.length)
    throw new Error("No drafts: put candidate marks in corporate-identity/logo/drafts/*.svg");
  const rows = files.map((file) => {
    const source = fs.readFileSync(path.join(drafts, file), "utf8");
    const draft = brandSvgs(source, brand);
    const at = (size: number, bg: string) =>
      `<div style="background:${bg};padding:16px;border-radius:12px;display:grid;place-items:center"><img src="${uri(draft["icon.svg"])}" style="width:${size}px;height:${size}px"></div>`;
    return `<div style="display:flex;align-items:center;gap:20px;padding:20px 0;border-bottom:1px solid #e2dfda">
      <div style="width:160px;font-size:15px;font-weight:600">${file}</div>
      ${at(128, C.paper)}${at(128, C.night)}${at(48, C.paper)}${at(16, C.paper)}
      <img src="${uri(draft["logo-dark.svg"])}" style="height:96px">
    </div>`;
  });
  const height = 40 + files.length * 201;
  await shoot(
    page,
    `<div style="padding:20px 32px;background:#fff">${rows.join("")}</div>`,
    1280,
    height,
    path.join(drafts, "preview.png"),
  );
  await browser.close();
  console.info(`✔ corporate-identity/logo/drafts/preview.png (${files.length} drafts)`);
  process.exit(0);
}

// 1. SVGs and their PNGs.
const svgs = brandSvgs(markSource, brand);
const svgDir = path.join(CI, "logo/svg");
fs.rmSync(svgDir, { recursive: true, force: true });
fs.rmSync(path.join(CI, "logo/png"), { recursive: true, force: true });
fs.mkdirSync(svgDir, { recursive: true });
for (const [file, svg] of Object.entries(svgs)) {
  fs.writeFileSync(path.join(svgDir, file), svg);
  const [, , vw, vh] = /viewBox="([^"]+)"/.exec(svg)![1]!.split(" ").map(Number);
  for (const width of PNG_WIDTHS) {
    const height = Math.round((width * vh!) / vw!);
    const png = path.join(CI, "logo/png", file.replace(/\.svg$/, `-${width}.png`));
    await shoot(
      page,
      `<img src="${uri(svg)}" style="display:block;width:${width}px;height:${height}px">`,
      width,
      height,
      png,
      true,
    );
  }
}

// 2. The app's icons.
fs.writeFileSync(path.join(PUBLIC, "favicon.svg"), svgs["icon.svg"]);
for (const icon of APP_ICONS) {
  const html = icon.fill
    ? tile(icon.mark)
    : `<img src="${uri(svgs["icon.svg"])}" style="display:block;width:100%;height:100%">`;
  await shoot(page, html, icon.size, icon.size, path.join(PUBLIC, icon.file), !icon.fill);
}

// 3. Social media: avatars (networks crop them to a circle), then text images per language.
const social = path.join(CI, "social");
fs.rmSync(social, { recursive: true, force: true });
for (const size of SOCIAL.avatars) {
  await shoot(page, tile(0.62), size, size, path.join(social, `avatar/avatar-${size}.png`));
}
for (const lang of Object.keys(brand.copy)) {
  for (const b of SOCIAL.banners) {
    const file = path.join(social, `${b.channel}/${b.name}-${b.w}x${b.h}-${lang}.png`);
    await shoot(page, banner(lang, b, svgs["logo-dark.svg"]), b.w, b.h, file);
  }
  for (const p of SOCIAL.posts) {
    const file = path.join(social, `${p.channel}/${p.name}-${p.w}x${p.h}-${lang}.png`);
    await shoot(page, post(lang, p.w, p.h, svgs["logo-dark.svg"]), p.w, p.h, file);
  }
}

// 5. The website: the same icons, the logo for light and dark backgrounds, a link preview per
// language and the colours as Tailwind tokens.
const web = path.join(ROOT, "web");
fs.writeFileSync(path.join(web, "public/favicon.svg"), svgs["icon.svg"]);
fs.copyFileSync(
  path.join(PUBLIC, "apple-touch-icon.png"),
  path.join(web, "public/apple-touch-icon.png"),
);
fs.writeFileSync(path.join(web, "public/logo.svg"), svgs["logo-dark.svg"]);
fs.writeFileSync(path.join(web, "public/logo-on-dark.svg"), svgs["logo-light.svg"]);
for (const lang of LANGS) {
  fs.copyFileSync(
    path.join(social, `web/og-1200x630-${lang}.png`),
    path.join(web, `public/og-${lang}.png`),
  );
}
fs.writeFileSync(path.join(web, "src/styles/brand.css"), webTheme(brand));

await browser.close();
console.info("✔ every brand file is up to date");
