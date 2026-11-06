/**
 * i18next setup. Import once from main.tsx. Strings live in locales/*.json; `t("key")` is typed
 * against en.json (see i18next.d.ts), so a typo fails `tsc`.
 *
 * Language resolution: the signed-in user's `locale` field (client/src/lib/auth-context.tsx sets
 * it), then localStorage, then the browser. Add a language: create locales/<code>.json, list it
 * in LOCALES, and add the value to server/pb_migrations/1757700003_users_locale.js.
 */
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import de from "./locales/de.json";
import en from "./locales/en.json";

export const LOCALES = ["en", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", de: "Deutsch" };
export const STORAGE_KEY = "locale";

export const resources = { en: { translation: en }, de: { translation: de } } as const;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: LOCALES,
    nonExplicitSupportedLngs: true,
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: STORAGE_KEY,
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false }, // React escapes already
    returnNull: false,
  });

export default i18n;
