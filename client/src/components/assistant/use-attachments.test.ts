import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { useAttachments } from "./use-attachments";
import { readAttachment } from "@/lib/attachments";

jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/attachments", () => ({
  ...jest.requireActual("@/lib/attachments"),
  readAttachment: jest.fn(),
}));

const text = (name: string) => new File(["x"], name, { type: "text/plain" });

describe("useAttachments", () => {
  it("shows a file while it is read, then holds its content", async () => {
    let done!: (value: unknown) => void;
    jest
      .mocked(readAttachment)
      .mockReturnValue(new Promise((resolve) => (done = resolve)) as never);
    const { result } = renderHook(() => useAttachments());
    act(() => result.current.add([text("a.txt")]));
    expect(result.current.files).toMatchObject([{ name: "a.txt", kind: "text", reading: true }]);
    expect(result.current.reading).toBe(true);
    await act(async () => done({ name: "a.txt", kind: "text", size: 1, text: "x" }));
    expect(result.current.files).toEqual([
      { id: expect.any(String), name: "a.txt", kind: "text", size: 1, text: "x" },
    ]);
    expect(result.current.reading).toBe(false);
    act(() => result.current.remove(result.current.files[0]!.id));
    expect(result.current.files).toEqual([]);
  });

  it("says why a file is refused, and takes at most five", async () => {
    const { AttachmentError } = jest.requireActual("@/lib/attachments");
    jest.mocked(readAttachment).mockImplementation(async (file: File) => {
      if (file.name === "scan.pdf") throw new AttachmentError("empty", file.name);
      return { name: file.name, kind: "text", size: 1, text: "x" };
    });
    const { result } = renderHook(() => useAttachments());
    act(() => result.current.add([new File(["x"], "a.docx", { type: "application/msword" })]));
    expect(toast.error).toHaveBeenLastCalledWith(
      "a.docx: only images, PDFs and text files can be attached.",
    );
    act(() => result.current.add([new File(["x"], "scan.pdf", { type: "application/pdf" })]));
    await waitFor(() =>
      expect(toast.error).toHaveBeenLastCalledWith(
        "scan.pdf has no text to read (a scanned PDF?).",
      ),
    );
    expect(result.current.files).toEqual([]);

    act(() => result.current.add(["1", "2", "3", "4", "5", "6"].map((n) => text(`${n}.txt`))));
    expect(toast.error).toHaveBeenLastCalledWith("Up to 5 files per message.");
    await waitFor(() => expect(result.current.reading).toBe(false));
    expect(result.current.files.map((file) => file.name)).toEqual(
      ["1", "2", "3", "4", "5"].map((n) => `${n}.txt`),
    );
    act(() => result.current.add([text("7.txt")]));
    expect(result.current.files).toHaveLength(5);

    const kept = result.current.files;
    act(() => result.current.clear());
    expect(result.current.files).toEqual([]);
    act(() => result.current.restore(kept));
    expect(result.current.files).toBe(kept);
  });
});
