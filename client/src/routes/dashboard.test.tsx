import userEvent from "@testing-library/user-event";
import { DashboardPage } from "./dashboard";
import { useCreatePost, useDeletePost, useMyPostsPage, useUpdatePost } from "@/hooks/use-posts";
import { useAuth } from "@/lib/auth-context";
import { renderWithProviders, screen, within } from "@/test/test-utils";

jest.mock("@/hooks/use-posts");
jest.mock("@/lib/auth-context");

const mocked = {
  myPosts: jest.mocked(useMyPostsPage),
  auth: jest.mocked(useAuth),
};
const asResult = <T,>(partial: object) => partial as T;
type Result = ReturnType<typeof useMyPostsPage>;

const post = (id: string, title: string, published = false) => ({
  id,
  title,
  content: "",
  published,
  created: "2026-01-01T00:00:00Z",
});

describe("DashboardPage states", () => {
  beforeEach(() => {
    mocked.auth.mockReturnValue(asResult({ user: { id: "u1", name: "Alice" } }));
    const mutation = { mutateAsync: jest.fn(), mutate: jest.fn(), isPending: false };
    jest.mocked(useCreatePost).mockReturnValue(asResult(mutation));
    jest.mocked(useUpdatePost).mockReturnValue(asResult(mutation));
    jest.mocked(useDeletePost).mockReturnValue(asResult(mutation));
  });

  it("shows a table-shaped skeleton while loading", () => {
    mocked.myPosts.mockReturnValue(asResult<Result>({ isLoading: true }));
    renderWithProviders(<DashboardPage />);
    expect(screen.getByTestId("my-posts-loading")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByTestId("my-posts")).not.toBeInTheDocument();
  });

  it("shows an error state with retry", async () => {
    const refetch = jest.fn();
    mocked.myPosts.mockReturnValue(
      asResult<Result>({ isError: true, error: new Error("offline"), refetch }),
    );
    renderWithProviders(<DashboardPage />);
    expect(screen.getByTestId("my-posts-error")).toHaveTextContent("offline");
    await userEvent.click(screen.getByTestId("my-posts-error-retry"));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows an empty state", () => {
    mocked.myPosts.mockReturnValue(asResult<Result>({ data: { items: [], totalItems: 0 } }));
    renderWithProviders(<DashboardPage />);
    expect(screen.getByTestId("my-posts-empty")).toHaveTextContent("You have no posts yet.");
  });

  it("shows a 'no matches' empty state with a way to clear the filters", async () => {
    mocked.myPosts.mockReturnValue(asResult<Result>({ data: { items: [], totalItems: 0 } }));
    renderWithProviders(<DashboardPage />, { route: "/dashboard?q=zzz" });
    expect(screen.getByTestId("my-posts-empty")).toHaveTextContent("No matches");
    await userEvent.click(screen.getByTestId("my-posts-clear"));
    expect(screen.queryByTestId("my-posts-clear")).not.toBeInTheDocument();
  });

  it("renders the toolbar, sortable headers, rows and the page range", () => {
    mocked.myPosts.mockReturnValue(
      asResult<Result>({
        data: { items: [post("p1", "Hello", true), post("p2", "Second")], totalItems: 41 },
      }),
    );
    renderWithProviders(<DashboardPage />, { route: "/dashboard?sort=title&page=2" });
    expect(screen.getByTestId("my-posts-toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("my-posts-search")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /title/i })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(screen.getAllByTestId("my-post-row")).toHaveLength(2);
    expect(within(screen.getAllByTestId("my-post-row")[1]!).getByText("Draft")).toBeInTheDocument();
    expect(screen.getByTestId("my-posts-showing")).toHaveTextContent("Showing 21–40 of 41");
    expect(mocked.myPosts).toHaveBeenLastCalledWith("u1", {
      page: 2,
      sort: "title",
      q: "",
      published: "",
    });
  });
});
