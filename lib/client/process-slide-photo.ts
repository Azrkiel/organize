import { autoScanSlide } from "@/lib/client/slide-scan";
import { compressImage } from "@/lib/client/compress-image";

/** Auto-scan then compress — the full pipeline a captured slide photo goes through before upload
 * or OCR, shared by a fresh capture (manual or smart) and a retake (PLAN.md Phase 12 tasks 8, 12).
 * `scanned` is a reference-equality check: `autoScanSlide` returns the exact same `Blob` instance
 * when it found nothing confident to correct. */
export async function processSlidePhoto(input: File | Blob): Promise<{ blob: Blob; scanned: boolean }> {
  const scannedPhoto = await autoScanSlide(input);
  const blob = await compressImage(scannedPhoto);
  return { blob, scanned: scannedPhoto !== input };
}
