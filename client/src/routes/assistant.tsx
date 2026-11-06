import { useQueryClient } from "@tanstack/react-query";
import { PanelLeft, SquarePen } from "lucide-react";
import { ClientResponseError } from "pocketbase";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { ChatComposer } from "@/components/assistant/chat-composer";
import { ChatMessages } from "@/components/assistant/chat-messages";
import { ConversationList } from "@/components/assistant/conversation-list";
import { useAttachments } from "@/components/assistant/use-attachments";
import { LoadingRegion } from "@/components/skeletons";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { conversationKeys, useAiHealth, useConversation } from "@/hooks/use-conversations";
import { streamChat, type ChatMessage } from "@/lib/api/ai";
import { createConversation, saveMessages, type StoredMessage } from "@/lib/api/conversations";
import { chatFiles, turnBudget } from "@/lib/attachments";
import { currentLocale } from "@/lib/format";

/**
 * What one turn sends to the model: the newest messages up to HISTORY_LIMIT and HISTORY_CHARS
 * (the service refuses more than 100 messages or 100,000 characters), each cut to MESSAGE_LIMIT,
 * with their files while the turn's allowance lasts (lib/attachments.ts). The reply is capped at
 * MAX_REPLY_TOKENS (the service's maximum). The system prompt is built by the service, never here.
 */
const HISTORY_LIMIT = 40;
const HISTORY_CHARS = 90_000;
const MESSAGE_LIMIT = 20_000;
const MAX_REPLY_TOKENS = 4096;

/** The recent part of a conversation that fits what the service accepts. */
function toModelMessages(messages: StoredMessage[]): ChatMessage[] {
  const recent: ChatMessage[] = [];
  const budget = turnBudget();
  let chars = 0;
  for (const message of messages.slice(-HISTORY_LIMIT).reverse()) {
    const { files, left } = chatFiles(message.files, budget);
    // Files left out are named, so the model knows they existed.
    const content = [
      message.content.slice(0, MESSAGE_LIMIT),
      ...left.map((name) => `(Attached earlier, no longer available: ${name})`),
    ]
      .filter(Boolean)
      .join("\n\n");
    if (chars + content.length > HISTORY_CHARS && recent.length > 0) break;
    chars += content.length;
    recent.unshift({ role: message.role, content, ...(files.length ? { files } : {}) });
  }
  return recent;
}

/**
 * The assistant, modelled on a chat app: previous conversations on the left (a sheet on phones),
 * streaming replies, a growing message box with files and voice input. A conversation is saved
 * once its first reply has arrived, then after every exchange; attached files stay in this tab
 * (only their names are saved).
 */
