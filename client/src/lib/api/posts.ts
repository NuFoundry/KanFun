/**
 * Data access for the `posts` collection. Pure functions over the PocketBase SDK;
 * React Query hooks live in src/hooks/use-posts.ts.
 */
import type { ListResult } from "pocketbase";
import type { PostsResponse, UsersResponse } from "@/lib/pb-types";
import { pb } from "@/lib/pocketbase";

export type PostWithAuthor = PostsResponse<{ author?: UsersResponse }>;

export type PostInput = {
  title: string;
  content: string;
  published: boolean;
};

const EXPAND_AUTHOR = { expand: "author" } as const;

export const PAGE_SIZE = 20;

/** One page of a list: `page` (1-based), PocketBase `sort` (`-created`), free text, filters. */
export type PostListQuery = { page: number; sort: string; q?: string };

function textFilter(q: string | undefined): string[] {
  return q?.trim() ? [pb.filter("title ~ {:q}", { q: q.trim() })] : [];
}

export async function listPublishedPostsPage(
  query: PostListQuery,
): Promise<ListResult<PostWithAuthor>> {
  return pb.collection("posts").getList<PostWithAuthor>(query.page, PAGE_SIZE, {
    filter: ["published = true", ...textFilter(query.q)].join(" && "),
    sort: query.sort,
    ...EXPAND_AUTHOR,
  });
}

export async function listMyPostsPage(
  userId: string,
  query: PostListQuery & { published?: "" | "true" | "false" },
): Promise<ListResult<PostWithAuthor>> {
  const filters = [pb.filter("author = {:userId}", { userId }), ...textFilter(query.q)];
  if (query.published) filters.push(`published = ${query.published}`);
  return pb.collection("posts").getList<PostWithAuthor>(query.page, PAGE_SIZE, {
    filter: filters.join(" && "),
    sort: query.sort,
    ...EXPAND_AUTHOR,
  });
}

export async function getPostBySlug(slug: string): Promise<PostWithAuthor> {
  return pb
    .collection("posts")
    .getFirstListItem<PostWithAuthor>(pb.filter("slug = {:slug}", { slug }), EXPAND_AUTHOR);
}

export async function createPost(input: PostInput, authorId: string): Promise<PostsResponse> {
  // `slug` is generated server-side by a hook (server/pb_hooks/main.pb.js) when omitted.
  return pb.collection("posts").create({ ...input, author: authorId });
}

export async function updatePost(id: string, input: Partial<PostInput>): Promise<PostsResponse> {
  return pb.collection("posts").update(id, input);
}

export async function deletePost(id: string): Promise<void> {
  await pb.collection("posts").delete(id);
}

export function authorName(post: PostWithAuthor, fallback = "Unknown author"): string {
  return post.expand?.author?.name || fallback;
}
