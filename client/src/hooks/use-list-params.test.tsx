import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { useListParams } from "./use-list-params";

function wrapperAt(url: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
  };
}

const options = { sort: "-created", sortable: ["created", "title"], filters: ["status" as const] };

describe("useListParams", () => {
  it("reads defaults and ignores unknown sort columns", () => {
    const { result } = renderHook(() => useListParams(options), {
      wrapper: wrapperAt("/?sort=hacked&page=0"),
    });
    expect(result.current).toMatchObject({
      q: "",
      sort: "-created",
      page: 1,
      filters: { status: "" },
      isFiltered: false,
    });
  });

  it("reads values from the URL", () => {
    const { result } = renderHook(() => useListParams(options), {
      wrapper: wrapperAt("/?q=hello&sort=title&page=3&status=draft"),
    });
    expect(result.current).toMatchObject({
      q: "hello",
      sort: "title",
      page: 3,
      filters: { status: "draft" },
      isFiltered: true,
    });
  });

  it("writes to the URL, drops defaults and resets the page on a new filter", () => {
    const { result } = renderHook(
      () => ({ list: useListParams(options), search: useLocation().search }),
      { wrapper: wrapperAt("/?page=4") },
    );
    act(() => result.current.list.set({ q: "x", status: "draft" }));
    expect(result.current.search).toBe("?q=x&status=draft");
    act(() => result.current.list.set({ page: 2 }));
    expect(result.current.search).toBe("?q=x&status=draft&page=2");
    act(() => result.current.list.set({ sort: "-created", q: "" }));
    expect(result.current.search).toBe("?status=draft");
    act(() => result.current.list.clear());
    expect(result.current.search).toBe("");
  });

  it("toggles sort direction per column", () => {
    const { result } = renderHook(() => useListParams(options), { wrapper: wrapperAt("/") });
    act(() => result.current.toggleSort("title"));
    expect(result.current.sort).toBe("title");
    act(() => result.current.toggleSort("title"));
    expect(result.current.sort).toBe("-title");
    act(() => result.current.toggleSort("created"));
    expect(result.current.sort).toBe("created");
  });
});
