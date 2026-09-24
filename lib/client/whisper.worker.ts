/**
 * Whisper transcription worker (PLAN.md Phase 9 task 4). Runs `@huggingface/transformers`'s
 * automatic-speech-recognition pipeline off the main thread, one ~10-minute audio segment per
 * message, so the tab stays usable during a long transcription.
 *
 * The `@huggingface/transformers` import is dynamic rather than a top-level `import`, on purpose:
 * Turbopack has a known issue (vercel/next.js#98841) where a module Worker can get emitted with
 * its module type stripped, which would make a top-level `import` a hard SyntaxError. A dynamic
 * `import()` inside the handler works the same either way.
 */

export type WhisperRequest = {
  type: "transcribe";
  requestId: number;
  modelSize: "tiny" | "base" | "small";
  audio: Float32Array;
};

export type WhisperResponse =
  | { type: "model-progress"; requestId: number; loaded: number; total: number; file: string }
  | { type: "result"; requestId: number; text: string }
  | { type: "error"; requestId: number; message: string };

type PipelineFn = (audio: Float32Array, options: Record<string, unknown>) => Promise<{ text: string }>;

let cachedModelSize: string | null = null;
let cachedPipeline: PipelineFn | null = null;

async function getPipeline(modelSize: string, requestId: number): Promise<PipelineFn> {
  if (cachedPipeline && cachedModelSize === modelSize) return cachedPipeline;

  const { pipeline } = await import("@huggingface/transformers");
  const device = typeof navigator !== "undefined" && "gpu" in navigator ? "webgpu" : "wasm";

  const asrPipeline = (await pipeline("automatic-speech-recognition", `onnx-community/whisper-${modelSize}`, {
    device,
    progress_callback: (progress: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (progress.status === "progress" && progress.file && progress.total) {
        self.postMessage({
          type: "model-progress",
          requestId,
          loaded: progress.loaded ?? 0,
          total: progress.total,
          file: progress.file,
        } satisfies WhisperResponse);
      }
    },
  })) as unknown as PipelineFn;

  cachedModelSize = modelSize;
  cachedPipeline = asrPipeline;
  return asrPipeline;
}

self.addEventListener("message", async (event: MessageEvent<WhisperRequest>) => {
  const { type, requestId, modelSize, audio } = event.data;
  if (type !== "transcribe") return;

  try {
    const transcriber = await getPipeline(modelSize, requestId);
    // PLAN.md Phase 9 task 4: keeps memory manageable on long lectures by never decoding the
    // whole thing in one generate() call — each segment is already ~10 minutes at most, and
    // this further slides a 30s window with 5s of overlap across it.
    const output = await transcriber(audio, { chunk_length_s: 30, stride_length_s: 5 });
    self.postMessage({ type: "result", requestId, text: output.text.trim() } satisfies WhisperResponse);
  } catch (err) {
    self.postMessage({
      type: "error",
      requestId,
      message: err instanceof Error ? err.message : "Transcription failed.",
    } satisfies WhisperResponse);
  }
});
