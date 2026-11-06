import i18n from "@/i18n";

/** BCP 47 tag used for dates and numbers. */
export function currentLocale(): string {
  if (i18n.resolvedLanguage) return i18n.resolvedLanguage;
  return "en-US";
}

export function formatDate(iso: string | Date | undefined, locale = currentLocale()): string {
  if (!iso) return "";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

export function formatDateTime(iso: string | Date | undefined, locale = currentLocale()): string {
  if (!iso) return "";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** "$9", "9 €", "¥1,200": whole amounts without decimals, others with the currency's digits. */
export function formatMoney(amount: number, currency: string, locale = currentLocale()): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    ...(Number.isInteger(amount) ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
  }).format(amount);
}

export function truncate(text: string, max = 140): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function initials(name: string | undefined, fallback = "?"): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
