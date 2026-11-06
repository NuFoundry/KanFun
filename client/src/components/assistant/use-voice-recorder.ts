import { useCallback, useEffect, useRef, useState } from "react";

/** Bars shown while recording; each one is a loudness sample of roughly 70 ms. */
export const BAR_COUNT = 72;
/** Recordings stop on their own after five minutes (the AI service accepts up to ~10 MB). */
export const MAX_RECORDING_MS = 5 * 60 * 1000;

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export type RecorderState = "idle" | "starting" | "recording";
export type RecorderError = "denied" | "unsupported" | "failed";

/** Loudness of a time-domain sample (0..255 around 128) as 0..1, boosted so speech fills the bar. */
export function levelOf(samples: Uint8Array): number {
  let sum = 0;
  for (const value of samples) sum += ((value - 128) / 128) ** 2;
  const rms = Math.sqrt(sum / samples.length);
  return Math.min(1, rms * 4);
}

/**
 * Records a voice message with the microphone and samples its loudness for the bar animation.
 * `stop()` resolves with the recording, `cancel()` throws it away, and a recording that hits the
 * time limit is handed to `onLimit`. Everything (tracks, audio context, animation) is released
 * when the recording ends or the component unmounts.
 */
export function useVoiceRecorder({ onLimit }: { onLimit?: (audio: Blob | null) => void } = {}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<RecorderError | null>(null);
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0));
  const [elapsed, setElapsed] = useState(0);
  const session = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    context: AudioContext;
    chunks: Blob[];
    frame: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  // Every start() attempt gets a number; cancel, a newer start and unmount bump it, so a
  // microphone prompt answered late is released instead of recording into the void.
  const attempt = useRef(0);
  const limit = useRef(onLimit);
  useEffect(() => {
    limit.current = onLimit;
  }, [onLimit]);

  const release = useCallback(() => {
    const current = session.current;
    if (!current) return;
    session.current = null;
    cancelAnimationFrame(current.frame);
    clearTimeout(current.timer);
    current.stream.getTracks().forEach((track) => track.stop());
    void current.context.close().catch(() => {});
    setState("idle");
    setLevels(Array(BAR_COUNT).fill(0));
    setElapsed(0);
  }, []);

  useEffect(
    () => () => {
      attempt.current += 1;
      release();
    },
    [release],
  );

  const stop = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        const current = session.current;
        if (!current) return resolve(null);
        const finish = () => {
          const blob = new Blob(current.chunks, { type: current.recorder.mimeType });
          release();
          resolve(blob.size > 0 ? blob : null);
        };
        // A recorder that already ended (track lost, permission revoked) never fires stop again.
        if (current.recorder.state === "inactive") return finish();
        current.recorder.onstop = finish;
        current.recorder.stop();
      }),
    [release],
  );

  const start = useCallback(async () => {
    if (session.current) return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("unsupported");
      return;
    }
    setState("starting");
    const mine = ++attempt.current;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (cause) {
      if (mine !== attempt.current) return;
      setState("idle");
      setError((cause as DOMException)?.name === "NotAllowedError" ? "denied" : "failed");
      return;
    }
    if (mine !== attempt.current || session.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    try {
      const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
      recorder.start(250);

      const startedAt = performance.now();
      let lastBar = 0;
      const tick = (now: number) => {
        if (!session.current) return;
        if (now - lastBar > 70) {
          lastBar = now;
          analyser.getByteTimeDomainData(samples);
          const level = levelOf(samples);
          setLevels((previous) => [...previous.slice(1), level]);
          setElapsed(now - startedAt);
        }
        session.current.frame = requestAnimationFrame(tick);
      };
      session.current = {
        recorder,
        stream,
        context,
        chunks,
        frame: requestAnimationFrame(tick),
        timer: setTimeout(
          () => void stop().then((audio) => limit.current?.(audio)),
          MAX_RECORDING_MS,
        ),
      };
      setState("recording");
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setState("idle");
      setError("failed");
    }
  }, [stop]);

  const cancel = useCallback(() => {
    const current = session.current;
    if (!current) {
      attempt.current += 1;
      setState("idle");
      return;
    }
    current.recorder.onstop = null;
    if (current.recorder.state !== "inactive") current.recorder.stop();
    release();
  }, [release]);

  return { state, error, levels, elapsed, start, stop, cancel };
}
