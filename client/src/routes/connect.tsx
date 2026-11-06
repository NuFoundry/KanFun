import { CheckCircle2, Plug, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { toast } from "sonner";
import { LoadingRegion } from "@/components/skeletons";
import { ErrorState } from "@/components/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useConsentRequest, useDecideConsent, useScopeLabels } from "@/hooks/use-mcp";
import { authorizationRequest, returnToAgent, type Scope } from "@/lib/api/mcp";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";

/**
 * The consent page an AI agent sends the user to (the OAuth authorization endpoint). It names the
 * agent, warns when it named itself, lists the permissions it asked for (anything that deletes
 * starts unticked) and sends the browser back to the agent with a code, or with access_denied.
 */
export function ConnectPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const request = useMemo(() => authorizationRequest(location.search), [location.search]);
  const consent = useConsentRequest(request);
  const decide = useDecideConsent(request);
  const labels = useScopeLabels();
  const [chosen, setChosen] = useState<Scope[] | null>(null);
  const [leaving, setLeaving] = useState(false);

  const data = consent.data;
  const back = data && "redirect" in data ? data.redirect : null;
  // A request the service sends back to the agent (wrong scope, no PKCE): no page to show.
  useEffect(() => {
    if (back) returnToAgent(back);
  }, [back]);

  if (consent.isPending || back) {
    return (
      <LoadingRegion testId="connect-loading" className="mx-auto max-w-md">
        <ConnectSkeleton />
      </LoadingRegion>
    );
  }
  if (consent.isError || !data || "redirect" in data) {
    return (
      <div className="mx-auto max-w-md">
        <ErrorState
          testId="connect-error"
          title={t("mcp.connect.invalid")}
          error={new Error(t("mcp.connect.invalidHint"))}
        />
      </div>
    );
  }
  if (leaving) {
    return (
      <div
        className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center"
        data-testid="connect-done"
      >
        <CheckCircle2 className="size-8 text-primary" />
        <p className="text-sm text-muted-foreground">{t("mcp.connect.done")}</p>
      </div>
    );
  }

  const scopes = chosen ?? data.scopes.filter((scope) => !data.optIn.includes(scope));
  const toggle = (scope: Scope, on: boolean) =>
    setChosen(on ? [...scopes, scope] : scopes.filter((s) => s !== scope));

  function answer(approve: boolean) {
    decide.mutate(
      { approve, scopes },
      {
        onSuccess: (redirect) => {
          setLeaving(true);
          returnToAgent(redirect);
        },
        onError: () => toast.error(t("mcp.connect.failed")),
      },
    );
  }

  const name = data.client.name;
  return (
    <div className="mx-auto max-w-md">
      <Card data-testid="connect">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted">
            <Plug className="size-5" />
          </div>
          <CardTitle>{t("mcp.connect.title", { name })}</CardTitle>
          <CardDescription>
            {t("mcp.connect.subtitle", {
              name,
              app: env.appName,
              email: user?.email ?? "",
            })}
          </CardDescription>
          {data.client.verified && (
            <p className="text-sm text-muted-foreground" data-testid="connect-publisher">
              {t("mcp.connect.publishedBy", { host: data.client.host })}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {!data.client.verified && (
            <Alert variant="destructive" data-testid="connect-unverified">
              <ShieldAlert />
              <AlertTitle>{t("mcp.connect.unverified")}</AlertTitle>
              <AlertDescription>
                {t("mcp.connect.unverifiedHint", { app: env.appName })}
              </AlertDescription>
            </Alert>
          )}
          <fieldset className="space-y-3">
            <legend className="mb-3 text-sm font-medium">{t("mcp.connect.permissions")}</legend>
            {data.scopes.map((scope) => (
              <label key={scope} className="flex items-start gap-3 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={scopes.includes(scope)}
                  onCheckedChange={(on) => toggle(scope, on === true)}
                  data-testid={`scope-${scope}`}
                />
                <span>
                  {labels[scope]}
                  {data.optIn.includes(scope) && (
                    <span className="block text-xs text-muted-foreground">
                      {t("mcp.connect.optIn")}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </fieldset>
          <p className="text-xs text-muted-foreground">
            {t("mcp.connect.returnTo", { host: data.redirectHost })}
          </p>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => answer(false)}
            disabled={decide.isPending}
            data-testid="connect-deny"
          >
            {t("mcp.connect.deny")}
          </Button>
          <Button
            onClick={() => answer(true)}
            disabled={decide.isPending || scopes.length === 0}
            data-testid="connect-allow"
          >
            {t("mcp.connect.allow")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function ConnectSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
      </CardFooter>
    </Card>
  );
}
