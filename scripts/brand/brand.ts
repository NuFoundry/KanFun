/**
 * The brand's SVGs, built from corporate-identity/logo/mark.svg and corporate-identity/brand.json
 * (scripts/brand/build.ts writes them and renders the PNGs). Pure functions, so
 * `node --test scripts/brand` checks them without a browser.
 *
 * Construction, in M = the mark's edge (240 SVG units; the source mark is drawn on 24):
 *   wordmark     the app name in Inter at 0.62 M, tracking -2.5 %, converted to outlines
 *   alignment    the wordmark's cap height centred on the mark
 *   gap          0.30 M between mark and wordmark
 *   clear space  0.25 M on every side, part of the artboard
 */
import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";

export const M = 240;
const PAD = 0.25 * M;
const GAP = 0.3 * M;
const FONT_SIZE = 0.62 * M;
const TRACKING = -0.025;

export type Brand = {
  name: string;
  domain: string;
  colors: Record<"brand" | "brandForeground" | "ink" | "inkSoft" | "paper" | "night", string>;
  wordmarkWeight: number;
  copy: Record<string, { headline: string; tagline: string }>;
};

/** The mark's drawing (what is inside <svg>), checked against the conventions. */
export function readMark(svg: string): string {
  if (!/viewBox="0 0 24 24"/.test(svg)) throw new Error('mark.svg must use viewBox="0 0 24 24"');
  if (!/class="bg"/.test(svg) || !/class="fg"/.test(svg)) {
    throw new Error('mark.svg needs a shape with class="bg" and one with class="fg"');
  }
  if (/<(image|text|script|foreignObject)\b/.test(svg)) {
    throw new Error("mark.svg must be shapes only (no text, images or scripts)");
  }
  const inner = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(svg)?.[1];
  if (!inner) throw new Error("mark.svg is not an SVG");
  return inner.replace(/<!--[\s\S]*?-->/g, "").trim();
}

const document = (width: number, height: number, title: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(width)} ${round(height)}" ` +
  `width="${round(width)}" height="${round(height)}" role="img" aria-label="${escape(title)}">\n` +
  `  <title>${escape(title)}</title>\n${body}</svg>\n`;

const round = (n: number) => Math.round(n * 100) / 100;
const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The mark at (x, y), M wide, in its own colours. */
const placed = (inner: string, x: number, y: number, size = M) =>
  `  <g transform="translate(${round(x)} ${round(y)}) scale(${round(size / 24)})">\n    ${inner}\n  </g>\n`;

/**
 * The mark in one colour, its symbol cut out of the background (print, stamps, dark mode):
 * a mask turns every "bg" shape white and every "fg" shape black, whatever their own fills.
 */
function monoPlaced(inner: string, x: number, y: number, color: string, id: string) {
  return (
    `  <defs>\n    <style>#${id} .bg{fill:#fff;fill-opacity:1}#${id} .fg{fill:#000;fill-opacity:1}</style>\n` +
    `    <mask id="${id}" maskUnits="userSpaceOnUse" x="${round(x)}" y="${round(y)}" width="${M}" height="${M}">\n` +
    `    ${placed(inner, x, y)}    </mask>\n  </defs>\n` +
    `  <rect x="${round(x)}" y="${round(y)}" width="${M}" height="${M}" fill="${color}" mask="url(#${id})"/>\n`
  );
}

export type Wordmark = { d: string; width: number; cap: number };

/** The name in Inter, kerned and outlined, so the logo files need no font. */
export function wordmark(name: string, weight: number, x = 0, baseline = 0): Wordmark {
  const file = path.resolve(
    import.meta.dirname,
    `../../node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff`,
  );
  const buffer = fs.readFileSync(file);
  const font = opentype.parse(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  );
  // Glyph by glyph (kerning pairs, tracking): a wordmark needs no other OpenType features, and
  // opentype.js cannot apply all of Inter's.
  const scale = FONT_SIZE / font.unitsPerEm;
  const glyphs = [...name].map((char) => font.charToGlyph(char));
  const missing = [...name].filter((char, i) => char !== " " && glyphs[i]!.index === 0);
  if (missing.length) throw new Error(`Inter (latin) has no glyph for: ${missing.join(" ")}`);
  const parts: string[] = [];
  let cursor = 0;
  glyphs.forEach((glyph, i) => {
    parts.push(glyph.getPath(x + cursor, baseline, FONT_SIZE).toPathData(1));
    cursor += glyph.advanceWidth * scale;
    const next = glyphs[i + 1];
    if (next) cursor += font.getKerningValue(glyph, next) * scale + TRACKING * FONT_SIZE;
  });
  const d = parts.filter(Boolean).join(" ");
  const width = cursor;
  const cap =
    ((font.tables.os2 as { sCapHeight: number }).sCapHeight / font.unitsPerEm) * FONT_SIZE;
  return { d, width, cap };
}

