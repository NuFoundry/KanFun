import { ArrowUp, Check, Loader2, Mic, Paperclip, Square, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { transcribe } from "@/lib/api/ai";
import { ACCEPT } from "@/lib/attachments";
import { cn } from "@/lib/utils";
import { FileChip } from "./file-chip";
import type { PendingFile } from "./use-attachments";
import { useDictation } from "./use-dictation";
import { useVoiceRecorder } from "./use-voice-recorder";

/** Grows with its text up to this height, then scrolls. */
const MAX_HEIGHT = 240;

/** Touch keyboards have no Shift+Enter, so Enter adds a line there and the button sends. */
const enterSends = () => !window.matchMedia?.("(pointer: coarse)").matches;

const clock = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/**
 * The message box: a text field that grows as you type, attached files, voice input, send, and
 * stop while a reply streams. Files come from the paperclip, a paste or a drop on the page (the
 * page handles drops). Voice is live dictation where the browser recognises speech (the words
 * appear as you speak) and otherwise a voice message (live bars, cancel or confirm) that the AI
 * service transcribes into the field to check before sending. Both work while a reply is being
 * written.
 */
export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  loading = false,
  voice = true,
  language,
  autoFocus,
  files = [],
  onAddFiles,
  onRemoveFile,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  /** The conversation is still loading: a message sent now would land outside it. */
  loading?: boolean;
  /** Whether the AI service can transcribe (without it, only browsers that dictate get a mic). */
  voice?: boolean;
  /** ISO 639-1 language of the voice message (the app language). */
  language?: string;
  autoFocus?: boolean;
  /** Files that go with the next message; without onAddFiles there is no paperclip. */
  files?: PendingFile[];
  onAddFiles?: (files: File[]) => void;
  onRemoveFile?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const field = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [transcribing, setTranscribing] = useState(false);
  // The recording hits the time limit: it is used as if the user had confirmed it.
  const recorder = useVoiceRecorder({ onLimit: (audio) => void transcribeAudio(audio) });
  const dictation = useDictation({
    language: language ?? "en",
    onText: onChange,
    // The browser has no working service after all (Brave, a blocked one): record instead.
    onUnavailable: () => {
      if (voice) void recorder.start();
    },
  });
  const listening = dictation.state !== "idle";

  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`;
  }, [value, recorder.state, transcribing]);

  async function transcribeAudio(audio: Blob | null) {
    if (!audio) return;
    setTranscribing(true);
    try {
      const text = await transcribe(audio, language);
      onChange(value.trim() ? `${value.trimEnd()} ${text}` : text);
      requestAnimationFrame(() => field.current?.focus());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("assistant.voice.failed"));
    } finally {
      setTranscribing(false);
    }
  }

  async function confirmRecording() {
    await transcribeAudio(await recorder.stop());
  }

  // Microphone refused, missing or broken, or dictation broke off: say why (each new failure once).
  const micError =
    recorder.error === "denied" || dictation.error === "denied"
      ? t("assistant.voice.denied")
      : recorder.error === "unsupported"
        ? t("assistant.voice.unsupported")
        : recorder.error === "failed"
          ? t("assistant.voice.micFailed")
          : dictation.error === "failed"
            ? t("assistant.voice.dictationFailed")
            : dictation.error === "unavailable" && !voice
              ? t("assistant.voice.noDictation")
              : null;
  useEffect(() => {
    if (micError) toast.error(micError);
  }, [micError]);

  const recording = recorder.state !== "idle";
  const reading = files.some((file) => file.reading);
  const canSend =
    Boolean(value.trim() || files.length) && !streaming && !transcribing && !loading && !reading;
  function send() {
    if (!canSend) return;
    dictation.abort();
    onSend();
  }

  return (
    <form
      className="rounded-2xl border bg-field shadow-sm transition-shadow focus-within:shadow-md"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      data-testid="chat-composer"
    >
      {recording ? (
        <div className="flex items-center gap-3 p-2 pl-4" data-testid="voice-recorder">
          <span className="size-2 shrink-0 animate-pulse rounded-full bg-destructive" aria-hidden />
          <div
            className="flex h-9 flex-1 items-center justify-end gap-[3px] overflow-hidden"
            role="img"
            aria-label={t("assistant.voice.recording")}
          >
            {recorder.levels.map((level, index) => (
              <span
                key={index}
                className="w-[3px] shrink-0 rounded-full bg-foreground/70 transition-[height] duration-75"
                style={{ height: `${Math.max(8, level * 100)}%` }}
              />
            ))}
          </div>
          <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
            {clock(recorder.elapsed)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={recorder.cancel}
            aria-label={t("assistant.voice.cancel")}
            data-testid="voice-cancel"
          >
            <X />
          </Button>
          <Button
            type="button"
            size="icon"
            className="rounded-full"
            onClick={() => void confirmRecording()}
            disabled={recorder.state !== "recording"}
            aria-label={t("assistant.voice.confirm")}
            data-testid="voice-confirm"
          >
            <Check />
          </Button>
        </div>
      ) : (
        <>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pt-3" data-testid="composer-files">
              {files.map((file) => (
                <FileChip
                  key={file.id}
                  file={file}
                  reading={file.reading}
                  onRemove={onRemoveFile && (() => onRemoveFile(file.id))}
                />
              ))}
            </div>
          )}
          <label htmlFor="chat-input" className="sr-only">
            {t("assistant.placeholder")}
          </label>
          <textarea
            id="chat-input"
            ref={field}
            rows={1}
            value={value}
            autoFocus={autoFocus}
            onChange={(event) => {
              // Typing takes over from dictation; what was said so far stays.
              if (listening) dictation.abort();
              onChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && enterSends()) {
                event.preventDefault();
                send();
              }
            }}
            // A pasted screenshot or file is attached. Text wins when the clipboard has both,
            // as Excel and Word put a picture of the copied text next to it.
            onPaste={(event) => {
              const pasted = [...event.clipboardData.files];
              const text = event.clipboardData.getData("text/plain");
              if (!onAddFiles || !pasted.length) return;
              if (text && pasted.every((file) => file.type.startsWith("image/"))) return;
              event.preventDefault();
              onAddFiles(pasted);
            }}
            placeholder={
              transcribing
                ? t("assistant.voice.transcribing")
                : listening
                  ? t("assistant.voice.listening")
                  : t("assistant.placeholder")
            }
            disabled={transcribing}
            className="block max-h-60 w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-base outline-none placeholder:text-muted-foreground md:text-sm"
            data-testid="chat-input"
          />
          <div className="flex items-center gap-1 p-2">
            <div className="mr-auto flex min-w-0 items-center gap-2">
              {onAddFiles && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => picker.current?.click()}
                    aria-label={t("assistant.files.attach")}
                    data-testid="attach-files"
                  >
                    <Paperclip />
                  </Button>
                  <input
                    ref={picker}
                    type="file"
                    multiple
                    accept={ACCEPT}
                    className="hidden"
                    onChange={(event) => {
                      onAddFiles([...(event.target.files ?? [])]);
                      event.target.value = "";
                    }}
                    data-testid="attach-input"
                  />
                </>
              )}
              {transcribing && (
                <Loader2 className="ml-2 size-4 animate-spin text-muted-foreground" />
              )}
              {listening && (
                <span
                  className="ml-2 flex items-center gap-2 text-xs text-muted-foreground"
                  role="status"
                  data-testid="dictation-status"
                >
                  <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden />
                  {t("assistant.voice.listening")}
                </span>
              )}
            </div>
            {listening ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
                onClick={dictation.stop}
                aria-label={t("assistant.voice.stopDictation")}
                data-testid="dictation-stop"
              >
                <Mic />
              </Button>
            ) : (
              (voice || dictation.supported) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={() =>
                    void (dictation.supported ? dictation.start(value) : recorder.start())
                  }
                  disabled={transcribing}
                  aria-label={
                    dictation.supported ? t("assistant.voice.dictate") : t("assistant.voice.start")
                  }
                  data-testid="voice-start"
                >
                  <Mic />
                </Button>
              )
            )}
            {streaming ? (
              <Button
                type="button"
                size="icon"
                className="rounded-full"
                onClick={onStop}
                aria-label={t("assistant.stop")}
                data-testid="chat-stop"
              >
                <Square className="fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                className={cn("rounded-full", !canSend && "opacity-40")}
                disabled={!canSend}
                aria-label={t("assistant.send")}
                data-testid="chat-send"
              >
                <ArrowUp />
              </Button>
            )}
          </div>
        </>
      )}
    </form>
  );
}
