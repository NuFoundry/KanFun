import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ListPagination } from "@/components/list-pagination";
import { ListSearch, ListSelect, ListToolbar, SortableHead } from "@/components/list-toolbar";
import { LoadingRegion, TableSkeleton } from "@/components/skeletons";
import { EmptyState, ErrorState } from "@/components/states";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useListParams } from "@/hooks/use-list-params";
import { useCreatePost, useDeletePost, useMyPostsPage, useUpdatePost } from "@/hooks/use-posts";
import { useAuth } from "@/lib/auth-context";
import { PAGE_SIZE } from "@/lib/api/posts";
import { applyServerErrors } from "@/lib/form-errors";
import { formatDate } from "@/lib/format";

export function DashboardPage() {
  const { t } = useTranslation();
  const postSchema = z.object({
    title: z.string().min(1, t("validation.titleRequired")).max(200),
    content: z.string().max(20000),
    published: z.boolean(),
  });
  type PostValues = z.infer<typeof postSchema>;

  const { user } = useAuth();
  const userId = user?.id ?? "";
  const list = useListParams({
    sort: "-created",
    sortable: ["title", "created"],
    filters: ["status"],
  });
  const { data, isLoading, isError, error, refetch } = useMyPostsPage(userId, {
    page: list.page,
    sort: list.sort,
    q: list.q,
    published: list.filters.status as "" | "true" | "false",
  });
  const posts = data?.items;
  const createPost = useCreatePost(userId);
  const updatePost = useUpdatePost();
  const deletePost = useDeletePost();
  const [open, setOpen] = useState(false);

  const form = useForm<PostValues>({
    resolver: zodResolver(postSchema),
    defaultValues: { title: "", content: "", published: false },
  });

  async function onSubmit(values: PostValues) {
    try {
      await createPost.mutateAsync(values);
      toast.success(t("dashboard.created"));
      form.reset();
      setOpen(false);
    } catch (error) {
      const message = applyServerErrors(
        error,
        (name, err) => form.setError(name as keyof PostValues, err),
        ["title", "content", "published"],
      );
      if (message) toast.error(message);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("dashboard.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("dashboard.signedInAs", { name: user?.name || user?.email })}
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="new-post">
              <Plus /> {t("dashboard.newPost")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("dashboard.newPost")}</DialogTitle>
              <DialogDescription>{t("dashboard.draftHint")}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
                data-testid="post-form"
              >
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("dashboard.postTitle")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("dashboard.content")}</FormLabel>
                      <FormControl>
                        <Textarea rows={6} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="published"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="font-normal">{t("dashboard.publishNow")}</FormLabel>
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createPost.isPending}>
                  {t("dashboard.save")}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <ListToolbar testId="my-posts">
        <ListSearch
          testId="my-posts"
          value={list.q}
          onChange={(q) => list.set({ q })}
          placeholder={t("dashboard.searchPlaceholder")}
        />
        <ListSelect
          testId="my-posts-status"
          value={list.filters.status}
          onChange={(status) => list.set({ status })}
          label={t("dashboard.status")}
          options={[
            { value: "", label: t("list.all") },
            { value: "true", label: t("dashboard.statusPublished") },
            { value: "false", label: t("dashboard.statusDraft") },
          ]}
        />
      </ListToolbar>

      {isLoading && (
        <LoadingRegion testId="my-posts-loading">
          <TableSkeleton rows={5} />
        </LoadingRegion>
      )}

      {isError && (
        <ErrorState error={error} onRetry={() => void refetch()} testId="my-posts-error" />
      )}

      {posts && posts.length === 0 && list.isFiltered && (
        <EmptyState
          title={t("list.noMatches")}
          description={t("list.noMatchesHint")}
          action={
            <Button variant="outline" size="sm" onClick={list.clear} data-testid="my-posts-clear">
              {t("list.clearFilters")}
            </Button>
          }
          testId="my-posts-empty"
        />
      )}

      {posts && posts.length === 0 && !list.isFiltered && (
        <EmptyState
          title={t("dashboard.empty")}
          description={t("dashboard.draftHint")}
          testId="my-posts-empty"
        />
      )}

      {data && posts && posts.length > 0 && (
        <Card className="overflow-hidden">
          <Table data-testid="my-posts">
            <TableHeader>
              <TableRow>
                <SortableHead column="title" sort={list.sort} onSort={list.toggleSort}>
                  {t("dashboard.colTitle")}
                </SortableHead>
                <SortableHead column="created" sort={list.sort} onSort={list.toggleSort}>
                  {t("dashboard.colCreated")}
                </SortableHead>
                <TableHead>{t("dashboard.colPublished")}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id} data-testid="my-post-row">
                  <TableCell className="font-medium">
                    {post.title}{" "}
                    {!post.published && (
                      <Badge variant="secondary" className="ml-2">
                        {t("dashboard.draft")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(post.created)}
                  </TableCell>
                  <TableCell>
                    <Switch
                      aria-label={t("dashboard.publish", { title: post.title })}
                      checked={post.published}
                      onCheckedChange={(published) =>
                        updatePost.mutate({ id: post.id, input: { published } })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("dashboard.delete", { title: post.title })}
                        >
                          <Trash2 />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t("dashboard.deleteTitle", { title: post.title })}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("dashboard.deleteHint")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("dashboard.cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              deletePost.mutate(post.id, {
                                onSuccess: () => toast.success(t("dashboard.deleted")),
                              })
                            }
                          >
                            {t("dashboard.confirmDelete")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {data && posts && posts.length > 0 && (
        <ListPagination
          testId="my-posts"
          page={list.page}
          perPage={PAGE_SIZE}
          total={data.totalItems}
          onPage={(page) => list.set({ page })}
        />
      )}
    </section>
  );
}
