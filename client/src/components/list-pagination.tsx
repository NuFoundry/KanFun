import { useTranslation } from "react-i18next";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

/** "Showing 1–20 of 41" plus page links; nothing but the count when everything fits on one page. */
export function ListPagination({
  testId,
  page,
  perPage,
  total,
  onPage,
}: {
  /** `<view>`: renders `data-testid="<view>-pagination"` */
  testId: string;
  page: number;
  perPage: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const { t } = useTranslation();
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  // Up to five page numbers around the current one.
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const pages = Array.from({ length: Math.min(5, pageCount) }, (_, i) => start + i);

  return (
    <div
      data-testid={`${testId}-pagination`}
      className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
    >
      <span data-testid={`${testId}-showing`}>{t("list.showing", { from, to, total })}</span>
      {pageCount > 1 && (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={page <= 1}
                className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  if (page > 1) onPage(page - 1);
                }}
              />
            </PaginationItem>
            {pages.map((p) => (
              <PaginationItem key={p}>
                <PaginationLink
                  href="#"
                  isActive={p === page}
                  onClick={(event) => {
                    event.preventDefault();
                    onPage(p);
                  }}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={page >= pageCount}
                className={page >= pageCount ? "pointer-events-none opacity-50" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  if (page < pageCount) onPage(page + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
