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

export type WhisperChunk = { text: string; start: number; end: number };

export type WhisperResponse =
  | { type: "model-progress"; requestId: number; loaded: number; total: number; file: string }
  | { type: "result"; requestId: number; text: string; chunks: WhisperChunk[] }
  | { type: "error"; requestId: number; message: string };

type PipelineFn = (
  audio: Float32Array,
  options: Record<string, unknown>
) => Promise<{ text: string; chunks?: { text: string; timestamp: [number, number | null] }[] }>;

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
    // `condition_on_previous_text: false` is Whisper's own documented mitigation against getting
    // stuck repeating/hallucinating a filler word (classically "you") when it loses confidence —
    // without it, a bad guess on one window can anchor every window after it in the same segment.
    // return_timestamps: true (chunk-level, not word-level — plenty of resolution for slide
    // alignment, PLAN.md Phase 12 task 6) makes each chunk carry its own [start, end] in seconds.
    const output = await transcriber(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      condition_on_previous_text: false,
      return_timestamps: true,
    });
    // A chunk's end can come back null if the model hits its length limit before an end token —
    // a known Whisper quirk, most often on the very last chunk. Falling back to its own start
    // keeps every chunk's timestamps well-formed instead of leaking a null into stored JSON.
    const chunks: WhisperChunk[] = (output.chunks ?? []).map((c) => ({
      text: c.text,
      start: c.timestamp[0],
      end: c.timestamp[1] ?? c.timestamp[0],
    }));
    self.postMessage({ type: "result", requestId, text: output.text.trim(), chunks } satisfies WhisperResponse);
  } catch (err) {
    self.postMessage({
      type: "error",
      requestId,
      message: err instanceof Error ? err.message : "Transcription failed.",
    } satisfies WhisperResponse);
  }
});
