import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { DetailSkeleton, LoadingRegion } from "@/components/skeletons";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { usePost } from "@/hooks/use-posts";
import { authorName } from "@/lib/api/posts";
import { formatDate } from "@/lib/format";

export function PostDetailPage() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading, isError } = usePost(slug);

  if (isLoading) {
    return (
      <LoadingRegion testId="post-loading">
        <DetailSkeleton />
      </LoadingRegion>
    );
  }

  // A missing post (404) is an empty state, not an error: the request worked, there is nothing.
  if (isError || !post) {
    return (
      <EmptyState
        title={t("post.missing")}
        testId="post-empty"
        action={
          <Button asChild variant="outline">
            <Link to="/">
              <ArrowLeft /> {t("post.backHome")}
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <article className="prose-neutral max-w-3xl space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/">
          <ArrowLeft /> {t("post.allPosts")}
        </Link>
      </Button>
      <h1 className="text-3xl font-semibold tracking-tight" data-testid="post-title">
        {post.title}
      </h1>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm text-muted-foreground">
          {authorName(post, t("post.unknownAuthor"))} · {formatDate(post.created)}
        </p>
      </div>
      <div className="leading-7 whitespace-pre-wrap" data-testid="post-content">
        {post.content}
      </div>
    </article>
  );
}
