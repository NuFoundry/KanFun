/**
 * Building blocks of a list view (AGENTS.md "Every list view"): a toolbar row with a search box
 * and filter selects, and a sortable table header. State lives in the URL via useListParams.
 */
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function ListToolbar({
  testId,
  className,
  children,
}: {
  /** `<view>`: renders `data-testid="<view>-toolbar"` */
  testId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-testid={`${testId}-toolbar`}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {children}
    </div>
  );
}

/** Search box that updates the URL after a short pause, so typing does not fire a query per key. */
export function ListSearch({
  testId,
  value,
  onChange,
  placeholder,
  delay = 300,
}: {
  /** `<view>`: renders `data-testid="<view>-search"` */
  testId: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  delay?: number;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    // The URL changed from outside (clear filters, back button): adopt it.
    setSeen(value);
    setDraft(value);
  }
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const update = (next: string) => {
    setDraft(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next), delay);
  };
  return (
    <div className="relative min-w-56 flex-1 sm:max-w-xs">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={draft}
        onChange={(event) => update(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-8"
        data-testid={`${testId}-search`}
      />
    </div>
  );
}

/** A filter or sort select; the first option is usually "All" with an empty value. */
export function ListSelect({
  testId,
  value,
  onChange,
  options,
  label,
  className,
}: {
  /** Full test id, e.g. `my-posts-status` or `posts-sort` */
  testId: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  /** Accessible name; also the placeholder when nothing is selected. */
  label: string;
  className?: string;
}) {
  // Radix Select cannot hold "" as a value: an empty option is encoded as "*" in the DOM.
  const encode = (v: string) => (v === "" ? "*" : v);
  const decode = (v: string) => (v === "*" ? "" : v);
  return (
    <Select value={encode(value)} onValueChange={(v) => onChange(decode(v))}>
      <SelectTrigger aria-label={label} className={cn("w-44", className)} data-testid={testId}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={encode(option.value)}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Table header that sorts by its column; `sort` is the list's current sort (`col` / `-col`). */
export function SortableHead({
  column,
  sort,
  onSort,
  children,
  className,
}: {
  column: string;
  sort: string;
  onSort: (column: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const direction = sort === column ? "ascending" : sort === `-${column}` ? "descending" : "none";
  const Icon =
    direction === "ascending" ? ArrowUp : direction === "descending" ? ArrowDown : ArrowUpDown;
  return (
    <TableHead aria-sort={direction} className={className}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 gap-1 data-[active=true]:text-foreground"
        data-active={direction !== "none"}
        data-testid={`sort-${column}`}
        onClick={() => onSort(column)}
      >
        {children}
        <Icon className={cn("size-3.5", direction === "none" && "text-muted-foreground")} />
      </Button>
    </TableHead>
  );
}
