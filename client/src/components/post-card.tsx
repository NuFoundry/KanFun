import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { authorName, type PostWithAuthor } from "@/lib/api/posts";
import { formatDate, truncate } from "@/lib/format";

export function PostCard({ post }: { post: PostWithAuthor }) {
  const { t } = useTranslation();
  return (
    <Card className="rise transition-shadow hover:shadow-md" data-testid="post-card">
      <CardHeader>
        <CardTitle>
          <Link to={`/posts/${post.slug}`} className="hover:underline">
            {post.title}
          </Link>
        </CardTitle>
        <CardDescription>
          {authorName(post, t("post.unknownAuthor"))} · {formatDate(post.created)}
        </CardDescription>
      </CardHeader>
      {post.content && (
        <CardContent className="text-sm text-muted-foreground">
          {truncate(post.content, 160)}
        </CardContent>
      )}
    </Card>
  );
}

/** Same card chrome as PostCard with placeholders for title, meta and two lines of excerpt. */
export function PostCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-5 w-2/3" />
        </CardTitle>
        <CardDescription>
          <Skeleton className="h-4 w-40" />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </CardContent>
    </Card>
  );
}
