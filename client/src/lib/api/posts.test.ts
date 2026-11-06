import {
  authorName,
  createPost,
  listMyPostsPage,
  listPublishedPostsPage,
  type PostWithAuthor,
} from "./posts";

const getList = jest.fn();
const create = jest.fn();

jest.mock("@/lib/pocketbase", () => ({
  pb: {
    collection: () => ({ getList, create }),
    filter: (expr: string, params: Record<string, string>) =>
      expr.replace(/\{:(\w+)\}/g, (_, k: string) => JSON.stringify(params[k])),
  },
}));

describe("posts api", () => {
  it("pages, sorts and searches published posts", async () => {
    getList.mockResolvedValue({ items: [], totalItems: 0 });
    await listPublishedPostsPage({ page: 2, sort: "title", q: " vite " });
    expect(getList).toHaveBeenCalledWith(2, 20, {
      filter: 'published = true && title ~ "vite"',
      sort: "title",
      expand: "author",
    });
  });

  it("scopes my posts to the author and the status filter", async () => {
    getList.mockResolvedValue({ items: [], totalItems: 0 });
    await listMyPostsPage("u1", { page: 1, sort: "-created", published: "false" });
    expect(getList).toHaveBeenCalledWith(1, 20, {
      filter: 'author = "u1" && published = false',
      sort: "-created",
      expand: "author",
    });
  });

  it("attaches the author id when creating", async () => {
    create.mockResolvedValue({ id: "p1" });
    await createPost({ title: "T", content: "C", published: false }, "u1");
    expect(create).toHaveBeenCalledWith({
      title: "T",
      content: "C",
      published: false,
      author: "u1",
    });
  });

  it("falls back when the author is not expanded", () => {
    const post = { expand: undefined } as unknown as PostWithAuthor;
    expect(authorName(post)).toBe("Unknown author");
    const withAuthor = { expand: { author: { name: "Alice" } } } as unknown as PostWithAuthor;
    expect(authorName(withAuthor)).toBe("Alice");
  });
});
