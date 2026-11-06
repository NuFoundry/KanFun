/**
 * The site's languages. English is at /, every other language under its own prefix (/de/...).
 * Components keep their copy next to them: `const COPY: Record<Lang, {...}> = { en: {...} }`,
 * then `const t = COPY[lang]`; a missing language fails `pnpm typecheck`. To add a language, add
 * it here (LANGS and each map), give every COPY its entry and add its pages under src/pages/<code>/.
 */
export const LANGS = ["en", "de"] as const;
export type Lang = (typeof LANGS)[number];

export const HTML_LANG: Record<Lang, string> = {
  en: "en",
  de: "de",
};
export const OG_LOCALE: Record<Lang, string> = {
  en: "en_GB",
  de: "de_DE",
};
export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  de: "Deutsch",
};

const PREFIX: Record<Lang, string> = {
  en: "",
  de: "/de",
};
const SLUGS: Record<Lang, { imprint: string; privacy: string }> = {
  en: { imprint: "imprint", privacy: "privacy" },
  de: { imprint: "impressum", privacy: "datenschutz" },
};

/** Every page that exists in each language; the sitemap, hreflang and the switcher use it. */
export const paths = {
  home: (lang: Lang) => `${PREFIX[lang]}/`,
  imprint: (lang: Lang) => `${PREFIX[lang]}/${SLUGS[lang].imprint}`,
  privacy: (lang: Lang) => `${PREFIX[lang]}/${SLUGS[lang].privacy}`,
};
export type Page = keyof typeof paths;

/** A section of the home page; the anchors are the same in every language. */
export const section = (lang: Lang, id: string) => `${paths.home(lang)}#${id}`;
