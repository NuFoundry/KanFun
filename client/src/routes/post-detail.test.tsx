import { Route, Routes } from "react-router";
import { PostDetailPage } from "./post-detail";
import { usePost } from "@/hooks/use-posts";
import { renderWithProviders, screen } from "@/test/test-utils";

jest.mock("@/hooks/use-posts");
const mockedUsePost = jest.mocked(usePost);
const asResult = (partial: object) => partial as ReturnType<typeof usePost>;

const post = {
  id: "1",
  slug: "hello",
  title: "Hello world",
  content: "First line\n\nSecond",
  created: "2026-01-15 10:00:00.000Z",
  expand: { author: { name: "Alice" } },
};

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/posts/:slug" element={<PostDetailPage />} />
    </Routes>,
    { route: "/posts/hello" },
  );
}

describe("PostDetailPage", () => {
  it("shows a skeleton while loading", () => {
    mockedUsePost.mockReturnValue(asResult({ isLoading: true }));
    renderPage();
    expect(screen.getByTestId("post-loading")).toHaveAttribute("aria-busy", "true");
  });

  it("shows an empty state for a missing post", () => {
    mockedUsePost.mockReturnValue(asResult({ isError: true }));
    renderPage();
    expect(screen.getByTestId("post-empty")).toBeInTheDocument();
  });

  it("shows the post with its author", () => {
    mockedUsePost.mockReturnValue(asResult({ data: post }));
    renderPage();
    expect(screen.getByTestId("post-title")).toHaveTextContent("Hello world");
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByTestId("post-content")).toHaveTextContent("Second");
  });
});
