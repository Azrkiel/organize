import { describe, expect, it } from "vitest";
import { interleaveSlides, type TranscriptSegment } from "@/lib/interleave";

const segments: TranscriptSegment[] = [
  { start: 0, end: 10, text: "First segment." },
  { start: 15, end: 25, text: "Second segment." },
  { start: 30, end: 40, text: "Third segment." },
];

describe("interleaveSlides", () => {
  it("places a slide before the first segment when its offset is at or before the first segment's start", () => {
    const result = interleaveSlides(segments, [{ index: 1, offsetSeconds: 0 }]);
    expect(result.split("\n\n")).toEqual(["[SLIDE 1 at 0:00]", "First segment.", "Second segment.", "Third segment."]);
  });

  it("places a slide after the last segment when its offset is past every segment's end", () => {
    const result = interleaveSlides(segments, [{ index: 1, offsetSeconds: 50 }]);
    expect(result.split("\n\n")).toEqual(["First segment.", "Second segment.", "Third segment.", "[SLIDE 1 at 0:50]"]);
  });

  it("places a slide between two segments when its offset falls in the gap between them", () => {
    const result = interleaveSlides(segments, [{ index: 1, offsetSeconds: 12 }]);
    expect(result.split("\n\n")).toEqual(["First segment.", "[SLIDE 1 at 0:12]", "Second segment.", "Third segment."]);
  });

  it("orders multiple slides correctly and formats minutes:seconds", () => {
    const result = interleaveSlides(segments, [
      { index: 2, offsetSeconds: 72 },
      { index: 1, offsetSeconds: 12 },
    ]);
    expect(result.split("\n\n")).toEqual([
      "First segment.",
      "[SLIDE 1 at 0:12]",
      "Second segment.",
      "Third segment.",
      "[SLIDE 2 at 1:12]",
    ]);
  });

  it("handles no segments at all by just listing the slide markers", () => {
    const result = interleaveSlides([], [{ index: 1, offsetSeconds: 5 }]);
    expect(result).toBe("[SLIDE 1 at 0:05]");
  });

  it("includes the slide's extracted text under its marker when present", () => {
    const result = interleaveSlides(segments, [{ index: 1, offsetSeconds: 0, slideText: "F = ma" }]);
    expect(result.split("\n\n")[0]).toBe("[SLIDE 1 at 0:00]\nF = ma");
  });
});
