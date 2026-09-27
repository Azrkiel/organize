/** Free, no-key OCR fallback for slide text (PLAN.md Phase 12 task 5) — runs entirely in the
 * browser via tesseract.js's own Web Worker, used only when GEMINI_API_KEY isn't set or the
 * Gemini vision call fails/rate-limits for a given photo. One worker is reused across photos
 * rather than spun up per call, since loading the language data isn't free. */
import { createWorker, type Worker } from "tesseract.js";

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) workerPromise = createWorker("eng");
  return workerPromise;
}

export async function ocrSlideText(blob: Blob): Promise<string | null> {
  try {
    const worker = await getWorker();
    const {
      data: { text },
    } = await worker.recognize(blob);
    const trimmed = text.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}
