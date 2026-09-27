/**
 * "Smart capture" (PLAN.md Phase 12 task 11, added at the owner's request): keeps the phone's
 * camera live and auto-snaps a photo whenever the professor advances to a new slide, instead of
 * requiring a manual button press per slide. Detection is a cheap grayscale frame-diff over a tiny
 * downsampled canvas — no ML model, nothing to download, works offline, and is more than accurate
 * enough for "did the whole frame change" (a slide advance) versus "small motion" (a laser pointer,
 * the professor walking past camera, hand shake).
 *
 * State machine per sample tick:
 *   settling         -- just started; give the camera a moment to focus/expose, then treat
 *                        whatever's on screen as slide 1 and start watching.
 *   watching         -- comparing each new sample against the last captured slide. A big enough
 *                        diff means something is changing (a real slide flip, or a hand/laser
 *                        crossing the frame) -> move to detecting-change.
 *   detecting-change  -- comparing each new sample against the PREVIOUS sample (not the last
 *                        capture) to find the moment things stop moving. Requires a few
 *                        consecutive low-diff samples in a row before treating it as a settled new
 *                        slide worth capturing -- this is what tells an actual slide change (settles
 *                        quickly) apart from a hand still waving around (diff never quiets down).
 */

export type SlideWatcherStatus = "settling" | "watching" | "detecting-change";

export type SlideWatcherHandle = {
  stream: MediaStream;
  stop: () => void;
};

const SAMPLE_INTERVAL_MS = 1000;
const SETTLE_DELAY_MS = 1500;
const SAMPLE_WIDTH = 48;
const SAMPLE_HEIGHT = 36;
// Fraction (0-1) of full grayscale range the average pixel must move by to count as "different".
const CHANGE_THRESHOLD = 0.12;
const STABLE_THRESHOLD = 0.03;
const STABLE_SAMPLES_REQUIRED = 2;

function sampleLuminance(ctx: CanvasRenderingContext2D, source: CanvasImageSource): Float32Array {
  ctx.drawImage(source, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  const { data } = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  const out = new Float32Array(SAMPLE_WIDTH * SAMPLE_HEIGHT);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    out[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return out;
}

/** Mean absolute luminance difference between two same-sized samples, normalized to 0-1. */
function frameDiff(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length / 255;
}

function captureFullResolutionBlob(video: HTMLVideoElement): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(video, 0, 0);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92));
}

export async function startSlideWatcher({
  video,
  onCapture,
  onStatusChange,
}: {
  video: HTMLVideoElement;
  onCapture: (blob: Blob) => void;
  onStatusChange?: (status: SlideWatcherStatus) => void;
}): Promise<SlideWatcherHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();

  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = SAMPLE_WIDTH;
  sampleCanvas.height = SAMPLE_HEIGHT;
  const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  if (!sampleCtx) throw new Error("This browser doesn't support smart capture.");

  let referenceFrame: Float32Array | null = null;
  let lastFrame: Float32Array | null = null;
  let stableCount = 0;
  let capturing = false;

  async function captureAsSlide(sample: Float32Array) {
    capturing = true;
    try {
      const blob = await captureFullResolutionBlob(video);
      if (blob) onCapture(blob);
      referenceFrame = sample;
    } finally {
      capturing = false;
    }
  }

  onStatusChange?.("settling");
  const settleTimer = setTimeout(() => {
    const sample = sampleLuminance(sampleCtx, video);
    captureAsSlide(sample);
    onStatusChange?.("watching");
  }, SETTLE_DELAY_MS);

  const interval = setInterval(() => {
    if (capturing || !referenceFrame) return;
    const sample = sampleLuminance(sampleCtx, video);

    if (!lastFrame) {
      lastFrame = sample;
      return;
    }

    const diffFromLastCapture = frameDiff(sample, referenceFrame);
    if (diffFromLastCapture < CHANGE_THRESHOLD) {
      lastFrame = sample;
      stableCount = 0;
      return;
    }

    // Something's different from the last captured slide — wait for it to stop changing
    // frame-to-frame before treating it as a genuine new slide, not a hand/laser passing through.
    onStatusChange?.("detecting-change");
    const diffFromLastSample = frameDiff(sample, lastFrame);
    lastFrame = sample;
    if (diffFromLastSample < STABLE_THRESHOLD) {
      stableCount++;
      if (stableCount >= STABLE_SAMPLES_REQUIRED) {
        stableCount = 0;
        captureAsSlide(sample).then(() => onStatusChange?.("watching"));
      }
    } else {
      stableCount = 0;
    }
  }, SAMPLE_INTERVAL_MS);

  return {
    stream,
    stop: () => {
      clearTimeout(settleTimer);
      clearInterval(interval);
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}
