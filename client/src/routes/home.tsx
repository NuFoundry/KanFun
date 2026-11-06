import { useTranslation } from "react-i18next";
import { ListPagination } from "@/components/list-pagination";
import { ListSearch, ListSelect, ListToolbar } from "@/components/list-toolbar";
import { PostCard, PostCardSkeleton } from "@/components/post-card";
import { LoadingRegion } from "@/components/skeletons";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useListParams } from "@/hooks/use-list-params";
import { usePublishedPostsPage } from "@/hooks/use-posts";
import { PAGE_SIZE } from "@/lib/api/posts";
import { repeat } from "@/lib/utils";

export function HomePage() {
  const { t } = useTranslation();
  const list = useListParams({ sort: "-created", sortable: ["created", "title"] });
  const { data, isLoading, isError, error, refetch } = usePublishedPostsPage({
    page: list.page,
    sort: list.sort,
    q: list.q,
  });
  const posts = data?.items;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("home.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("home.subtitle")}</p>
      </div>

      <ListToolbar testId="posts">
        <ListSearch
          testId="posts"
          value={list.q}
          onChange={(q) => list.set({ q })}
          placeholder={t("home.searchPlaceholder")}
        />
        <ListSelect
          testId="posts-sort"
          value={list.sort}
          onChange={(sort) => list.set({ sort })}
          label={t("list.sortBy")}
          options={[
            { value: "-created", label: t("list.newestFirst") },
            { value: "created", label: t("list.oldestFirst") },
            { value: "title", label: t("list.titleAZ") },
            { value: "-title", label: t("list.titleZA") },
          ]}
        />
      </ListToolbar>

      {isLoading && (
        <LoadingRegion testId="posts-loading" className="grid gap-4 sm:grid-cols-2">
          {repeat(4, (index) => (
            <PostCardSkeleton key={index} />
          ))}
        </LoadingRegion>
      )}

      {isError && <ErrorState error={error} onRetry={() => void refetch()} testId="posts-error" />}

      {posts && posts.length === 0 && list.isFiltered && (
        <EmptyState
          title={t("list.noMatches")}
          description={t("list.noMatchesHint")}
          action={
            <Button variant="outline" size="sm" onClick={list.clear} data-testid="posts-clear">
              {t("list.clearFilters")}
            </Button>
          }
          testId="posts-empty"
        />
      )}

      {posts && posts.length === 0 && !list.isFiltered && (
        <EmptyState title={t("home.empty")} description={t("home.subtitle")} testId="posts-empty" />
      )}

      {data && posts && posts.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2" data-testid="post-list">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
          <ListPagination
            testId="posts"
            page={list.page}
            perPage={PAGE_SIZE}
            total={data.totalItems}
            onPage={(page) => list.set({ page })}
          />
        </>
      )}
    </section>
  );
}
