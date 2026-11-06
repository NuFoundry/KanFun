import { z } from "zod";
import { defineTool, ToolError, type ToolContext } from "./tool";

/** PocketBase's answers, as the agent should read them (its own texts can carry internals). */
function explain(error: unknown, what = "post"): never {
  const status = (error as { status?: number }).status;
  if (status === 404) throw new ToolError(`No ${what} with this id that you can see`);
  if (status === 403) throw new ToolError(`You may not change this ${what}`);
  if (status === 400) {
    const fields = Object.keys((error as { response?: { data?: object } }).response?.data ?? {});
    throw new ToolError(`Invalid data${fields.length ? `: ${fields.join(", ")}` : ""}`);
  }
  throw error;
}

const id = z.string().regex(/^[a-z0-9]{15}$/, "a post id (15 characters)");

function summary(post: Record<string, unknown>) {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    published: post.published,
    author: post.author,
    created: post.created,
    updated: post.updated,
  };
}

async function own(ctx: ToolContext, postId: string) {
  const post = await ctx.records.get("posts", postId).catch((error) => explain(error));
  if (post.author !== ctx.user) throw new ToolError("You may not change this post");
  return post;
}

const SORT = { newest: "-created", oldest: "created", title: "title" } as const;

export const postTools = [
  defineTool({
    name: "list_posts",
    title: "List posts",
    description:
      "Lists posts, 20 per page: the user's own (drafts included) or, with mine=false, every published post. Optional search in title and text.",
    scope: "posts:read",
    kind: "read",
    input: z.object({
      mine: z.boolean().default(true).describe("Only the user's own posts"),
      search: z.string().trim().max(100).optional().describe("Words in the title or text"),
      published: z.boolean().optional().describe("Only published (true) or drafts (false)"),
      sort: z.enum(["newest", "oldest", "title"]).default("newest"),
      page: z.number().int().min(1).max(1000).default(1),
    }),
    async run(input, ctx) {
      const parts: string[] = [];
      const params: Record<string, unknown> = { user: ctx.user };
      if (input.mine) parts.push("author = {:user}");
      else parts.push("published = true");
      if (input.published !== undefined) {
        parts.push("published = {:published}");
        params.published = input.published;
      }
      if (input.search) {
        parts.push("(title ~ {:search} || content ~ {:search})");
        params.search = input.search;
      }
      const list = await ctx.records.list("posts", {
        page: input.page,
        perPage: 20,
        sort: SORT[input.sort],
        filter: ctx.records.filter(parts.join(" && "), params),
      });
      return {
        page: list.page,
        totalPages: list.totalPages,
        totalItems: list.totalItems,
        posts: list.items.map(summary),
      };
    },
  }),
  defineTool({
    name: "get_post",
    title: "Read a post",
    description: "Returns one post with its full text: a published post or one of the user's own.",
    scope: "posts:read",
    kind: "read",
    input: z.object({ id }),
    async run(input, ctx) {
      const post = await ctx.records.get("posts", input.id).catch((error) => explain(error));
      return { ...summary(post), content: post.content };
    },
  }),
  defineTool({
    name: "create_post",
    title: "Create a post",
    description:
      "Creates a post as a draft owned by the user. Publish it with publish_post once the user agrees.",
    scope: "posts:write",
    kind: "write",
    input: z.object({
      title: z.string().trim().min(1).max(200),
      content: z.string().max(20_000).default(""),
    }),
    async run(input, ctx) {
      const post = await ctx.records
        .create("posts", { ...input, published: false, author: ctx.user })
        .catch((error) => explain(error));
      return summary(post);
    },
  }),
  defineTool({
    name: "update_post",
    title: "Edit a post",
    description: "Changes the title and/or the text of one of the user's posts.",
    scope: "posts:write",
    kind: "write",
    input: z
      .object({
        id,
        title: z.string().trim().min(1).max(200).optional(),
        content: z.string().max(20_000).optional(),
      })
      .refine((v) => v.title !== undefined || v.content !== undefined, "title or content"),
    async run({ id: postId, ...changes }, ctx) {
      await own(ctx, postId);
      const post = await ctx.records
        .update("posts", postId, changes)
        .catch((error) => explain(error));
      return summary(post);
    },
  }),
  defineTool({
    name: "publish_post",
    title: "Publish or unpublish a post",
    description:
      "Makes one of the user's posts public (published=true) or a draft again (published=false).",
    scope: "posts:write",
    kind: "write",
    input: z.object({ id, published: z.boolean().default(true) }),
    async run(input, ctx) {
      await own(ctx, input.id);
      const post = await ctx.records
        .update("posts", input.id, { published: input.published })
        .catch((error) => explain(error));
      return summary(post);
    },
  }),
  defineTool({
    name: "delete_post",
    title: "Delete a post",
    description: "Deletes one of the user's posts for good. Ask the user before calling it.",
    scope: "posts:delete",
    kind: "delete",
    input: z.object({ id }),
    async run(input, ctx) {
      await own(ctx, input.id);
      await ctx.records.delete("posts", input.id).catch((error) => explain(error));
      return { deleted: input.id };
    },
  }),
];
