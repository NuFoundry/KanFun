/**
 * The text of a PDF, read in this tab with pdf.js; nothing is uploaded. Loaded on first use
 * (lib/attachments.ts imports it dynamically), browser-only, so Jest mocks it and Playwright
 * covers it. A scan without a text layer gives "".
 */
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

// A module worker from this origin (the CSP allows no other).
GlobalWorkerOptions.workerPort = new PdfWorker();

/** Page by page until `limit` characters. */
export async function pdfText(file: Blob, limit: number): Promise<string> {
  // Text only: no fonts are loaded into the page.
  const task = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    disableFontFace: true,
  });
  const pdf = await task.promise;
  try {
    let text = "";
    for (let number = 1; number <= pdf.numPages && text.length < limit; number++) {
      const page = await pdf.getPage(number);
      for (const item of (await page.getTextContent()).items) {
        if ("str" in item) text += item.str + (item.hasEOL ? "\n" : "");
      }
      text += "\n\n";
    }
    return text.trim();
  } finally {
    void task.destroy();
  }
}
