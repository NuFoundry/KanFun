// Runs before the test environment is wired up (jest `setupFiles`).
// jsdom lacks a few Node/web globals that libraries such as react-router expect.
import { TextDecoder, TextEncoder } from "node:util";

Object.assign(globalThis, { TextEncoder, TextDecoder });

// jsdom's Blob has no text(); browsers do (lib/attachments.ts reads files with it).
Blob.prototype.text ??= function (this: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsText(this);
  });
};
