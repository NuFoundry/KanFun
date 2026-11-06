/**
 * Loading states. Every data view renders one of: loading, error, empty, content (see AGENTS.md
 * "Loading, empty and error states"). A skeleton mirrors the layout it stands in for so nothing
 * moves when the data arrives: same container, same grid/table chrome, a typical number of rows.
 *
 *  - LoadingRegion: the accessible wrapper (role="status", aria-busy, screen-reader label).
 *  - TableSkeleton / DetailSkeleton: the layouts this app repeats.
 *  - Components with their own shape keep a `<Name>Skeleton` twin next to them (PostCardSkeleton).
 */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, repeat } from "@/lib/utils";

export function LoadingRegion({
  testId,
  className,
  children,
}: {
  /** `<view>-loading`, asserted by unit tests and e2e/loading.spec.ts */
  testId: string;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" data-testid={testId} className={className}>
      <span className="sr-only">{t("states.loading")}</span>
      {children}
    </div>
  );
}

/** Mirrors the shadcn Table: a header row and `rows` body rows with `widths` per column. */
export function TableSkeleton({
  rows = 5,
  widths = ["w-48", "w-24", "w-10", "w-8"],
  className,
}: {
  rows?: number;
  /** One Tailwind width per column; the last column is usually an action. */
  widths?: string[];
  className?: string;
}) {
  const row = (key: number, header = false) => (
    <div
      key={key}
      className={cn("flex items-center gap-6 border-b px-4 py-3 last:border-0", header && "h-10")}
    >
      {widths.map((width, column) => (
        <Skeleton key={column} className={cn("h-4", header ? "h-3" : "h-4", width)} />
      ))}
    </div>
  );
  return (
    <div className={cn("rounded-lg border", className)}>
      {row(-1, true)}
      {repeat(rows, (index) => row(index))}
    </div>
  );
}

/** Mirrors a detail page: title, meta line, body paragraphs. */
export function DetailSkeleton({ paragraphs = 3 }: { paragraphs?: number }) {
  return (
    <div className="max-w-3xl space-y-4">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-4 w-40" />
      <div className="space-y-2 pt-2">
        {repeat(paragraphs, (index) => (
          <Skeleton key={index} className={cn("h-4", index % 3 === 2 ? "w-3/4" : "w-full")} />
        ))}
      </div>
    </div>
  );
}
