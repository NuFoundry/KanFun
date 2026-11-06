import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Live dictation with the browser's speech recognition (Web Speech API): the words appear in the
 * message box while you speak. It runs on the device when the browser has the language pack
 * (Chrome fetches one in the background after the first use) and otherwise on the browser
 * vendor's service: Google for Chrome, Apple for Safari, Microsoft for Edge. Firefox has none, and
 * some browsers expose the API without a service (Brave); there the composer records instead and
 * the AI service transcribes.
 */

/** false keeps audio off the browser vendor's servers: dictation runs on the device or not at all. */
export const CLOUD_DICTATION = true;

type Result = {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { transcript: string };
};
type ResultList = { readonly length: number; [index: number]: Result };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onresult: ((event: { results: ResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type LanguageOptions = { langs: string[]; processLocally: boolean };
export type RecognitionClass = {
  new (): Recognition;
  available?: (options: LanguageOptions) => Promise<string>;
  install?: (options: LanguageOptions) => Promise<boolean>;
};

export type DictationState = "idle" | "starting" | "listening";
/** denied: no microphone; unavailable: no recognition service here; failed: it broke off. */
export type DictationError = "denied" | "unavailable" | "failed";

/** Errors that mean "this browser cannot recognise speech", not "this attempt failed". */
const UNAVAILABLE = new Set(["network", "service-not-allowed", "language-not-supported"]);

// A browser whose recognition service failed is not asked again until the page reloads.
let serviceBroken = false;

export function recognitionClass(): RecognitionClass | undefined {
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionClass;
    webkitSpeechRecognition?: RecognitionClass;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

/** The app language as a BCP 47 tag, with the region the browser prefers for it ("de" -> "de-AT"). */
export function speechLanguage(language: string): string {
  return (
    navigator.languages?.find((tag) => tag.toLowerCase().startsWith(`${language}-`)) ?? language
  );
}

/**
 * The text of a session: every final result plus the current guess. Chrome on Android repeats
 * the earlier words in each new result, so a result that starts with the one before replaces it.
 */
export function transcriptOf(results: ResultList): string {
  const parts: string[] = [];
  for (let index = 0; index < results.length; index++) {
    const text = results[index]?.[0]?.transcript.trim();
    if (!text) continue;
    const previous = parts[parts.length - 1];
    if (previous && text.toLowerCase().startsWith(previous.toLowerCase())) {
      parts[parts.length - 1] = text;
    } else {
      parts.push(text);
    }
  }
  return parts.join(" ");
}

/** Whether recognition can run on the device; a missing language pack starts downloading. */
async function runsOnDevice(Recognition: RecognitionClass, lang: string): Promise<boolean> {
  if (!Recognition.available) return false;
  const options = { langs: [lang], processLocally: true };
  try {
    const status = await Recognition.available(options);
    if (status === "downloadable") void Recognition.install?.(options).catch(() => {});
    return status === "available";
  } catch {
    return false;
  }
}

/**
 * Dictates into the message box: `start(text)` keeps `text` and appends what is said, calling
 * `onText` with the whole value on every result. `stop()` waits for the last words, `abort()`
 * drops them (the user typed or sent). `onUnavailable` fires when the browser turns out to have
 * no working service, so the caller can record instead.
 */
export function useDictation({
  language,
  onText,
  onUnavailable,
}: {
  /** ISO 639-1, the app language. */
  language: string;
  onText: (text: string) => void;
  onUnavailable?: () => void;
}) {
  const [state, setState] = useState<DictationState>("idle");
  const [error, setError] = useState<DictationError | null>(null);
  const [supported, setSupported] = useState(() => !serviceBroken && Boolean(recognitionClass()));
  const current = useRef<Recognition | null>(null);
  // Bumped by abort and unmount, so an availability check answered late starts nothing.
  const attempt = useRef(0);
  const handlers = useRef({ onText, onUnavailable });
  useEffect(() => {
    handlers.current = { onText, onUnavailable };
  });

  const unavailable = useCallback(() => {
    serviceBroken = true;
    setSupported(false);
    setState("idle");
    setError("unavailable");
    handlers.current.onUnavailable?.();
  }, []);

  const abort = useCallback(() => {
    attempt.current += 1;
    const recognition = current.current;
    current.current = null;
    if (recognition) {
      recognition.onresult = recognition.onerror = recognition.onend = null;
      recognition.abort();
    }
    setState("idle");
  }, []);

  useEffect(() => abort, [abort]);

  const start = useCallback(
    async (text: string) => {
      const Recognition = recognitionClass();
      if (!Recognition || current.current) return;
      const mine = ++attempt.current;
      setError(null);
      setState("starting");
      const lang = speechLanguage(language);
      const local = await runsOnDevice(Recognition, lang);
      if (mine !== attempt.current) return;
      if (!local && !CLOUD_DICTATION) return unavailable();

      const recognition = new Recognition();
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = true;
      if (local) recognition.processLocally = true;
      const before = text.trimEnd();
      let heard = false;
      recognition.onresult = (event) => {
        heard = true;
        const said = transcriptOf(event.results);
        handlers.current.onText(before && said ? `${before} ${said}` : before || said);
      };
      recognition.onerror = (event) => {
        if (event.error === "no-speech" || event.error === "aborted") return;
        if (event.error === "not-allowed") setError("denied");
        else if (!heard && UNAVAILABLE.has(event.error)) unavailable();
        else setError("failed");
      };
      recognition.onend = () => {
        if (current.current !== recognition) return;
        current.current = null;
        setState("idle");
      };
      current.current = recognition;
      try {
        recognition.start();
        setState("listening");
      } catch {
        current.current = null;
        setState("idle");
        setError("failed");
      }
    },
    [language, unavailable],
  );

  // Before the browser answered the availability check there is nothing to stop yet.
  const stop = useCallback(() => (current.current ? current.current.stop() : abort()), [abort]);

  return { supported, state, error, start, stop, abort };
}
