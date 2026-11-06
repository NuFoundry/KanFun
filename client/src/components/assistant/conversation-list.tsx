import { MoreHorizontal, Pencil, SquarePen, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { LoadingRegion } from "@/components/skeletons";
import { ErrorState } from "@/components/states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useConversations,
  useDeleteConversation,
  useRenameConversation,
} from "@/hooks/use-conversations";
import type { ConversationSummary } from "@/lib/api/conversations";
import { formatDate } from "@/lib/format";
import { cn, repeat } from "@/lib/utils";

/**
 * Previous conversations, newest first, with "New chat" on top. Used as the desktop sidebar and
 * inside the mobile sheet (`onNavigate` closes it).
 */
export function ConversationList({
  activeId,
  onNavigate,
}: {
  activeId: string | undefined;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const conversations = useConversations();
  const rename = useRenameConversation();
  const remove = useDeleteConversation();
  const [renaming, setRenaming] = useState<ConversationSummary | null>(null);
  const [title, setTitle] = useState("");
  const [deleting, setDeleting] = useState<ConversationSummary | null>(null);

  return (
    <div className="flex h-full flex-col gap-2" data-testid="conversation-list">
      <Button asChild variant="outline" className="justify-start" onClick={onNavigate}>
        <Link to="/assistant" data-testid="new-chat">
          <SquarePen /> {t("assistant.newChat")}
        </Link>
      </Button>
      <p className="px-2 pt-3 text-xs font-medium text-muted-foreground">
        {t("assistant.history")}
      </p>
      <nav className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
        {conversations.isLoading && (
          <LoadingRegion testId="conversations-loading" className="flex flex-col gap-0.5">
            {repeat(5, (index) => (
              <div key={index} className="flex flex-col gap-1.5 px-2 py-2">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </LoadingRegion>
        )}
        {conversations.isError && (
          <ErrorState
            error={conversations.error}
            onRetry={() => void conversations.refetch()}
            testId="conversations-error"
            className="px-3 py-6"
          />
        )}
        {conversations.data?.length === 0 && (
          <p className="px-2 text-sm text-muted-foreground" data-testid="conversations-empty">
            {t("assistant.noConversations")}
          </p>
        )}
        {conversations.data?.map((conversation) => (
          <div
            key={conversation.id}
            className={cn(
              "group flex items-center rounded-md hover:bg-accent",
              conversation.id === activeId && "bg-accent",
            )}
          >
            <Link
              to={`/assistant/${conversation.id}`}
              onClick={onNavigate}
              className="min-w-0 flex-1 px-2 py-2 text-sm"
              aria-current={conversation.id === activeId ? "page" : undefined}
              data-testid="conversation-link"
            >
              <span className="block truncate">
                {conversation.title || t("assistant.untitled")}
              </span>
              <span className="block text-xs text-muted-foreground">
                {formatDate(conversation.updated)}
              </span>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 opacity-100 data-[state=open]:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  aria-label={t("assistant.actions", { title: conversation.title })}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    setTitle(conversation.title);
                    setRenaming(conversation);
                  }}
                >
                  <Pencil /> {t("assistant.rename")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onSelect={() => setDeleting(conversation)}
                >
                  <Trash2 /> {t("assistant.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </nav>

      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="sm:max-w-sm">
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!renaming || !title.trim()) return;
              void rename
                .mutateAsync({ id: renaming.id, title })
                .then(() => setRenaming(null))
                .catch((error: Error) => toast.error(error.message));
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("assistant.renameTitle")}</DialogTitle>
            </DialogHeader>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              aria-label={t("assistant.renameTitle")}
              autoFocus
            />
            <DialogFooter>
              <Button type="submit" disabled={!title.trim() || rename.isPending}>
                {t("assistant.rename")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("assistant.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("assistant.deleteDescription", { title: deleting?.title ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("assistant.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleting) return;
                const id = deleting.id;
                void remove
                  .mutateAsync(id)
                  .then(() => {
                    toast.success(t("assistant.deleted"));
                    if (id === activeId) navigate("/assistant", { replace: true });
                  })
                  .catch((error: Error) => toast.error(error.message));
              }}
              data-testid="confirm-delete-conversation"
            >
              {t("assistant.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
