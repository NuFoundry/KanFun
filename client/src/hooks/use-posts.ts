import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPost,
  deletePost,
  getPostBySlug,
  listMyPostsPage,
  listPublishedPostsPage,
  updatePost,
  type PostInput,
  type PostListQuery,
} from "@/lib/api/posts";

export const postKeys = {
  all: ["posts"] as const,
  published: () => [...postKeys.all, "published"] as const,
  mine: (userId: string) => [...postKeys.all, "mine", userId] as const,
  detail: (slug: string) => [...postKeys.all, "detail", slug] as const,
};

/** Paged lists keep the previous page on screen while the next one loads (no skeleton flash). */
export function usePublishedPostsPage(query: PostListQuery) {
  return useQuery({
    queryKey: [...postKeys.published(), query],
    queryFn: () => listPublishedPostsPage(query),
    placeholderData: keepPreviousData,
  });
}

export function useMyPostsPage(
  userId: string | undefined,
  query: PostListQuery & { published?: "" | "true" | "false" },
) {
  return useQuery({
    queryKey: [...postKeys.mine(userId ?? ""), query],
    queryFn: () => listMyPostsPage(userId!, query),
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
  });
}

export function usePost(slug: string | undefined) {
  return useQuery({
    queryKey: postKeys.detail(slug ?? ""),
    queryFn: () => getPostBySlug(slug!),
    enabled: Boolean(slug),
  });
}

function useInvalidatePosts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: postKeys.all });
}

export function useCreatePost(authorId: string) {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (input: PostInput) => createPost(input, authorId),
    onSuccess: invalidate,
  });
}

export function useUpdatePost() {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PostInput> }) => updatePost(id, input),
    onSuccess: invalidate,
  });
}

export function useDeletePost() {
  const invalidate = useInvalidatePosts();
  return useMutation({ mutationFn: deletePost, onSuccess: invalidate });
}
