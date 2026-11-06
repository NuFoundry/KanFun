import type { Records } from "../lib/types";
import { TOOLS } from ".";
import { SCOPES } from "../lib/scopes";

const tool = (name: string) => TOOLS.find((t) => t.name === name)!;

function records(overrides: Partial<Records> = {}): Records {
  return {
    list: jest.fn(async () => ({ items: [], page: 1, totalPages: 0, totalItems: 0 })),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    filter: (expression, params) => `${expression} ${JSON.stringify(params)}`,
    ...overrides,
  };
}

describe("tools", () => {
  it("each needs a known permission, changes need write or delete, names are unique", () => {
    expect(new Set(TOOLS.map((t) => t.name)).size).toBe(TOOLS.length);
    for (const t of TOOLS) {
      if (t.scope) expect(SCOPES).toContain(t.scope);
      if (t.kind === "write") expect(t.scope).toMatch(/:write$/);
      if (t.kind === "delete") expect(t.scope).toMatch(/:delete$/);
    }
  });

  it("list_posts binds every value as a parameter", async () => {
    const r = records();
    await tool("list_posts").run(
      tool("list_posts").input.parse({
        search: '" || author != "',
        published: false,
        sort: "title",
      }),
      { user: "alice", records: r, scopes: ["posts:read"] },
    );
    expect(r.list).toHaveBeenCalledWith("posts", {
      page: 1,
      perPage: 20,
      sort: "title",
      filter:
        "author = {:user} && published = {:published} && (title ~ {:search} || content ~ {:search}) " +
        JSON.stringify({ user: "alice", published: false, search: '" || author != "' }),
    });
  });

  it("other people's published posts only with mine=false", async () => {
    const r = records();
    await tool("list_posts").run(tool("list_posts").input.parse({ mine: false }), {
      user: "alice",
      records: r,
      scopes: ["posts:read"],
    });
    expect((r.list as jest.Mock).mock.calls[0][1].filter).toMatch(/^published = true /);
  });

  it("creates drafts owned by the user", async () => {
    const r = records({ create: jest.fn(async (_c, data) => ({ id: "p1", ...data })) });
    await tool("create_post").run(tool("create_post").input.parse({ title: "Hi" }), {
      user: "alice",
      records: r,
      scopes: ["posts:write"],
    });
    expect(r.create).toHaveBeenCalledWith("posts", {
      title: "Hi",
      content: "",
      published: false,
      author: "alice",
    });
  });

  it("explains PocketBase's validation errors by field, without its texts", async () => {
    const invalid = Object.assign(new Error("Failed to create record."), {
      status: 400,
      response: { data: { title: { message: "internal detail" } } },
    });
    const r = records({ create: jest.fn(async () => Promise.reject(invalid)) });
    await expect(
      tool("create_post").run(tool("create_post").input.parse({ title: "Hi" }), {
        user: "alice",
        records: r,
        scopes: ["posts:write"],
      }),
    ).rejects.toThrow(/^Invalid data: title$/);
  });
});
