/**
 * Site-wide constants. The name, claims and colours come from the brand (corporate-identity/,
 * `pnpm brand`); prices from the billing service's plan list, so the website and checkout agree.
 */
import brand from "../../../corporate-identity/brand.json";

export const BRAND = brand;

/** The app; sign-up and login live there. PUBLIC_APP_URL is set by `pnpm dev` and every deploy. */
export const APP_URL = (import.meta.env.PUBLIC_APP_URL ?? "https://app.example.com").replace(
  /\/$/,
  "",
);
export const SIGNUP_URL = `${APP_URL}/login?tab=register`;
export const LOGIN_URL = `${APP_URL}/login`;

/** Dev, stage and a prod site before launch stay out of search engines (WEB_NOINDEX=true). */
export const NOINDEX = import.meta.env.PUBLIC_NOINDEX === "true";

/**
 * Who runs the site: the imprint and the privacy page read it. Placeholders until you fill them
 * in; launching without them is not legal in the EU (and many other places).
 */
export const OPERATOR = {
  company: "Your Company Ltd",
  street: "Street 1",
  city: "1010 City",
  country: "Country",
  email: "hello@example.com",
  /** Company register, VAT number, supervisory authority: whatever your country requires. */
  details: ["Company register: [number, court]", "VAT ID: [number]"],
};
