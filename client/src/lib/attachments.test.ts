import {
  type AttachmentError,
  chatFiles,
  cutText,
  kindOf,
  MAX_FILE_BYTES,
  MAX_TEXT_CHARS,
  readAttachment,
  turnBudget,
} from "./attachments";
import { pdfText } from "./pdf-text";
import { scaleImage } from "./scale-image";

// Both need a real browser (pdf.js, canvas); Playwright covers them.
jest.mock("./pdf-text", () => ({ pdfText: jest.fn() }));
jest.mock("./scale-image", () => ({ scaleImage: jest.fn() }));

const file = (name: string, type: string, content: BlobPart = "x") =>
  new File([content], name, { type });
const problem = (promise: Promise<unknown>) =>
  promise.then(
    () => "read",
    (error: AttachmentError) => error.problem,
  );

describe("kindOf", () => {
  it("knows images, PDFs and text by type or extension", () => {
    expect(kindOf(file("a.png", "image/png"))).toBe("image");
    expect(kindOf(file("a.pdf", "application/pdf"))).toBe("pdf");
    expect(kindOf(file("a.pdf", ""))).toBe("pdf");
    expect(kindOf(file("notes.md", ""))).toBe("text");
    expect(kindOf(file("data.json", "application/json"))).toBe("text");
    // Some systems call TypeScript an MPEG stream.
    expect(kindOf(file("app.ts", "video/mp2t"))).toBe("text");
    expect(kindOf(file("logo.svg", "image/svg+xml"))).toBeNull();
    expect(kindOf(file("report.docx", "application/vnd.openxmlformats"))).toBeNull();
  });
});

describe("cutText", () => {
  it("keeps short text and cuts long text with a note", () => {
    expect(cutText("short")).toBe("short");
    const cut = cutText("x".repeat(MAX_TEXT_CHARS + 10));
    expect(cut.startsWith("x".repeat(MAX_TEXT_CHARS) + "\n\n[The file goes on")).toBe(true);
  });
});

describe("readAttachment", () => {
  it("reads text files as they are", async () => {
    await expect(
      readAttachment(file("a.csv", "text/csv", "name,amount\nalice,12")),
    ).resolves.toEqual({ name: "a.csv", kind: "text", size: 20, text: "name,amount\nalice,12" });
  });

  it("reads the text of a PDF in the browser", async () => {
    jest.mocked(pdfText).mockResolvedValue("Revenue grew 12%");
    const read = await readAttachment(file("r.pdf", "application/pdf"));
    expect(read).toMatchObject({ kind: "pdf", text: "Revenue grew 12%" });
    expect(pdfText).toHaveBeenCalledWith(expect.any(File), MAX_TEXT_CHARS);
  });

  it("scales images", async () => {
    jest.mocked(scaleImage).mockResolvedValue({ mediaType: "image/jpeg", data: "AAAA" });
    await expect(readAttachment(file("p.jpg", "image/jpeg"))).resolves.toMatchObject({
      kind: "image",
      image: { mediaType: "image/jpeg", data: "AAAA" },
    });
  });

  it("says why a file cannot be attached", async () => {
    expect(await problem(readAttachment(file("a.docx", "application/msword")))).toBe("type");
    expect(await problem(readAttachment(file("bin.txt", "text/plain", "a\u0000b")))).toBe("type");
    const big = file("big.txt", "text/plain");
    Object.defineProperty(big, "size", { value: MAX_FILE_BYTES + 1 });
    expect(await problem(readAttachment(big))).toBe("size");
    jest.mocked(pdfText).mockResolvedValue("  \n");
    expect(await problem(readAttachment(file("scan.pdf", "application/pdf")))).toBe("empty");
    jest.mocked(pdfText).mockRejectedValue(new Error("Invalid PDF structure"));
    expect(await problem(readAttachment(file("bad.pdf", "application/pdf")))).toBe("unreadable");
    jest
      .mocked(scaleImage)
      .mockResolvedValue({ mediaType: "image/png", data: "A".repeat(5_000_001) });
    expect(await problem(readAttachment(file("huge.png", "image/png")))).toBe("size");
  });
});

describe("chatFiles", () => {
  const image = {
    name: "i.png",
    kind: "image" as const,
    size: 1,
    image: { mediaType: "image/png", data: "AA" },
  };
  const text = (name: string, length: number) => ({
    name,
    kind: "text" as const,
    size: length,
    text: "x".repeat(length),
  });

  it("sends file content while the turn's allowance lasts and names the rest", () => {
    const budget = { text: 10, images: 1 };
    expect(chatFiles([image, image, text("a.txt", 6), text("b.txt", 6)], budget)).toEqual({
      files: [
        { type: "image", name: "i.png", mediaType: "image/png", data: "AA" },
        { type: "text", name: "a.txt", text: "xxxxxx" },
      ],
      left: ["i.png", "b.txt"],
    });
    expect(budget).toEqual({ text: 4, images: 0 });
  });

  it("names files whose content is gone (a reopened chat)", () => {
    expect(chatFiles([{ name: "r.pdf", kind: "pdf" }], turnBudget())).toEqual({
      files: [],
      left: ["r.pdf"],
    });
  });
});
