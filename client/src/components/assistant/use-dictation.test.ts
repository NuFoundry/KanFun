import { act, renderHook } from "@testing-library/react";
import { speechLanguage, transcriptOf, useDictation } from "./use-dictation";

type Fake = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onresult: ((event: { results: unknown }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: jest.Mock;
  stop: jest.Mock;
  abort: jest.Mock;
};

/** A result list as the browser hands it over: [text, isFinal] per result. */
const results = (...items: [string, boolean][]) =>
  Object.assign(
    items.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal })),
    { length: items.length },
  );

let instances: Fake[] = [];
function installRecognition(statics: { available?: jest.Mock; install?: jest.Mock } = {}) {
  instances = [];
  const FakeRecognition = jest.fn(function (this: Fake) {
    Object.assign(this, {
      onresult: null,
      onerror: null,
      onend: null,
      start: jest.fn(),
      stop: jest.fn(() => this.onend?.()),
      abort: jest.fn(),
    });
    instances.push(this);
  });
  Object.assign(FakeRecognition, statics);
  Object.assign(window, { SpeechRecognition: FakeRecognition });
}

afterEach(() => {
  delete (window as { SpeechRecognition?: unknown }).SpeechRecognition;
});

describe("transcriptOf", () => {
  it("joins final results and the current guess", () => {
    expect(transcriptOf(results(["Hello", true], [" there", true], [" gen", false]))).toBe(
      "Hello there gen",
    );
  });

  it("replaces a result that repeats the one before (Chrome on Android)", () => {
    expect(transcriptOf(results(["Hello", true], ["hello there", true]))).toBe("hello there");
  });
});

describe("speechLanguage", () => {
  it("takes the region the browser prefers for the app language", () => {
    const languages = jest.spyOn(navigator, "languages", "get").mockReturnValue(["de-AT", "en-GB"]);
    expect(speechLanguage("de")).toBe("de-AT");
    expect(speechLanguage("en")).toBe("en-GB");
    expect(speechLanguage("fr")).toBe("fr");
    languages.mockRestore();
  });
});

describe("useDictation", () => {
  it("is unsupported without speech recognition", () => {
    const { result } = renderHook(() => useDictation({ language: "en", onText: jest.fn() }));
    expect(result.current.supported).toBe(false);
  });

  it("appends what is said to the text, live, until stopped", async () => {
    installRecognition();
    const onText = jest.fn();
    const { result } = renderHook(() => useDictation({ language: "en", onText }));
    expect(result.current.supported).toBe(true);
    await act(() => result.current.start("Note: "));
    const recognition = instances[0]!;
    expect(recognition).toMatchObject({ continuous: true, interimResults: true });
    expect(recognition.processLocally).toBeUndefined();
    expect(result.current.state).toBe("listening");

    act(() => recognition.onresult!({ results: results(["buy", false]) }));
    expect(onText).toHaveBeenLastCalledWith("Note: buy");
    act(() => recognition.onresult!({ results: results(["buy milk", true]) }));
    expect(onText).toHaveBeenLastCalledWith("Note: buy milk");
    act(() => result.current.stop());
    expect(result.current.state).toBe("idle");
  });

  it("runs on the device when the language pack is there, and fetches a missing one", async () => {
    const available = jest.fn().mockResolvedValue("available");
    const install = jest.fn().mockResolvedValue(true);
    installRecognition({ available, install });
    const { result } = renderHook(() => useDictation({ language: "de", onText: jest.fn() }));
    await act(() => result.current.start(""));
    expect(available).toHaveBeenCalledWith({ langs: ["de"], processLocally: true });
    expect(instances[0]!.processLocally).toBe(true);
    act(() => result.current.abort());

    available.mockResolvedValue("downloadable");
    await act(() => result.current.start(""));
    expect(install).toHaveBeenCalledWith({ langs: ["de"], processLocally: true });
    expect(instances[1]!.processLocally).toBeUndefined();
  });

  it("abort drops late results", async () => {
    installRecognition();
    const onText = jest.fn();
    const { result } = renderHook(() => useDictation({ language: "en", onText }));
    await act(() => result.current.start(""));
    const recognition = instances[0]!;
    act(() => result.current.abort());
    expect(recognition.abort).toHaveBeenCalled();
    expect(recognition.onresult).toBeNull();
    expect(result.current.state).toBe("idle");
  });

  it("reports a refused microphone and a broken-off session", async () => {
    installRecognition();
    const { result } = renderHook(() => useDictation({ language: "en", onText: jest.fn() }));
    await act(() => result.current.start(""));
    act(() => instances[0]!.onerror!({ error: "not-allowed" }));
    expect(result.current.error).toBe("denied");
    act(() => instances[0]!.onerror!({ error: "no-speech" }));
    expect(result.current.error).toBe("denied");
    act(() => instances[0]!.onend!());

    await act(() => result.current.start(""));
    act(() => instances[1]!.onresult!({ results: results(["hi", true]) }));
    act(() => instances[1]!.onerror!({ error: "network" }));
    expect(result.current.error).toBe("failed");
    expect(result.current.supported).toBe(true);
  });

  // Last: a browser without a working service stays marked until the page reloads.
  it("gives up on a browser without a working service", async () => {
    installRecognition();
    const onUnavailable = jest.fn();
    const { result } = renderHook(() =>
      useDictation({ language: "en", onText: jest.fn(), onUnavailable }),
    );
    await act(() => result.current.start(""));
    act(() => instances[0]!.onerror!({ error: "network" }));
    expect(onUnavailable).toHaveBeenCalled();
    expect(result.current).toMatchObject({ supported: false, error: "unavailable" });
    const again = renderHook(() => useDictation({ language: "en", onText: jest.fn() }));
    expect(again.result.current.supported).toBe(false);
  });
});
