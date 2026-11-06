import { LogOut, Menu, Settings } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useNavigate } from "react-router";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
  );

export function SiteHeader() {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  // The same links in the bar (md and up) and in the menu sheet on phones.
  const links = (
    <>
      <NavLink to="/" end className={navLinkClass} onClick={close}>
        {t("nav.home")}
      </NavLink>
      {isAuthenticated && (
        <>
          <NavLink to="/dashboard" className={navLinkClass} onClick={close}>
            {t("nav.dashboard")}
          </NavLink>
          <NavLink to="/assistant" className={navLinkClass} onClick={close}>
            {t("nav.assistant")}
          </NavLink>
        </>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 pt-safe backdrop-blur">
      <div className="container mx-auto flex h-14 max-w-5xl items-center gap-2 px-safe md:gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 md:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label={t("nav.menu")}
          data-testid="nav-menu"
        >
          <Menu />
        </Button>
        <Link to="/" className="flex min-w-0 items-center gap-2 font-semibold" data-testid="brand">
          {/* The brand mark, written by `pnpm brand` (corporate-identity). */}
          <img src="/favicon.svg" alt="" className="size-6 shrink-0" />
          <span className="truncate">{env.appName}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label={t("nav.main")}>
          {links}
        </nav>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="w-72 max-w-[85vw]">
            <SheetTitle className="sr-only">{t("nav.main")}</SheetTitle>
            <nav className="mt-8 flex flex-col gap-1" data-testid="nav-sheet">
              {links}
            </nav>
          </SheetContent>
        </Sheet>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  data-testid="user-menu"
                >
                  <Avatar className="size-8">
                    <AvatarFallback>{initials(user.name || user.email)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel data-testid="user-name">
                  {user.name || user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild data-testid="settings-link">
                  <Link to="/settings">
                    <Settings /> {t("nav.settings")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-testid="logout"
                  onClick={() => {
                    // Leave the protected page first so its guard does not redirect to /login.
                    navigate("/", { replace: true });
                    logout();
                  }}
                >
                  <LogOut /> {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm" data-testid="login-link">
              <Link to="/login">{t("nav.login")}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
