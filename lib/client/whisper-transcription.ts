import { getRecordingMeta, getSegmentChunks, getSegmentIndexes } from "@/lib/client/lecture-audio-db";
import { computeRms, concatenateChunks, decodeToMono16k } from "@/lib/client/audio-decode";
import type { WhisperRequest, WhisperResponse } from "@/lib/client/whisper.worker";

// Whisper doesn't say nothing when given near-silent audio — it reliably hallucinates a short
// filler word (classically "you"), a well-documented failure mode. Below this RMS level a
// segment is skipped rather than sent to the model at all. Normal speech sits comfortably above
// this; room tone / a muted or wrong input device sits at or below it.
const SILENCE_RMS_THRESHOLD = 0.01;

export type WhisperModelSize = "tiny" | "base" | "small";

export type WhisperProgress =
  | { phase: "loading-model"; loaded: number; total: number; file: string }
  | { phase: "transcribing"; segmentIndex: number; totalSegments: number; secondsDone: number; secondsTotal: number | null };

/**
 * Runs Whisper (in a Web Worker) over every stored audio segment for a lecture, one at a time,
 * concatenating the results in order (PLAN.md Phase 9 task 4). Segments are decoded and sent to
 * the worker sequentially rather than in parallel, keeping peak memory to "one segment" even for
 * a multi-hour lecture with dozens of 10-minute segments.
 */
export async function transcribeLecture({
  lectureId,
  modelSize,
  totalDurationSeconds,
  onProgress,
  signal,
}: {
  lectureId: string;
  modelSize: WhisperModelSize;
  totalDurationSeconds: number | null;
  onProgress: (progress: WhisperProgress) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const segmentIndexes = await getSegmentIndexes(lectureId);
  if (segmentIndexes.length === 0) {
    throw new Error("No recorded audio found for this lecture on this device.");
  }

  const meta = await getRecordingMeta(lectureId);
  const mimeType = meta?.mimeType || "audio/webm";

  const worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
  let requestId = 0;
  let secondsDone = 0;
  const parts: string[] = [];

  try {
    for (let i = 0; i < segmentIndexes.length; i++) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

      const chunks = await getSegmentChunks(lectureId, segmentIndexes[i]);
      const blob = concatenateChunks(chunks, mimeType);
      const audio = await decodeToMono16k(blob);
      const segmentSeconds = audio.length / 16000;

      onProgress({
        phase: "transcribing",
        segmentIndex: i,
        totalSegments: segmentIndexes.length,
        secondsDone,
        secondsTotal: totalDurationSeconds,
      });

      if (computeRms(audio) < SILENCE_RMS_THRESHOLD) {
        secondsDone += segmentSeconds;
        continue;
      }

      const id = ++requestId;
      const text = await new Promise<string>((resolve, reject) => {
        function onMessage(event: MessageEvent<WhisperResponse>) {
          const msg = event.data;
          if (msg.requestId !== id) return;
          if (msg.type === "model-progress") {
            onProgress({ phase: "loading-model", loaded: msg.loaded, total: msg.total, file: msg.file });
          } else if (msg.type === "result") {
            worker.removeEventListener("message", onMessage);
            resolve(msg.text);
          } else if (msg.type === "error") {
            worker.removeEventListener("message", onMessage);
            reject(new Error(msg.message));
          }
        }
        worker.addEventListener("message", onMessage);
        const request: WhisperRequest = { type: "transcribe", requestId: id, modelSize, audio };
        worker.postMessage(request, [audio.buffer]);
      });

      parts.push(text);
      secondsDone += segmentSeconds;
    }
  } finally {
    worker.terminate();
  }

  if (parts.length === 0) {
    throw new Error(
      "No speech was detected in this recording — every segment was near-silent. Check that your microphone actually picked up sound."
    );
  }

  return parts.join("\n\n");
}