export function AssistantPage() {
  const { t } = useTranslation();
  const language = currentLocale().slice(0, 2);
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const stored = useConversation(conversationId);
  const health = useAiHealth();

  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [input, setInput] = useState("");
  // The conversation whose reply is being written ("" = a new one), null when none is.
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const streamingFor = useRef<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const attachments = useAttachments();
  const [dragging, setDragging] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  // The conversation the messages on screen belong to ("" = a new, unsaved one). The ref mirrors
  // it for the streaming loop, which outlives renders.
  const [shownId, setShownId] = useState("");
  const shown = useRef("");
  const show = (id: string, next: StoredMessage[]) => {
    setShownId(id);
    setMessages(next);
  };
  useEffect(() => {
    shown.current = shownId;
  }, [shownId]);

  // Switching conversations (or starting a new one) replaces what is on screen once the route
  // changes; a saved conversation appears when it has loaded. Only route changes count: React
  // Router navigates in a transition, so right after this page saves a new conversation the old
  // route still renders once while the new conversation is already shown.
  const wanted = conversationId ?? "";
  const [routeId, setRouteId] = useState(wanted);
  if (wanted !== routeId) {
    setRouteId(wanted);
    if (!wanted && shownId) show("", []);
  }
  if (wanted && wanted === routeId && wanted !== shownId && stored.data?.id === wanted) {
    show(wanted, stored.data.messages ?? []);
  }

  // Leaving the conversation whose reply is being written stops it (what arrived so far is still
  // saved). A route that only catches up with a chat that was just saved stops nothing: React
  // Router commits that navigation in a transition, possibly after the next question started.
  const routed = useRef(conversationId);
  useEffect(() => {
    const previous = routed.current;
    routed.current = conversationId;
    const streamed = streamingFor.current;
    if (previous !== conversationId && streamed !== null && (conversationId ?? "") !== streamed) {
      abort.current?.abort();
    }
  }, [conversationId]);
  // Set on every mount: StrictMode runs the cleanup once at mount and keeps the ref.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abort.current?.abort();
    };
  }, []);
  const streaming = streamingId !== null && streamingId === shownId;

  async function send(content = input.trim()) {
    const files = attachments.files;
    if ((!content && !files.length) || streaming || attachments.reading) return;
    // Where this exchange is saved, even if the user opens another conversation meanwhile.
    const target = shown.current;
    const before = messages;
    const withQuestion: StoredMessage[] = [
      ...messages,
      { role: "user", content, ...(files.length ? { files } : {}) },
    ];
    const onScreen = () => shown.current === target;
    const finish = () => {
      streamingFor.current = null;
      setStreamingId(null);
    };
    setMessages(withQuestion);
    setInput("");
    attachments.clear();
    streamingFor.current = target;
    setStreamingId(target);
    const controller = new AbortController();
    abort.current = controller;
    const reply: StoredMessage = { role: "assistant", content: "" };
    try {
      const stream = streamChat(toModelMessages(withQuestion), {
        signal: controller.signal,
        maxTokens: MAX_REPLY_TOKENS,
        language,
      });
      for await (const delta of stream) {
        reply.content += delta;
        if (onScreen()) setMessages([...withQuestion, { ...reply }]);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        toast.error(error instanceof Error ? error.message : t("assistant.unavailable"));
      }
      // Nothing arrived while the user is still here: give the question back to edit and resend.
      // Off screen the question is saved with the conversation instead of being lost.
      if (!reply.content && onScreen()) {
        setMessages(before);
        setInput(content);
        attachments.restore(files);
        finish();
        return;
      }
    }
    streamingFor.current = null;
    const all = reply.content ? [...withQuestion, reply] : withQuestion;
    if (onScreen()) setMessages(all);
    // The turn only ends once it is saved: a message sent before a new conversation has its id
    // (and its route) would land in a second conversation. The saved record goes into the cache,
    // so reopening the conversation later never shows (and then overwrites) an older copy.
    try {
      if (target) {
        const saved = await saveMessages(target, all);
        queryClient.setQueryData(conversationKeys.detail(target), saved);
      } else {
        const created = await createConversation(all);
        queryClient.setQueryData(conversationKeys.detail(created.id), created);
        if (mounted.current && onScreen()) {
          show(created.id, all);
          navigate(`/assistant/${created.id}`, { replace: true });
        }
      }
      void queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("assistant.saveFailed"));
    }
    finish();
  }

  const missing =
    Boolean(conversationId) &&
    stored.isError &&
    stored.error instanceof ClientResponseError &&
    stored.error.status === 404;
  const loading = Boolean(conversationId) && stored.isLoading && shownId !== conversationId;
  // Any other load failure: the conversation in the URL must not be replaced by a new one.
  const failed = Boolean(conversationId) && stored.isError && !missing;
  const title = conversationId ? stored.data?.title : undefined;
  const suggestions = [
    t("assistant.suggestions.explain"),
    t("assistant.suggestions.write"),
    t("assistant.suggestions.ideas"),
  ];

  const empty = (
    <div
      className="flex flex-col items-center gap-6 pt-[12vh] text-center"
      data-testid="chat-empty"
    >
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        {t("assistant.greeting")}
      </h1>
      <div className="flex max-w-xl flex-wrap justify-center gap-2">
        {suggestions.map((suggestion) => (
          <Button
            key={suggestion}
            type="button"
            variant="outline"
            size="sm"
            className="h-auto rounded-full px-3 py-1.5 font-normal whitespace-normal"
            onClick={() => void send(suggestion)}
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className="-my-4 flex h-[calc(100dvh-11rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-[30rem] overflow-hidden rounded-xl border bg-card"
      // Files dropped anywhere on the assistant (the list too, where the browser would otherwise
      // open them) are attached to the next message.
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        setDragging(false);
        attachments.add([...event.dataTransfer.files]);
      }}
    >
      <aside className="hidden w-64 shrink-0 border-r bg-muted/40 p-3 md:block">
        <ConversationList activeId={conversationId} />
      </aside>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-xs p-3 pt-12">
          <SheetTitle className="sr-only">{t("assistant.history")}</SheetTitle>
          <ConversationList activeId={conversationId} onNavigate={() => setHistoryOpen(false)} />
        </SheetContent>
      </Sheet>

      <section className="relative flex min-w-0 flex-1 flex-col" data-testid="assistant">
        {dragging && (
          <div
            className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/85 text-sm font-medium"
            data-testid="drop-zone"
          >
            {t("assistant.files.drop")}
          </div>
        )}
        <div className="flex h-12 shrink-0 items-center gap-1 border-b px-2 md:px-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setHistoryOpen(true)}
            aria-label={t("assistant.openHistory")}
            data-testid="open-history"
          >
            <PanelLeft />
          </Button>
          <p className="min-w-0 flex-1 truncate text-sm font-medium">
            {title || t("assistant.title")}
          </p>
          <Button asChild variant="ghost" size="icon" className="md:hidden">
            <Link to="/assistant" aria-label={t("assistant.newChat")}>
              <SquarePen />
            </Link>
          </Button>
        </div>

        {missing ? (
          <div className="p-4">
            <EmptyState
              title={t("assistant.missing")}
              action={
                <Button asChild variant="outline">
                  <Link to="/assistant">{t("assistant.newChat")}</Link>
                </Button>
              }
              testId="conversation-empty"
            />
          </div>
        ) : failed ? (
          <div className="p-4">
            <ErrorState
              error={stored.error}
              onRetry={() => void stored.refetch()}
              testId="conversation-error"
            />
          </div>
        ) : loading ? (
          <LoadingRegion testId="conversation-loading" className="min-h-0 flex-1 overflow-hidden">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
              <Skeleton className="ml-auto h-10 w-2/5 rounded-2xl" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-3/5" />
              </div>
              <Skeleton className="ml-auto h-10 w-1/3 rounded-2xl" />
            </div>
          </LoadingRegion>
        ) : (
          <ChatMessages messages={messages} streaming={streaming} empty={empty} />
        )}

        <div className="mx-auto w-full max-w-3xl shrink-0 px-3 pt-1 pb-3 md:px-4 md:pb-4">
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={() => void send()}
            onStop={() => abort.current?.abort()}
            streaming={streaming}
            loading={loading || failed}
            voice={health.data?.transcription ?? false}
            language={language}
            autoFocus={!conversationId}
            files={attachments.files}
            onAddFiles={attachments.add}
            onRemoveFile={attachments.remove}
          />
          <p className="mt-2 hidden text-center text-xs text-muted-foreground md:block">
            {t("assistant.disclaimer")}
          </p>
        </div>
      </section>
    </div>
  );
}
