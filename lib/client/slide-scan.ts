/**
 * Auto-scan (PLAN.md Phase 12 task 12, owner request): "like Adobe Scan, but for a screen" — finds
 * the slide/screen's four corners in a photo taken at an angle and perspective-corrects it into a
 * straight-on rectangular crop, the standard OpenCV document-scanner recipe (grayscale -> blur ->
 * Canny edges -> dilate -> find contours -> keep the largest one that approximates to 4 points ->
 * warp to a rectangle). Uses OpenCV.js, loaded lazily only when this runs (never affects any other
 * page's load time) — but as a runtime `<script>` tag from a CDN, NOT an npm import: the
 * `@techstark/opencv-js` package's `dist/opencv.js` is a ~13MB single generated file, and
 * `import("@techstark/opencv-js")` made Next's production build crash (`RangeError: Maximum call
 * stack size exceeded`, some regex-based transform choking on the file). Script-tag loading is
 * also simply the standard way to use OpenCV.js in a browser — every official OpenCV.js tutorial
 * does it this way, not via a bundler.
 *
 * Runs on the main thread: it's a one-off per-photo operation (unlike lib/client/slide-watcher.ts's
 * continuous per-frame loop), so a worker isn't worth the complexity.
 *
 * Safety net: returns the ORIGINAL blob, unchanged, whenever no confident quadrilateral is found or
 * anything in the pipeline throws — this feature can make a photo better, never worse. The existing
 * slide-gallery "Retake" action is the fallback if a scan ever gets it wrong.
 */

// No official TS types for a global loaded this way — `any` here is deliberate, not a shortcut.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cv = any;

const MIN_QUAD_AREA_FRACTION = 0.15;

// Pinned to the exact version last verified against this file's OpenCV API calls — bump
// deliberately, not automatically, since a major OpenCV.js version bump could rename something.
const OPENCV_JS_URL = "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@5.0.0-release.1/dist/opencv.js";

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the scanning library."));
    document.head.appendChild(script);
  });
}

let cvPromise: Promise<Cv> | null = null;

/** OpenCV.js's Emscripten-generated glue code looks for a pre-existing global `Module` object and
 * calls `Module.onRuntimeInitialized()` once WASM is ready, REGARDLESS of whether the file is
 * loaded as a script tag or a module — so this hook is registered before the script is even
 * injected, guaranteeing it's never missed to a race. */
async function getCv(): Promise<Cv> {
  if (!cvPromise) {
    cvPromise = new Promise<Cv>((resolve, reject) => {
      const w = window as unknown as { cv?: Cv; Module?: { onRuntimeInitialized?: () => void } };
      if (w.cv?.Mat) {
        resolve(w.cv);
        return;
      }
      const previousHook = w.Module?.onRuntimeInitialized;
      w.Module = {
        ...w.Module,
        onRuntimeInitialized: () => {
          previousHook?.();
          resolve((window as unknown as { cv: Cv }).cv);
        },
      };
      loadScriptOnce(OPENCV_JS_URL).catch(reject);
    });
  }
  return cvPromise;
}

type Point = [number, number];

function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Orders 4 arbitrary corners as [top-left, top-right, bottom-right, bottom-left] — the standard
 * sum/difference trick: top-left has the smallest x+y, bottom-right the largest; top-right has the
 * smallest y-x, bottom-left the largest. */
function orderCorners(points: Point[]): [Point, Point, Point, Point] {
  const bySum = [...points].sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  const byDiff = [...points].sort((a, b) => a[1] - a[0] - (b[1] - b[0]));
  return [bySum[0], byDiff[0], bySum[3], byDiff[3]];
}

function computeOutputSize(corners: [Point, Point, Point, Point]): { width: number; height: number } {
  const [tl, tr, br, bl] = corners;
  const width = Math.round(Math.max(distance(tl, tr), distance(bl, br)));
  const height = Math.round(Math.max(distance(tl, bl), distance(tr, br)));
  return { width: Math.max(width, 1), height: Math.max(height, 1) };
}

/** Finds the largest 4-point contour covering at least `MIN_QUAD_AREA_FRACTION` of the frame, or
 * null if nothing confident enough exists (an untilted photo, or a cluttered background). */
function findSlideQuad(cv: Cv, edges: Cv, imageArea: number): Point[] | null {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  let best: Point[] | null = null;
  let bestArea = 0;

  try {
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const approx = new cv.Mat();
      try {
        const perimeter = cv.arcLength(contour, true);
        cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);
        if (approx.rows !== 4) continue;

        const area = Math.abs(cv.contourArea(approx));
        if (area <= imageArea * MIN_QUAD_AREA_FRACTION || area <= bestArea) continue;

        bestArea = area;
        best = [
          [approx.data32S[0], approx.data32S[1]],
          [approx.data32S[2], approx.data32S[3]],
          [approx.data32S[4], approx.data32S[5]],
          [approx.data32S[6], approx.data32S[7]],
        ];
      } finally {
        approx.delete();
        contour.delete();
      }
    }
  } finally {
    contours.delete();
    hierarchy.delete();
  }

  return best;
}

/** Perspective-corrects a photo of a slide/screen. Returns the SAME `Blob` instance unchanged
 * (reference-equal — callers can check this) when no confident quadrilateral is found. */
export async function autoScanSlide(photo: Blob): Promise<Blob> {
  try {
    const cv = await getCv();
    const bitmap = await createImageBitmap(photo);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return photo;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const src = cv.imread(canvas);
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const edges = new cv.Mat();
    const dilated = new cv.Mat();
    const kernel = cv.Mat.ones(3, 3, cv.CV_8U);

    let quad: Point[] | null = null;
    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
      cv.Canny(blurred, edges, 50, 150);
      cv.dilate(edges, dilated, kernel);
      quad = findSlideQuad(cv, dilated, src.rows * src.cols);
    } finally {
      gray.delete();
      blurred.delete();
      edges.delete();
      dilated.delete();
      kernel.delete();
    }

    if (!quad) {
      src.delete();
      return photo;
    }

    const corners = orderCorners(quad);
    const { width, height } = computeOutputSize(corners);

    const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, corners.flat());
    const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width, 0, width, height, 0, height]);
    const transform = cv.getPerspectiveTransform(srcPoints, dstPoints);
    const warped = new cv.Mat();

    let result: Blob | null = null;
    try {
      cv.warpPerspective(src, warped, transform, new cv.Size(width, height));
      const outCanvas = document.createElement("canvas");
      outCanvas.width = width;
      outCanvas.height = height;
      cv.imshow(outCanvas, warped);
      result = await new Promise<Blob | null>((resolve) => outCanvas.toBlob(resolve, "image/jpeg", 0.92));
    } finally {
      src.delete();
      srcPoints.delete();
      dstPoints.delete();
      transform.delete();
      warped.delete();
    }

    return result ?? photo;
  } catch {
    return photo;
  }
}
