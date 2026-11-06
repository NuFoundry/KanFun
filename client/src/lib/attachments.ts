/**
 * Files attached to an assistant message, read in the browser: text files as they are, PDFs as
 * the text pdf.js finds in them, images scaled down to what vision models read. Nothing is
 * uploaded or stored: the content stays with the open chat and goes to the AI service with every
 * turn, while the saved conversation keeps only each file's name (lib/api/conversations.ts).
 */
import type { ChatFile } from "@/lib/api/ai";
import type { StoredFile } from "@/lib/api/conversations";
import { scaleImage } from "@/lib/scale-image";

export type AttachmentKind = StoredFile["kind"];
/** A file that was read; `text` or `image` is what the model gets. */
export type Attachment = StoredFile & {
  size: number;
  text?: string;
  image?: { mediaType: string; data: string };
};

/** Files per message (the service refuses more). */
export const MAX_FILES = 5;
/** Largest file read at all; photos end up far smaller once scaled. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** Text kept of one file. */
export const MAX_TEXT_CHARS = 100_000;
/** One image as base64 (the service's limit). */
const MAX_IMAGE_CHARS = 5_000_000;
/**
 * What one turn carries of all attached files (the service allows 200,000 characters of text and
 * 8 images); every turn of the open chat sends its files again, newest first.
 */
const TURN_TEXT_CHARS = 180_000;
const TURN_IMAGES = 8;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const TEXT_TYPES = ["application/json", "application/xml", "application/yaml", "application/sql"];
// Code and data files often arrive without a text/* type (a .ts file can even be "video/mp2t").
const TEXT_EXTENSIONS = [
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "xml",
  "yaml",
  "yml",
  "toml",
  "ini",
  "log",
  "html",
  "htm",
  "css",
  "js",
  "jsx",
  "mjs",
  "ts",
  "tsx",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "kt",
  "swift",
  "c",
  "h",
  "cpp",
  "hpp",
  "cs",
  "php",
  "sh",
  "sql",
];

/** What the file picker offers. */
export const ACCEPT = [
  ...IMAGE_TYPES,
  "application/pdf",
  "text/*",
  ...TEXT_TYPES,
  ...TEXT_EXTENSIONS.map((extension) => `.${extension}`),
].join(",");

export type AttachmentProblem = "type" | "size" | "empty" | "unreadable";
export class AttachmentError extends Error {
  constructor(
    readonly problem: AttachmentProblem,
    readonly fileName: string,
  ) {
    super(`${fileName}: ${problem}`);
  }
}

const extensionOf = (name: string) => /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase() ?? "";

export function kindOf(file: File): AttachmentKind | null {
  const extension = extensionOf(file.name);
  if (IMAGE_TYPES.includes(file.type)) return "image";
  if (file.type === "application/pdf" || extension === "pdf") return "pdf";
  if (
    file.type.startsWith("text/") ||
    TEXT_TYPES.includes(file.type) ||
    TEXT_EXTENSIONS.includes(extension)
  ) {
    return "text";
  }
  return null;
}

/** Long text is cut, with a note for the model saying so. */
export function cutText(text: string): string {
  if (text.length <= MAX_TEXT_CHARS) return text;
  return `${text.slice(0, MAX_TEXT_CHARS)}\n\n[The file goes on; only its first ${MAX_TEXT_CHARS} characters are attached.]`;
}

/** Reads a file for the model; throws AttachmentError with what the user should be told. */
export async function readAttachment(file: File): Promise<Attachment> {
  const kind = kindOf(file);
  if (!kind) throw new AttachmentError("type", file.name);
  if (file.size > MAX_FILE_BYTES) throw new AttachmentError("size", file.name);
  const read = { name: file.name, kind, size: file.size };
  try {
    if (kind === "image") {
      const image = await scaleImage(file);
      if (image.data.length > MAX_IMAGE_CHARS) throw new AttachmentError("size", file.name);
      return { ...read, image };
    }
    // pdf.js loads only when a PDF is attached.
    const text =
      kind === "pdf"
        ? await (await import("@/lib/pdf-text")).pdfText(file, MAX_TEXT_CHARS)
        : await file.text();
    if (kind === "text" && text.includes("\u0000")) throw new AttachmentError("type", file.name);
    if (!text.trim()) throw new AttachmentError("empty", file.name);
    return { ...read, text: cutText(text) };
  } catch (error) {
    if (error instanceof AttachmentError) throw error;
    throw new AttachmentError("unreadable", file.name);
  }
}

/** How much of the turn's file allowance is left; chatFiles uses it up. */
export type FileBudget = { text: number; images: number };
export const turnBudget = (): FileBudget => ({ text: TURN_TEXT_CHARS, images: TURN_IMAGES });

/**
 * What the model gets of a message's files: their content while `budget` lasts, and the names of
 * the ones left out (over the allowance, or gone because the chat was reopened).
 */
export function chatFiles(files: StoredFile[] = [], budget: FileBudget) {
  const sent: ChatFile[] = [];
  const left: string[] = [];
  for (const file of files) {
    const { text, image } = file as Partial<Attachment>;
    if (image && budget.images > 0) {
      budget.images -= 1;
      sent.push({ type: "image", name: file.name, ...image });
    } else if (text && text.length <= budget.text) {
      budget.text -= text.length;
      sent.push({ type: "text", name: file.name, text });
    } else {
      left.push(file.name);
    }
  }
  return { files: sent, left };
}
