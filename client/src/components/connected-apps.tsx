import { zodResolver } from "@hookform/resolvers/zod";
import { Bot, Copy, KeyRound, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { LoadingRegion } from "@/components/skeletons";
import { EmptyState, ErrorState } from "@/components/states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreateToken,
  useGrants,
  useMcpActivity,
  useRevokeGrant,
  useScopeLabels,
} from "@/hooks/use-mcp";
import { McpError, SCOPES, type Grant, type Scope } from "@/lib/api/mcp";
import { env } from "@/lib/env";
import { formatDate, formatDateTime } from "@/lib/format";
import { repeat } from "@/lib/utils";

/** The address agents connect to: this app's origin + /mcp (Caddy and Vite route it). */
const serverUrl = () => `${window.location.origin}/mcp`;

/** Settings → Connected apps: every agent and token with access, and how to end it. */
export function ConnectedApps() {
  const { t } = useTranslation();
  const { data: grants, isLoading, isError, error, refetch } = useGrants();

  return (
    <Card data-testid="connected-apps">
      <CardHeader>
        <CardTitle>{t("mcp.apps.title")}</CardTitle>
        <CardDescription>{t("mcp.apps.hint", { app: env.appName })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="mcp-server-url">
            {t("mcp.apps.serverUrl")}
          </label>
          <Input
            id="mcp-server-url"
            readOnly
            value={serverUrl()}
            onFocus={(e) => e.currentTarget.select()}
            data-testid="mcp-server-url"
          />
        </div>

        {isLoading && (
          <LoadingRegion testId="connected-apps-loading">
            <div className="divide-y rounded-md border">
              {repeat(2, (i) => (
                <div key={i} className="space-y-2 p-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
              ))}
            </div>
          </LoadingRegion>
        )}
        {isError && (
          <ErrorState
            error={error}
            title={t("mcp.apps.failed")}
            onRetry={() => void refetch()}
            testId="connected-apps-error"
          />
        )}
        {grants && grants.length === 0 && (
          <EmptyState
            icon={<Bot className="size-8" />}
            title={t("mcp.apps.empty")}
            description={t("mcp.apps.emptyHint")}
            testId="connected-apps-empty"
          />
        )}
        {grants && grants.length > 0 && (
          <ul className="divide-y rounded-md border" data-testid="connected-apps-list">
            {grants.map((grant) => (
              <GrantRow key={grant.id} grant={grant} />
            ))}
          </ul>
        )}

        <CreateTokenDialog />
      </CardContent>
    </Card>
  );
}

function GrantRow({ grant }: { grant: Grant }) {
  const { t } = useTranslation();
  const labels = useScopeLabels();
  const revoke = useRevokeGrant();
  const token = grant.kind === "token";
  const name = grant.clientName;

  return (
    <li className="flex items-start gap-3 p-3" data-testid="grant">
      <div className="mt-0.5 text-muted-foreground">
        {token ? <KeyRound className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium" data-testid="grant-name">
            {name}
          </span>
          {grant.clientHost && (
            <span className="text-xs text-muted-foreground">{grant.clientHost}</span>
          )}
          {token && <Badge variant="secondary">{t("mcp.apps.token")}</Badge>}
          {!token && !grant.verified && <Badge variant="outline">{t("mcp.apps.unverified")}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          {(grant.scopes ?? []).map((scope) => labels[scope as Scope] ?? scope).join(" · ")}
        </p>
        <p className="text-xs text-muted-foreground">
          {grant.lastUsed
            ? t("mcp.apps.lastUsed", { date: formatDateTime(grant.lastUsed) })
            : t("mcp.apps.neverUsed")}
          {grant.expires && ` · ${t("mcp.apps.expires", { date: formatDate(grant.expires) })}`}
        </p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" data-testid="grant-revoke">
            {t("mcp.apps.revoke")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("mcp.apps.revokeTitle", { name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("mcp.apps.revokeHint")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("mcp.apps.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="grant-revoke-confirm"
              onClick={() =>
                revoke.mutate(grant.id, {
                  onSuccess: () => toast.success(t("mcp.apps.revoked")),
                  onError: () => toast.error(t("mcp.apps.revokeFailed")),
                })
              }
            >
              {t("mcp.apps.revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function CreateTokenDialog() {
  const { t } = useTranslation();
  const labels = useScopeLabels();
  const create = useCreateToken();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const schema = z.object({
    name: z.string().trim().min(1, t("mcp.tokens.nameRequired")).max(60),
    scopes: z.array(z.enum(SCOPES)).min(1, t("mcp.tokens.scopesRequired")),
    days: z.enum(["30", "90", "365"]),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", scopes: ["posts:read"], days: "90" },
  });

  async function onSubmit(values: Values) {
    try {
      const created = await create.mutateAsync({
        name: values.name,
        scopes: values.scopes,
        days: Number(values.days) as 30 | 90 | 365,
      });
      setToken(created.token);
    } catch (error) {
      toast.error(
        error instanceof McpError && error.status === 409
          ? t("mcp.tokens.tooMany")
          : t("mcp.tokens.failed"),
      );
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    // The token is shown once: closing the dialog forgets it.
    if (!next) {
      setToken(null);
      form.reset();
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(token ?? "");
    toast.success(t("mcp.tokens.copied"));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="token-create">
          <Plus /> {t("mcp.tokens.create")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        {token ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("mcp.tokens.createdTitle")}</DialogTitle>
              <DialogDescription>
                {t("mcp.tokens.createdHint", { url: serverUrl() })}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Input
                readOnly
                value={token}
                className="font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
                data-testid="token-value"
              />
              <Button variant="outline" onClick={() => void copy()}>
                <Copy /> {t("mcp.tokens.copy")}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} data-testid="token-done">
                {t("mcp.tokens.close")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("mcp.tokens.title")}</DialogTitle>
              <DialogDescription>{t("mcp.tokens.hint")}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
                data-testid="token-form"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("mcp.tokens.name")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("mcp.tokens.namePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scopes"
                  render={({ field }) => (
                    <FormItem>
                      {SCOPES.map((scope) => (
                        <label key={scope} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={field.value.includes(scope)}
                            onCheckedChange={(on) =>
                              field.onChange(
                                on === true
                                  ? SCOPES.filter((s) => s === scope || field.value.includes(s))
                                  : field.value.filter((s) => s !== scope),
                              )
                            }
                            data-testid={`token-scope-${scope}`}
                          />
                          {labels[scope]}
                        </label>
                      ))}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("mcp.tokens.validFor")}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="30">{t("mcp.tokens.days30")}</SelectItem>
                          <SelectItem value="90">{t("mcp.tokens.days90")}</SelectItem>
                          <SelectItem value="365">{t("mcp.tokens.days365")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={create.isPending}>
                  {t("mcp.tokens.submit")}
                </Button>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Settings → Recent activity: the last tool calls, never their content. */
export function McpActivity() {
  const { t } = useTranslation();
  const { data: entries, isLoading, isError, error, refetch } = useMcpActivity();
  const OUTCOME = {
    ok: t("mcp.activity.ok"),
    denied: t("mcp.activity.denied"),
    error: t("mcp.activity.error"),
  };

  return (
    <Card data-testid="mcp-activity">
      <CardHeader>
        <CardTitle>{t("mcp.activity.title")}</CardTitle>
        <CardDescription>{t("mcp.activity.hint")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <LoadingRegion testId="mcp-activity-loading">
            <div className="space-y-3">
              {repeat(3, (i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </LoadingRegion>
        )}
        {isError && (
          <ErrorState error={error} onRetry={() => void refetch()} testId="mcp-activity-error" />
        )}
        {entries && entries.length === 0 && (
          <EmptyState title={t("mcp.activity.empty")} testId="mcp-activity-empty" />
        )}
        {entries && entries.length > 0 && (
          <ul className="space-y-2 text-sm" data-testid="mcp-activity-list">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-2"
                data-testid="mcp-activity-entry"
              >
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{entry.tool}</code>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {entry.clientName}
                </span>
                <Badge variant={entry.outcome === "ok" ? "secondary" : "outline"}>
                  {OUTCOME[entry.outcome]}
                </Badge>
                <span className="text-xs whitespace-nowrap text-muted-foreground">
                  {formatDateTime(entry.created)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
