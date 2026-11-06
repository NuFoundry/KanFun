import { ArrowDown, Check, Copy } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Markdown, { type Components, type Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { Button } from "@/components/ui/button";
import type { StoredMessage } from "@/lib/api/conversations";
import { cn } from "@/lib/utils";
import { FileChip } from "./file-chip";
import { prepareMarkdown, remarkBreaks } from "./markdown";
import { MathFormula } from "./math-formula";

/** Distance from the bottom (px) that still counts as "following" the conversation. */
const FOLLOW_THRESHOLD = 80;
// Single dollars stay text ("$5 or $10"); prepareMarkdown turns \( \) and \[ \] into $$.
const REMARK: Options["remarkPlugins"] = [
  remarkGfm,
  [remarkMath, { singleDollarTextMath: false }],
  remarkBreaks,
];

// Replies are Markdown with GitHub's extensions (tables, ~~strikethrough~~, task lists, bare
// links) and LaTeX maths (markdown.ts); these keep it readable without a typography plugin.
// Images show their alt text only:
// a remote image loads without a click, so text injected into the model's input could make it
// put data into an image URL and send it out.
const MARKDOWN: Components = {
  img: ({ alt }) => <>{alt}</>,
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children, className }) => (
    <ul
      className={cn(
        "my-2 space-y-1",
        className === "contains-task-list" ? "list-none pl-1" : "list-disc pl-5",
      )}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  input: ({ checked }) => (
    <input
      type="checkbox"
      checked={checked}
      disabled
      className="mr-2 size-3.5 align-[-0.15em] accent-primary"
    />
  ),
  // The footnotes heading keeps its sr-only class.
  h1: ({ children }) => <h3 className="mt-4 mb-2 text-base font-semibold">{children}</h3>,
  h2: ({ children, className }) => (
    <h3 className={cn("mt-4 mb-2 text-base font-semibold", className)}>{children}</h3>
  ),
  h3: ({ children }) => <h3 className="mt-3 mb-1.5 font-semibold">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-3 mb-1 font-semibold">{children}</h4>,
  h5: ({ children }) => <h5 className="mt-3 mb-1 font-semibold">{children}</h5>,
  h6: ({ children }) => <h6 className="mt-3 mb-1 font-semibold">{children}</h6>,
  hr: () => <hr className="my-4 border-border" />,
  // Wide tables scroll sideways instead of widening the page (phones).
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-left text-sm [&_tr:last-child>td]:border-b-0">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children, style }) => (
    <th style={style} className="border-b px-3 py-2 font-semibold whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="border-b px-3 py-2 align-top">
      {children}
    </td>
  ),
  // Footnote references jump within the reply; every other link opens a new tab.
  a: ({ children, href }) => (
    <a
      href={href}
      {...(!href?.startsWith("#") && { target: "_blank", rel: "noreferrer" })}
      className="underline underline-offset-4"
    >
      {children}
    </a>
  ),
  // remark-math hands formulas over as code marked language-math.
  code: ({ children, className }) =>
    className?.includes("language-math") ? (
      <MathFormula tex={String(children)} display={className.includes("math-display")} />
    ) : (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{children}</code>
    ),
  pre: ({ children, node }) => {
    const code = node?.children[0];
    const math = code?.type === "element" && String(code.properties.className).includes("math");
    return math ? (
      <>{children}</>
    ) : (
      <pre className="my-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs [&_code]:bg-transparent [&_code]:p-0">
        {children}
      </pre>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 pl-3 text-muted-foreground">{children}</blockquote>
  ),
};

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground"
      aria-label={copied ? t("assistant.copied") : t("assistant.copy")}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}

/**
 * The conversation. Follows new text to the bottom while you are at the bottom; scrolling up stops
 * that and shows a button back down.
 */
export function ChatMessages({
  messages,
  streaming,
  empty,
}: {
  messages: StoredMessage[];
  /** A reply is being written (the last message grows). */
  streaming: boolean;
  /** Shown when there are no messages yet. */
  empty: ReactNode;
}) {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const toBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const element = scroller.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior });
  }, []);

  // New messages or streamed text: stay at the bottom if the reader is there.
  useLayoutEffect(() => {
    if (following.current) toBottom();
  }, [messages, toBottom]);

  // Sending a message always jumps down.
  const count = messages.filter((message) => message.role === "user").length;
  useEffect(() => {
    following.current = true;
    toBottom("smooth");
  }, [count, toBottom]);

  const last = messages[messages.length - 1];
  const waiting = streaming && (!last || last.role === "user" || !last.content);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroller}
        className="h-full overflow-y-auto overscroll-contain"
        onScroll={(event) => {
          const element = event.currentTarget;
          const bottom =
            element.scrollHeight - element.scrollTop - element.clientHeight < FOLLOW_THRESHOLD;
          following.current = bottom;
          setAtBottom(bottom);
        }}
        data-testid="chat-log"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
          {messages.length === 0 && empty}
          {messages.map((message, index) =>
            message.role === "user" ? (
              <div
                key={index}
                className="ml-auto flex max-w-[85%] flex-col items-end gap-1.5"
                data-testid="chat-message-user"
              >
                {message.files?.length ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {message.files.map((file, fileIndex) => (
                      <FileChip key={fileIndex} file={file} />
                    ))}
                  </div>
                ) : null}
                {message.content && (
                  <div className="rounded-2xl bg-muted px-4 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap md:text-sm">
                    {message.content}
                  </div>
                )}
              </div>
            ) : (
              <div key={index} className="group flex flex-col gap-1">
                {message.content && (
                  <div
                    className="text-[15px] leading-relaxed break-words md:text-sm"
                    data-testid="chat-message-assistant"
                  >
                    <Markdown components={MARKDOWN} remarkPlugins={REMARK}>
                      {prepareMarkdown(message.content)}
                    </Markdown>
                  </div>
                )}
                {!(streaming && index === messages.length - 1) && message.content && (
                  <div className="-ml-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                    <CopyButton text={message.content} />
                  </div>
                )}
              </div>
            ),
          )}
          {waiting && (
            <div
              className="flex items-center gap-1"
              role="status"
              aria-label={t("assistant.thinking")}
            >
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="size-2 animate-bounce rounded-full bg-muted-foreground/60"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(
          "absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-md transition-opacity",
          atBottom ? "pointer-events-none opacity-0" : "opacity-100",
        )}
        onClick={() => {
          following.current = true;
          toBottom("smooth");
        }}
        aria-label={t("assistant.scrollDown")}
        tabIndex={atBottom ? -1 : 0}
      >
        <ArrowDown />
      </Button>
    </div>
  );
}
