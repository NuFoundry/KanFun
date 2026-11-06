import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider } from "./auth-context";
import { pb } from "@/lib/pocketbase";

jest.mock("@/lib/pocketbase", () => {
  const listeners: ((token: string, record: unknown) => void)[] = [];
  const store = {
    record: null as unknown,
    isValid: false,
    onChange: (fn: (token: string, record: unknown) => void) => {
      listeners.push(fn);
      return () => undefined;
    },
    clear: () => {
      store.record = null;
      listeners.forEach((fn) => fn("", null));
    },
    save: (token: string, record: unknown) => {
      store.record = record;
      listeners.forEach((fn) => fn(token, record));
    },
  };
  return { pb: { authStore: store, collection: jest.fn() } };
});

function setup() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  render(<span />, { wrapper });
  return queryClient;
}

const store = pb.authStore as unknown as {
  save: (token: string, record: unknown) => void;
  clear: () => void;
};

describe("AuthProvider", () => {
  it("drops the cached data of a user who signs out or is replaced", () => {
    const queryClient = setup();
    act(() => store.save("t1", { id: "alice" }));
    queryClient.setQueryData(["conversations", "list"], ["alice's chat"]);

    act(() => store.save("t2", { id: "bob" }));
    expect(queryClient.getQueryData(["conversations", "list"])).toBeUndefined();

    queryClient.setQueryData(["conversations", "list"], ["bob's chat"]);
    act(() => store.clear());
    expect(queryClient.getQueryData(["conversations", "list"])).toBeUndefined();
  });

  it("keeps public data cached when someone signs in", () => {
    const queryClient = setup();
    queryClient.setQueryData(["posts", "published"], ["welcome"]);
    act(() => store.save("t1", { id: "alice" }));
    expect(queryClient.getQueryData(["posts", "published"])).toEqual(["welcome"]);
  });
});
