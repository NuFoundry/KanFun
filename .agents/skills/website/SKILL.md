---
name: website
description: Writes or changes the website in web/ (Astro, the landing page in front of the app) - the product's positioning and copy, hero, features, pricing, FAQ, call to action, imprint and privacy page, new pages and languages. Use when the user says "write the landing page", "build the website", "update the homepage", "add a page to the website", "the website should say ...", or when the product definition changes.
---

# Website

`web/` is a static Astro site on its own domain (`WEB_DOMAIN`, e.g. `example.com`); the app lives on
`DOMAIN` (`app.example.com`) and the site's buttons lead there. It ships as a starter: the brand's
claims in the hero, three placeholder features, pricing, an FAQ, a closing call to action, imprint
and privacy page. Your job is to turn it into the page for this product.

| File                                 | What it holds                                                    |
| ------------------------------------ | ---------------------------------------------------------------- |
| `web/src/components/HomePage.astro`  | the order of the sections on the home page                       |
| `web/src/components/<Section>.astro` | one section each, with its copy in `COPY` per language           |
| `web/src/lib/site.ts`                | app links, `OPERATOR` (imprint, privacy), analytics, `noindex`   |
| `web/src/i18n.ts`                    | languages and the paths of every page (sitemap and hreflang)     |
| `web/src/styles/site.css`            | colour roles (`bg-surface`, `text-subtle`, `border-line`, ...)   |
| `corporate-identity/brand.json`      | name, colours, and the claims (headline, tagline) the hero shows |
| `docs/product.md`                    | the product definition (you write it, step 1)                    |

## 1. Get the product definition

Read `strategy/00-direction.md` if Business Discovery ran: its target customer, positioning and
ranked messages answer the questions below, and `docs/product.md` is written from them. Otherwise
read `docs/product.md`; if it does not exist or does not answer the questions below, read
`README.md` and the app's routes for what the product does, then ask the user what is still open,
in one message, at most five questions:

1. Who is it for (one kind of person or company, as concrete as possible)?
2. What problem does it solve for them, in their words?
3. The promise: what is better after they start using it (one sentence)?
4. Three reasons to believe it: features, outcomes or facts that are true today.
5. What should a visitor do: sign up, book a demo, join a waitlist? And the tone (formal "Sie" or
   informal "du" in German, playful or sober)?

Write the answers to `docs/product.md` (audience, problem, promise, proof, call to action, tone,
what we never claim) so the next change starts from them, and show it to the user.

## 2. Write the copy

- The hero's headline and tagline are the brand's claims (`brand.json` → `copy`), shared with the
  social images: change them there, then `pnpm brand` (the brand skill), never in `Hero.astro`.
- Lead with the reader's outcome, then what the product does; features are outcomes with a concrete
  detail, not adjectives. One idea per section, short sentences, no filler ("seamless", "powerful",
  "revolutionary").
- Only true claims. No invented numbers, testimonials, customer logos, awards or certifications;
  "no credit card", "GDPR", "made in Europe" and "free" only when they hold. Leave a section out
  rather than fill it with placeholders.
- Every language the site has (`LANGS` in `web/src/i18n.ts`) gets the same content, written for
  that language rather than translated word for word.

## 3. Build it

- A section is a component in `web/src/components/` with its copy in `COPY: Record<Lang, ...>`;
  add it to `HomePage.astro`. A new page is `web/src/pages/<slug>.astro` (plus one per language
  under `pages/<code>/`) and an entry in `paths` in `i18n.ts`, which feeds the sitemap and the
  language switch. A new anchor goes into `links` in `Header.astro`.
- Colours only through the roles in `site.css` and the brand tokens (`bg-brand`,
  `text-brand-foreground`); never a hex value. Check light and dark (the visitor's system setting).
- The site ships no JavaScript and loads nothing from other origins: the Content-Security-Policy
  (`deploy/Caddyfile` or `web/public/_headers`) allows this origin only: no inline script, no
  `style=""` attribute, no CDN link. Interactivity uses HTML (`<details>`, anchors); if a section
  truly needs a script, use an Astro `<script>` and prove with the edge check below that it runs.
- Images: screenshots of the app go into `web/public/` as WebP or PNG, at twice their displayed
  size, used with `<img src width height alt loading="lazy">`. The window drawn in `Hero.astro`
  is a placeholder for the first screenshot.
- The sign-up and login links come from `web/src/lib/site.ts`; keep the `data-testid`s that
  `e2e/web.spec.ts` uses, or update the spec in the same change.

## 4. Imprint and privacy

Fill `OPERATOR` in `web/src/lib/site.ts` with the user's details (ask; never invent a company,
address or register number). The privacy page lists every service that processes visitors' or
users' data: hosting, the email provider, analytics, payments, AI providers. Add what the app uses
and tell the user it is a starting point, not legal advice.

## 5. Check

1. `pnpm dev` serves the site at `http://localhost:4321` (`WEB_PORT`), linked to the local app.
   Look at it at 1440 px and 390 px wide, light and dark, and fix what looks off.
2. `pnpm check`, then `pnpm test:e2e` (the site's flows are in `e2e/web.spec.ts`).
   After a change to the headers or to what a page loads: `bash scripts/check-edge.sh`.
3. Search engines: `WEB_NOINDEX=true` in `deploy/.env.<tier>` keeps dev, stage and an unlaunched
   prod out; set it to `false` on prod at launch.
