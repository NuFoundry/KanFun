import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isLocale, LOCALE_NAMES, LOCALES } from "@/i18n";
import { useAuth } from "@/lib/auth-context";

/** Switches the UI language and remembers it on the user record when signed in. */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const { setLocale } = useAuth();
  const current = isLocale(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("language.label")} data-testid="language">
          <Languages />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((locale) => (
          <DropdownMenuItem
            key={locale}
            data-testid={`language-${locale}`}
            aria-current={locale === current ? "true" : undefined}
            className={locale === current ? "font-semibold" : undefined}
            onClick={() => void setLocale(locale)}
          >
            {LOCALE_NAMES[locale]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