/** Every SVG of the identity, by file name (corporate-identity/logo/svg). */
export function brandSvgs(markSvg: string, brand: Brand, words = wordmark) {
  const inner = readMark(markSvg);
  const { ink } = brand.colors;
  const white = "#ffffff";
  const size = M + 2 * PAD;
  const probe = words(brand.name, brand.wordmarkWeight);
  const textX = PAD + M + GAP;
  const baseline = PAD + M / 2 + probe.cap / 2;
  const text = words(brand.name, brand.wordmarkWeight, textX, baseline);
  const width = textX + text.width + PAD;
  const title = brand.name;
  const logo = (mark: string, color: string) =>
    document(width, size, title, mark + `  <path d="${text.d}" fill="${color}"/>\n`);
  return {
    "mark.svg": document(size, size, title, placed(inner, PAD, PAD)),
    "mark-black.svg": document(size, size, title, monoPlaced(inner, PAD, PAD, ink, "cut")),
    "mark-white.svg": document(size, size, title, monoPlaced(inner, PAD, PAD, white, "cut")),
    // Edge to edge, no clear space: app icons, avatars, stores that round the corners themselves.
    "icon.svg": document(M, M, title, placed(inner, 0, 0)),
    "logo-dark.svg": logo(placed(inner, PAD, PAD), ink),
    "logo-light.svg": logo(placed(inner, PAD, PAD), white),
    "logo-black.svg": logo(monoPlaced(inner, PAD, PAD, ink, "cut"), ink),
    "logo-white.svg": logo(monoPlaced(inner, PAD, PAD, white, "cut"), white),
  };
}

/** Logo PNGs: every SVG at these widths, transparent. */
export const PNG_WIDTHS = [2000, 1000, 500, 250];

/**
 * The app's own icons (client/public): the favicon, the home-screen icon iOS rounds itself (opaque,
 * full bleed), and the manifest's icons for Android and desktop (the maskable one keeps the mark in
 * the inner 80 % that every launcher shape shows).
 */
export const APP_ICONS = [
  { file: "apple-touch-icon.png", size: 180, mark: 1, fill: true },
  { file: "icon-192.png", size: 192, mark: 1, fill: false },
  { file: "icon-512.png", size: 512, mark: 1, fill: false },
  { file: "icon-maskable-512.png", size: 512, mark: 0.8, fill: true },
] as const;

/** Images per channel: [folder, name, width, height]. Text images exist once per copy language. */
export const SOCIAL = {
  avatars: [1080, 800, 400],
  banners: [
    // Link previews (Open Graph): Slack, WhatsApp, LinkedIn and X posts.
    { channel: "web", name: "og", w: 1200, h: 630, scale: 1.3 },
    // LinkedIn's logo covers the bottom left of a company cover, the photo that of a personal one.
    {
      channel: "linkedin",
      name: "company-cover",
      w: 2256,
      h: 382,
      scale: 1.16,
      safe: { w: 1400, h: 382 },
    },
    {
      channel: "linkedin",
      name: "personal-banner",
      w: 1584,
      h: 396,
      scale: 1,
      safe: { w: 1000, h: 396 },
    },
    { channel: "x", name: "header", w: 1500, h: 500, scale: 1.25 },
    { channel: "facebook", name: "cover", w: 1640, h: 624, scale: 1.45 },
    // YouTube shows only the middle 1546×423 on every device.
    {
      channel: "youtube",
      name: "banner",
      w: 2560,
      h: 1440,
      scale: 1.75,
      safe: { w: 1546, h: 423 },
    },
  ],
  posts: [
    { channel: "instagram", name: "post", w: 1080, h: 1080 },
    { channel: "instagram", name: "post", w: 1080, h: 1350 },
    { channel: "instagram", name: "story", w: 1080, h: 1920 },
  ],
} as const;

/** The website's colour tokens (web/src/styles/brand.css): Tailwind's @theme, kebab-cased. */
export function webTheme(brand: Brand): string {
  const tokens = Object.entries(brand.colors)
    .map(
      ([name, value]) =>
        `  --color-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${value};`,
    )
    .join("\n");
  return `/* Written by \`pnpm brand\` from corporate-identity/brand.json. Do not edit by hand. */\n@theme {\n${tokens}\n}\n`;
}
