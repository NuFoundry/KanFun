---
name: brand
description: Creates or changes the app's logo, mark, brand colours and every file derived from them - logo versions in SVG and PNG, the favicon and app icons (iOS home screen, Android, PWA), social media avatars and banners, the link preview image and Stripe's branding files - all from one source in corporate-identity/. Use when the user says "create a logo", "a logo like ...", "change the brand colour", "rename the app", or needs a favicon, app icon, profile picture, banner, Open Graph image or Stripe logo.
---

# Brand

Everything visual about the app comes from two files, and one command draws the rest:

| Source                             | What it is                                                     |
| ---------------------------------- | -------------------------------------------------------------- |
| `corporate-identity/logo/mark.svg` | the mark, drawn on a 24-unit grid: the one thing you design    |
| `corporate-identity/brand.json`    | name, domain, colours, wordmark weight, copy for banners/posts |

`pnpm brand` writes every logo version, all PNG sizes, the app's icons in `client/public`, the social
images and the Stripe files (`scripts/brand/build.ts`). Never edit a generated file by hand, and never
put a logo anywhere else: `corporate-identity/README.md` is the brand guide people and platforms take
files from.

## 1. Understand the brief

"A logo like X" asks for X's spirit (geometric, playful, serious, a monogram, an object), never a copy:
do not reproduce another company's logo, symbol or trademark, and say so if the brief asks for one.
If the brief leaves the idea open, read `strategy/00-direction.md` when it exists (the positioning
says what the app should feel like), then ask at most two short questions (what the app does or
should feel like; a colour preference). Otherwise go.

## 2. Draw two or three marks

Put candidates in `corporate-identity/logo/drafts/<idea>.svg` (git-ignored), each following the
conventions the build checks (`readMark` in `scripts/brand/brand.ts`):

- `viewBox="0 0 24 24"`; shapes only (`path`, `rect`, `circle`, `polygon`, `g`), no text, images or
  scripts.
- One shape with `class="bg"`: the field, usually `<rect class="bg" width="24" height="24" rx="6"
fill="<brand>"/>`. Shapes with `class="fg"`: the symbol, in `brandForeground`. The one-colour
  versions cut the symbol out of the field by these classes.
- It must read at 16 px: one idea, at most three shapes, nothing thinner than 2 units, the symbol
  inside 4–20 units with optical balance (centre by eye, not only by maths).
- No letters unless the idea is a monogram; then draw the letter as a shape.

`pnpm brand --preview` puts every draft on one sheet, `corporate-identity/logo/drafts/preview.png`:
128 px on light and dark, 48 and 16 px, and the full logo with the name. Look at it yourself, fix
what falls apart small, then show the user the sheet and let them pick (or iterate).

## 3. Make it the brand

1. Copy the chosen draft to `corporate-identity/logo/mark.svg` (keep its comment header).
2. Colours: `brand.json` → `colors` (hex) and the tokens in `client/src/styles.css`, in OKLCH:
   `--brand` and `--brand-foreground` for light and for `.dark` (dark mode takes a lighter brand
   colour). White on the brand colour needs 3:1 contrast for the mark and 4.5:1 for small text on
   buttons; pick a deeper shade for text if it does not reach it.
3. Name: `brand.json` → `name`, and where the app shows it: `VITE_APP_NAME` / `APP_NAME` in `.env`,
   `.env.example` and `deploy/.env.*`, `<title>` and `apple-mobile-web-app-title` in
   `client/index.html`. The wordmark refuses letters Inter's latin set lacks.
4. Banner copy: `brand.json` → `copy` (a headline and a tagline per language the app speaks).
5. `pnpm brand`, then look at `logo/png/logo-dark-1000.png`, `logo/png/icon-250.png`,
   `client/public/apple-touch-icon.png` and `social/web/og-1200x630-en.png`.
6. Update `corporate-identity/README.md`: what the mark shows and why, the colour table.
7. `pnpm check` (it checks that `client/public/favicon.svg` is the current build) and commit the
   source together with everything it generated.

## What exists afterwards (tell the user where)

| Need                                   | File                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Logo on light / dark backgrounds       | `logo/svg/logo-dark.svg` / `logo-light.svg`, PNG at 2000–250 px                                   |
| One colour (print, stamps, embossing)  | `logo/svg/logo-black.svg` / `logo-white.svg`, `mark-black/-white`                                 |
| The mark alone (small spaces)          | `logo/svg/mark.svg` (with clear space), `icon.svg` (edge to edge)                                 |
| Favicon, iOS home screen, Android, PWA | `client/public/favicon.svg`, `apple-touch-icon.png`, `icon-*.png`                                 |
| Profile picture on any network         | `social/avatar/avatar-{1080,800,400}.png`                                                         |
| Link preview (Open Graph)              | `social/web/og-1200x630-<lang>.png`                                                               |
| LinkedIn, X, Facebook, YouTube         | `social/<channel>/*-<w>x<h>-<lang>.png`, text inside safe areas                                   |
| Instagram post and story               | `social/instagram/{post,story}-*-<lang>.png`                                                      |
| The website's logos, icons, previews   | `web/public/` (`logo.svg`, `favicon.svg`, `og-<lang>.png`), colours in `web/src/styles/brand.css` |

All paths are under `corporate-identity/` unless they start with `client/` or `web/`. A channel that needs
another size gets an entry in `SOCIAL` in `scripts/brand/brand.ts`, then `pnpm brand`.
