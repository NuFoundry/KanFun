import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">{t("notFound.title")}</h1>
      <Button asChild variant="outline">
        <Link to="/">{t("notFound.backHome")}</Link>
      </Button>
    </div>
  );
}
