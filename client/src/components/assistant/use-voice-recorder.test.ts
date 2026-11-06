import { act, renderHook } from "@testing-library/react";
import { MAX_RECORDING_MS, useVoiceRecorder } from "./use-voice-recorder";

/** A MediaRecorder stand-in: records what was asked, fires stop on demand. */
class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static isTypeSupported = () => true;
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  onstop: (() => void) | null = null;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  constructor(public stream: MediaStream) {
    FakeRecorder.instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio"]) });
    this.onstop?.();
  }
}

const tracks = () => {
  const track = { stop: jest.fn() };
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track };
};

let getUserMedia: jest.Mock;
let closed: jest.Mock;

beforeEach(() => {
  FakeRecorder.instances = [];
  getUserMedia = jest.fn();
  closed = jest.fn(async () => undefined);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  Object.assign(globalThis, {
    MediaRecorder: FakeRecorder,
    AudioContext: class {
      createAnalyser = () => ({ fftSize: 0, getByteTimeDomainData: jest.fn() });
      createMediaStreamSource = () => ({ connect: jest.fn() });
      close = closed;
    },
  });
  jest.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useVoiceRecorder", () => {
  it("records, resolves the audio on stop and releases the microphone", async () => {
    const { stream, track } = tracks();
    getUserMedia.mockResolvedValue(stream);
    const { result } = renderHook(() => useVoiceRecorder());
    await act(() => result.current.start());
    expect(result.current.state).toBe("recording");
    let audio: Blob | null = null;
    await act(async () => {
      audio = await result.current.stop();
    });
    expect(audio!.size).toBeGreaterThan(0);
    expect(result.current.state).toBe("idle");
    expect(track.stop).toHaveBeenCalled();
    expect(closed).toHaveBeenCalled();
  });

  it("hands a recording that hit the time limit to onLimit", async () => {
    getUserMedia.mockResolvedValue(tracks().stream);
    const onLimit = jest.fn();
    const { result } = renderHook(() => useVoiceRecorder({ onLimit }));
    await act(() => result.current.start());
    await act(async () => {
      jest.advanceTimersByTime(MAX_RECORDING_MS);
    });
    expect(onLimit).toHaveBeenCalledWith(expect.any(Blob));
    expect(result.current.state).toBe("idle");
  });

  it("reports a refused or missing microphone", async () => {
    getUserMedia.mockRejectedValue(new DOMException("no", "NotAllowedError"));
    const { result } = renderHook(() => useVoiceRecorder());
    await act(() => result.current.start());
    expect(result.current.error).toBe("denied");
    expect(result.current.state).toBe("idle");
  });

  it("releases a stream that arrives after cancel, a restart or unmount", async () => {
    const first = tracks();
    const second = tracks();
    let resolveFirst!: (stream: MediaStream) => void;
    getUserMedia
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(second.stream);
    const { result, unmount } = renderHook(() => useVoiceRecorder());
    act(() => void result.current.start());
    expect(result.current.state).toBe("starting");
    act(() => result.current.cancel());
    await act(() => result.current.start());
    await act(async () => {
      resolveFirst(first.stream);
    });
    // The late stream from the cancelled attempt is stopped, only the new one records.
    expect(first.track.stop).toHaveBeenCalled();
    expect(FakeRecorder.instances).toHaveLength(1);
    expect(result.current.state).toBe("recording");
    unmount();
    expect(second.track.stop).toHaveBeenCalled();
  });

  it("still resolves when the recorder ended on its own", async () => {
    getUserMedia.mockResolvedValue(tracks().stream);
    const { result } = renderHook(() => useVoiceRecorder());
    await act(() => result.current.start());
    // The track was lost: the browser ended the recorder without us asking.
    FakeRecorder.instances[0]!.stop();
    let audio: Blob | null = null;
    await act(async () => {
      audio = await result.current.stop();
    });
    expect(audio).not.toBeNull();
    expect(result.current.state).toBe("idle");
  });
});
