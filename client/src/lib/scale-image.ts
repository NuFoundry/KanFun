/** Longest side sent to the model; vision models scale bigger images down to about this anyway. */
const MAX_EDGE = 1568;
/** Images this small (and no wider than MAX_EDGE) go as they are: GIFs stay animated. */
const KEEP_BYTES = 1024 * 1024;

/**
 * An image as the model gets it: base64 and its type, the longest side at most MAX_EDGE. Photos
 * stay JPEG, everything else becomes WebP (or PNG where the browser cannot write WebP), which
 * keeps transparency. Browser-only (canvas), so Jest mocks it and Playwright covers it.
 */
export async function scaleImage(file: File): Promise<{ mediaType: string; data: string }> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= KEEP_BYTES) {
      return { mediaType: file.type, data: await base64(file) };
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const wanted = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, wanted, 0.85));
    if (!blob) throw new Error("The image could not be encoded");
    return { mediaType: blob.type, data: await base64(blob) };
  } finally {
    bitmap.close();
  }
}

async function base64(blob: Blob): Promise<string> {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("The image could not be read"));
    reader.readAsDataURL(blob);
  });
  return url.slice(url.indexOf(",") + 1);
}
