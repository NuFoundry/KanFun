import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

/**
 * Sort, search, filters and page of a list view, kept in the URL (`?q=&sort=&page=&status=`) so
 * a list is linkable, survives a reload and works with the back button. See AGENTS.md "Every
 * list view". Sort values use PocketBase's form: `created` ascending, `-created` descending.
 */
export type ListParams<F extends string = string> = {
  q: string;
  sort: string;
  page: number;
  filters: Record<F, string>;
  /** Any search text or filter is active (shows the "no matches" empty state + clear). */
  isFiltered: boolean;
  /** Patch one or more values; omit `page` and it resets to 1 (a new filter starts over). */
  set: (
    patch: Partial<{ q: string; sort: string; page: number }> & Partial<Record<F, string>>,
  ) => void;
  /** `created` -> `-created` -> `created`; another column starts ascending. */
  toggleSort: (column: string) => void;
  clear: () => void;
};

export function useListParams<F extends string = never>(options: {
  sort: string;
  /** Columns a user may sort by (with or without the leading `-`); anything else is ignored. */
  sortable: string[];
  filters?: F[];
}): ListParams<F> {
  const [search, setSearch] = useSearchParams();
  const filterKeys = useMemo(() => options.filters ?? [], [options.filters]);

  const params = useMemo(() => {
    const rawSort = search.get("sort") ?? "";
    const sort = options.sortable.includes(rawSort.replace(/^-/, "")) ? rawSort : options.sort;
    const page = Math.max(1, Math.floor(Number(search.get("page")) || 1));
    const filters = Object.fromEntries(filterKeys.map((k) => [k, search.get(k) ?? ""])) as Record<
      F,
      string
    >;
    const q = search.get("q") ?? "";
    return {
      q,
      sort,
      page,
      filters,
      isFiltered: Boolean(q || Object.values(filters).some(Boolean)),
    };
  }, [search, options.sort, options.sortable, filterKeys]);

  const set = useCallback<ListParams<F>["set"]>(
    (patch) => {
      const next = new URLSearchParams(search);
      if (!("page" in patch)) next.delete("page");
      for (const [key, value] of Object.entries(patch)) {
        const empty =
          value === undefined ||
          value === "" ||
          (key === "page" && value === 1) ||
          (key === "sort" && value === options.sort);
        if (empty) next.delete(key);
        else next.set(key, String(value));
      }
      setSearch(next, { replace: true });
    },
    [search, setSearch, options.sort],
  );

  const toggleSort = useCallback(
    (column: string) =>
      set({ sort: params.sort === column ? `-${column}` : column } as Parameters<
        ListParams<F>["set"]
      >[0]),
    [params.sort, set],
  );
  const clear = useCallback(() => setSearch(new URLSearchParams(), { replace: true }), [setSearch]);

  return { ...params, set, toggleSort, clear };
}
