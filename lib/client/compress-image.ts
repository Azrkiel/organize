/** Browser-only slide photo compression (PLAN.md Phase 12 task 3): resize to a max 1280px long
 * edge and re-encode as JPEG ~0.6 quality, protecting the Supabase free storage tier. Tuned down
 * from an original 1600px/0.7 default at the owner's request for smaller files — 1280px is still
 * comfortably above what OCR (Gemini vision or tesseract.js) needs to read a projector slide's
 * text, since that text is large relative to the frame compared to, say, a scanned document.
 * Re-encoding through a canvas also strips EXIF data (including GPS location) as a side effect —
 * canvas pixels carry no metadata, which is exactly the "strip EXIF location" the plan asks for. */

/** Pure math, so unlike the rest of this file it's unit-tested directly. */
export function computeResizedDimensions(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) return { width, height };
  if (width >= height) {
    return { width: maxDimension, height: Math.round((height * maxDimension) / width) };
  }
  return { width: Math.round((width * maxDimension) / height), height: maxDimension };
}

export async function compressImage(file: File | Blob, maxDimension = 1280, quality = 0.6): Promise<Blob> {
  // `imageOrientation: "from-image"` is explicit, not left to the browser's default, since a
  // photo straight off an iPhone camera always carries an EXIF orientation tag — without this,
  // some browsers would draw it sideways/upside-down onto the canvas.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = computeResizedDimensions(bitmap.width, bitmap.height, maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser doesn't support canvas image compression.");
    ctx.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not compress the photo."))),
        "image/jpeg",
        quality
      );
    });
  } finally {
    bitmap.close();
  }
}
