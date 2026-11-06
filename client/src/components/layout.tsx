import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { SiteHeader } from "@/components/site-header";
import { env } from "@/lib/env";

export function Layout() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="container mx-auto w-full max-w-5xl flex-1 py-8 px-safe">
        <Outlet />
      </main>
      <footer className="border-t pt-6 px-safe pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground">
        {env.appName} · {t("app.tagline")}
      </footer>
    </div>
  );
}
