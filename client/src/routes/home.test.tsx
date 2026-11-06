import userEvent from "@testing-library/user-event";
import { HomePage } from "./home";
import { usePublishedPostsPage } from "@/hooks/use-posts";
import { renderWithProviders, screen } from "@/test/test-utils";

jest.mock("@/hooks/use-posts");
const mockedUsePosts = jest.mocked(usePublishedPostsPage);

type Result = ReturnType<typeof usePublishedPostsPage>;
const asResult = (partial: object) => partial as Result;

describe("HomePage", () => {
  it("shows skeletons while loading", () => {
    mockedUsePosts.mockReturnValue(asResult({ isLoading: true }));
    renderWithProviders(<HomePage />);
    expect(screen.getByRole("heading", { name: /latest posts/i })).toBeInTheDocument();
    expect(screen.getByTestId("posts-loading")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders a card per post with the author, the toolbar and the page range", () => {
    mockedUsePosts.mockReturnValue(
      asResult({
        data: {
          items: [
            {
              id: "1",
              slug: "hello",
              title: "Hello world",
              content: "Body",
              created: "2026-01-01T00:00:00Z",
              expand: { author: { name: "Alice" } },
            },
          ],
          totalItems: 1,
        },
      }),
    );
    renderWithProviders(<HomePage />, { route: "/?sort=title&q=hello" });
    expect(screen.getByRole("link", { name: "Hello world" })).toHaveAttribute(
      "href",
      "/posts/hello",
    );
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByTestId("posts-search")).toHaveValue("hello");
    expect(screen.getByTestId("posts-sort")).toHaveTextContent("Title A–Z");
    expect(screen.getByTestId("posts-showing")).toHaveTextContent("Showing 1–1 of 1");
    expect(mockedUsePosts).toHaveBeenLastCalledWith({ page: 1, sort: "title", q: "hello" });
  });

  it("shows an empty state", () => {
    mockedUsePosts.mockReturnValue(asResult({ data: { items: [], totalItems: 0 } }));
    renderWithProviders(<HomePage />);
    expect(screen.getByTestId("posts-empty")).toHaveTextContent("Nothing published yet.");
  });

  it("shows 'no matches' with a clear action when a search is active", async () => {
    mockedUsePosts.mockReturnValue(asResult({ data: { items: [], totalItems: 0 } }));
    renderWithProviders(<HomePage />, { route: "/?q=zzz" });
    expect(screen.getByTestId("posts-empty")).toHaveTextContent("No matches");
    await userEvent.click(screen.getByTestId("posts-clear"));
    expect(screen.queryByTestId("posts-clear")).not.toBeInTheDocument();
  });

  it("shows errors with a retry", async () => {
    const refetch = jest.fn();
    mockedUsePosts.mockReturnValue(
      asResult({ isError: true, error: new Error("boom") as Result["error"], refetch }),
    );
    renderWithProviders(<HomePage />);
    expect(screen.getByRole("alert")).toHaveTextContent("boom");
    await userEvent.click(screen.getByTestId("posts-error-retry"));
    expect(refetch).toHaveBeenCalled();
  });
});
