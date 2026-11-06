/**
 * Empty and error states, the two non-loading siblings of a skeleton (see components/skeletons.tsx).
 * Every data view uses these instead of ad-hoc paragraphs so the look and the test ids are uniform.
 */
import { AlertTriangle, Inbox, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  icon,
  testId = "empty",
  className,
}: {
  title: string;
  description?: string;
  /** Usually the primary way out: a "New …" button or a link back. */
  action?: ReactNode;
  icon?: ReactNode;
  /** `<view>-empty` */
  testId?: string;
  className?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <div className="text-muted-foreground">{icon ?? <Inbox className="size-8" />}</div>
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title,
  testId = "error",
  className,
}: {
  error: unknown;
  /** Usually React Query's `refetch`. */
  onRetry?: () => void;
  title?: string;
  /** `<view>-error` */
  testId?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div
      role="alert"
      data-testid={testId}
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-10 text-center",
        className,
      )}
    >
      <AlertTriangle className="size-8 text-destructive" />
      <p className="font-medium">{title ?? t("states.errorTitle")}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} data-testid={`${testId}-retry`}>
          <RotateCcw /> {t("states.retry")}
        </Button>
      )}
    </div>
  );
}
