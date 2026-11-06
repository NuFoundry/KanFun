# KanFun corporate identity

The one place for the brand: what the logo is and how to use it, the colours, the typeface, and
ready-made files for every channel. If a platform asks for a logo, an icon or a banner, the file is
in here. Everything is drawn from `logo/mark.svg` and `brand.json` by `pnpm brand`; to change the
logo, tell your coding agent ("create a logo that ...", the `brand` skill).

| Need                                       | Take                                                       |
| ------------------------------------------ | ---------------------------------------------------------- |
| Logo on a light background                 | `logo/svg/logo-dark.svg` (PNG: `logo/png/logo-dark-*.png`) |
| Logo on a dark background                  | `logo/svg/logo-light.svg`                                  |
| Logo in one colour (print, engraving, fax) | `logo/svg/logo-black.svg` / `logo-white.svg`               |
| The mark alone (favicon, small spaces)     | `logo/svg/mark.svg`                                        |
| App icon, store icon, square tile          | `logo/svg/icon.svg` (edge to edge, no clear space)         |
| Profile picture on any social network      | `social/avatar/avatar-{1080,800,400}.png`                  |
| Link preview of a page (Open Graph)        | `social/web/og-1200x630-{en,de}.png`                       |
| Email signature                            | `logo/png/logo-dark-500.png`, shown at 160–200 px wide     |

Every logo exists as SVG and as transparent PNG at 2000, 1000, 500 and 250 px wide. The app's own
icons (favicon, iOS home screen, Android and the installable app) are written to `client/public`.
The website gets its logos, icons, link previews and colours in `web/public` and
`web/src/styles/brand.css`.

## Logo

![The logo](logo/png/logo-dark-1000.png)

The logo is the **mark** (a rounded square in the brand colour with a white spark) and the
**wordmark**, the app's name in Inter SemiBold. The mark works on its own; the wordmark never
appears without it.

| Element      | Value, in M = the edge of the mark                                    |
| ------------ | --------------------------------------------------------------------- |
| Mark         | drawn on a 24-unit grid (`logo/mark.svg`), corner radius M/4          |
| Wordmark     | Inter SemiBold, size 0.62 M, tracking −2.5 %, converted to outlines   |
| Alignment    | the wordmark's cap height is centred on the mark                      |
| Gap          | 0.30 M between mark and wordmark                                      |
| Clear space  | 0.25 M on every side; nothing else may enter it (the SVGs include it) |
| Minimum size | mark 16 px (favicon), full logo 96 px wide on screen, 25 mm in print  |

| File                        | Mark                   | Wordmark | Use on                        |
| --------------------------- | ---------------------- | -------- | ----------------------------- |
| `logo-dark`                 | brand colour           | Ink      | white, paper, light photos    |
| `logo-light`                | brand colour           | white    | Ink, Night, dark photos       |
| `logo-black`                | Ink, symbol cut out    | Ink      | one-colour print, stamps      |
| `logo-white`                | white, symbol cut out  | white    | one-colour on dark, embossing |
| `mark`, `mark-black/-white` | as above, without name | –        | favicon, small spaces         |
| `icon`                      | edge to edge           | –        | app icons, tiles              |

Don't recolour or stretch the mark, add effects, retype the wordmark in another typeface, or put the
coloured mark on a busy or same-coloured background (use a one-colour version).

## Colour

The app's tokens (`client/src/styles.css`) are defined in OKLCH; these are their sRGB values
(`brand.json`).

| Name      | Hex       | Use                                             |
| --------- | --------- | ----------------------------------------------- |
| **Brand** | `#FD4D02` | the mark, the one accent, highlights            |
| Ink       | `#181716` | text, the wordmark                              |
| Ink Soft  | `#44423F` | secondary text                                  |
| Paper     | `#FBFAF8` | page background, the installed app's status bar |
| Night     | `#151312` | dark backgrounds                                |

Mostly Paper and Ink; the brand colour is the one accent, never a full background except the mark,
the avatar and small badges. White text on it is fine for large type and the mark.

## Typography

**Inter** (OFL, [rsms.me/inter](https://rsms.me/inter/)) for everything: SemiBold for headlines and
the wordmark, Regular for text.

## Social media

All in `social/`, once per language in `brand.json` → `copy` (`-en`, `-de`).

| Channel   | File                                      | Size        | Note                                          |
| --------- | ----------------------------------------- | ----------- | --------------------------------------------- |
| All       | `avatar/avatar-{1080,800,400}.png`        | square      | the mark centred, safe for a circle crop      |
| Web       | `web/og-1200x630-*.png`                   | 1200×630    | link previews (Slack, WhatsApp, LinkedIn, X)  |
| LinkedIn  | `linkedin/company-cover-2256x382-*.png`   | 1128×191 @2 | content kept clear of the logo at bottom left |
| LinkedIn  | `linkedin/personal-banner-1584x396-*.png` | 1584×396    | content kept clear of the photo               |
| X         | `x/header-1500x500-*.png`                 | 1500×500    |                                               |
| Facebook  | `facebook/cover-1640x624-*.png`           | 1640×624    |                                               |
| YouTube   | `youtube/banner-2560x1440-*.png`          | 2560×1440   | text inside the 1546×423 area shown on phones |
| Instagram | `instagram/post-1080x1080-*.png`, `-1350` | post        |                                               |
| Instagram | `instagram/story-1080x1920-*.png`         | story       |                                               |

## Changing the brand

Edit the source (`logo/mark.svg`, `brand.json`), then `pnpm brand`; never edit a PNG by hand. Drafts
go to `logo/drafts/` and `pnpm brand --preview` compares them on one sheet. The build uses the repo's
Playwright Chromium and Inter from `node_modules`, so the output does not depend on installed fonts.
