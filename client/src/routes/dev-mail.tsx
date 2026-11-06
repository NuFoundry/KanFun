/**
 * Dev inbox (`/dev/mail`, development only): every email the stack sends, PocketBase's auth
 * mails included, read from the mailer's outbox. Stands on its own, outside the app layout.
 */
import { ArrowLeft, Mail, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { LoadingRegion } from "@/components/skeletons";
import { EmptyState, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClearOutbox, useOutbox } from "@/hooks/use-outbox";
import { linksIn, type OutboxMail } from "@/lib/api/mail";
import { formatDateTime } from "@/lib/format";
import { cn, repeat } from "@/lib/utils";

const GRID = "grid gap-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]";

export function DevMailPage() {
  const { t } = useTranslation();
  const [recipient, setRecipient] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const { data: mails, isLoading, isError, error, isFetching, refetch } = useOutbox(recipient);
  const clear = useClearOutbox();
  const selected = mails?.find((mail) => mail.id === selectedId) ?? mails?.[0];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <Mail className="size-5" />
        <h1 className="text-lg font-semibold">{t("devMail.title")}</h1>
        {mails && (
          <Badge variant="secondary" data-testid="inbox-count">
            {mails.length}
          </Badge>
        )}
        <Input
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
          placeholder={t("devMail.filter")}
          aria-label={t("devMail.filter")}
          className="max-w-xs sm:ml-auto"
          data-testid="inbox-filter"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          data-testid="inbox-refresh"
        >
          <RefreshCw className={cn(isFetching && "animate-spin")} /> {t("devMail.refresh")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => clear.mutate()}
          disabled={clear.isPending || !mails?.length}
          data-testid="inbox-clear"
        >
          <Trash2 /> {t("devMail.clear")}
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft /> {t("devMail.backToApp")}
          </Link>
        </Button>
      </header>
      <p className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        {t("devMail.subtitle")}
      </p>

      <div className="flex-1 p-4">
        {isLoading && (
          <LoadingRegion testId="inbox-loading" className={GRID}>
            <InboxSkeleton />
          </LoadingRegion>
        )}

        {isError && (
          <ErrorState error={error} onRetry={() => void refetch()} testId="inbox-error" />
        )}

        {mails && mails.length === 0 && (
          <EmptyState
            title={t("devMail.empty")}
            description={t("devMail.emptyHint")}
            testId="inbox-empty"
          />
        )}

        {mails && mails.length > 0 && selected && (
          <div className={GRID} data-testid="inbox-list">
            <ul className="divide-y self-start rounded-lg border">
              {mails.map((mail) => {
                const active = mail.id === selected.id;
                return (
                  <li key={mail.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(mail.id)}
                      aria-current={active ? "true" : undefined}
                      data-testid={`inbox-item-${mail.id}`}
                      className={cn(
                        "flex w-full flex-col gap-1 px-3 py-2 text-left hover:bg-accent/60",
                        active && "bg-accent",
                      )}
                    >
                      <span className="truncate font-medium">{mail.subject || "(no subject)"}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {mail.to.join(", ")}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {formatDateTime(mail.receivedAt)}
                        <Badge variant="outline">{mail.source}</Badge>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <MailView key={selected.id} mail={selected} />
          </div>
        )}
      </div>
    </div>
  );
}

function MailView({ mail }: { mail: OutboxMail }) {
  const { t } = useTranslation();
  const links = linksIn(mail);
  const doc =
    mail.html ??
    `<pre style="white-space:pre-wrap;font-family:system-ui">${escape(mail.text)}</pre>`;
  return (
    <article className="min-w-0 space-y-4" data-testid="inbox-mail">
      <div>
        <h2 className="text-xl font-semibold" data-testid="inbox-subject">
          {mail.subject}
        </h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t("devMail.from")}</dt>
          <dd className="truncate">{mail.from}</dd>
          <dt className="text-muted-foreground">{t("devMail.to")}</dt>
          <dd className="truncate">{mail.to.join(", ")}</dd>
          <dt className="text-muted-foreground">{t("devMail.received")}</dt>
          <dd>{formatDateTime(mail.receivedAt)}</dd>
          <dt className="text-muted-foreground">{t("devMail.via")}</dt>
          <dd>{mail.source}</dd>
        </dl>
      </div>
      <Tabs defaultValue="html">
        <TabsList>
          <TabsTrigger value="html">{t("devMail.tabHtml")}</TabsTrigger>
          <TabsTrigger value="text">{t("devMail.tabText")}</TabsTrigger>
          <TabsTrigger value="links" data-testid="inbox-tab-links">
            {t("devMail.tabLinks")} ({links.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="html">
          <iframe
            title={t("devMail.preview")}
            sandbox=""
            srcDoc={doc}
            className="h-[60vh] w-full rounded-lg border bg-white"
            data-testid="inbox-preview"
          />
        </TabsContent>
        <TabsContent value="text">
          <pre className="max-h-[60vh] overflow-auto rounded-lg border p-4 text-sm whitespace-pre-wrap">
            {mail.text}
          </pre>
        </TabsContent>
        <TabsContent value="links">
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("devMail.noLinks")}</p>
          ) : (
            <ul className="space-y-2 text-sm" data-testid="inbox-links">
              {links.map((href) => (
                <li key={href}>
                  <a href={href} target="_blank" rel="noreferrer" className="break-all underline">
                    {href}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </article>
  );
}

/** Mirrors the inbox: a list of message rows and the message pane with its preview. */
function InboxSkeleton() {
  return (
    <>
      <div className="divide-y self-start rounded-lg border">
        {repeat(6, (index) => (
          <div key={index} className="space-y-2 px-3 py-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-7 w-2/3" />
        <div className="space-y-2">
          {repeat(4, (index) => (
            <Skeleton key={index} className="h-4 w-56" />
          ))}
        </div>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    </>
  );
}

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
