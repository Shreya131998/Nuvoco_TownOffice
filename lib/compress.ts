/**
 * Browser-side image downscaling, before anything is uploaded.
 *
 * A modern phone camera produces 4–12 MB files. Uploading those on township
 * mobile data is slow enough that people give up mid-complaint, and it burns
 * the Cloudinary free tier for no benefit — nobody needs 12 megapixels to see
 * a leaking tap. 1600 px on the long edge at q0.72 lands around 120–250 KB and
 * still shows the detail that matters.
 *
 * Returns the ORIGINAL file if anything goes wrong or if compressing made it
 * bigger, which happens with small or already-optimised images.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.72;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // Canvas rasterises SVG and strips animation from GIF — leave both alone.
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
