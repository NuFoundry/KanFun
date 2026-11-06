/** Every page in every language (paths in i18n.ts); a new page goes there and appears here. */
import type { APIRoute } from "astro";
import { LANGS, paths } from "../i18n";

export const GET: APIRoute = ({ site }) => {
  const urls = LANGS.flatMap((lang) => Object.values(paths).map((path) => path(lang)))
    .map((path) => `<url><loc>${new URL(path, site)}</loc></url>`)
    .join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    { headers: { "Content-Type": "application/xml" } },
  );
};
