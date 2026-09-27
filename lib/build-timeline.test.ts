import { describe, expect, it } from "vitest";
import { buildLectureTimeline, type TimelineEntry } from "@/lib/build-timeline";
import type { TranscriptSegment } from "@/lib/interleave";

function photoIdsOf(entries: TimelineEntry[]): string[] {
  return entries.filter((e): e is Extract<TimelineEntry, { type: "photo" }> => e.type === "photo").map((e) => e.photo.id);
}

const segments: TranscriptSegment[] = [
  { start: 0, end: 10, text: "First segment." },
  { start: 15, end: 25, text: "Second segment." },
  { start: 30, end: 40, text: "Third segment." },
];

function photo(id: string, offsetSeconds: number) {
  return { id, offsetSeconds, url: `url-${id}`, caption: null };
}

describe("buildLectureTimeline", () => {
  it("places a photo before the first segment when its offset is at or before it", () => {
    const entries = buildLectureTimeline(segments, [photo("p1", 0)]);
    expect(entries[0]).toEqual({ type: "photo", photo: photo("p1", 0) });
    expect(entries[1]).toMatchObject({ type: "transcript", text: "First segment." });
  });

  it("places a photo after the last segment when its offset is past every segment's end", () => {
    const entries = buildLectureTimeline(segments, [photo("p1", 50)]);
    expect(entries[entries.length - 1]).toEqual({ type: "photo", photo: photo("p1", 50) });
  });

  it("places a photo between two segments when its offset falls in the gap", () => {
    const entries = buildLectureTimeline(segments, [photo("p1", 12)]);
    expect(entries.map((e) => (e.type === "photo" ? e.photo.id : e.text))).toEqual([
      "First segment.",
      "p1",
      "Second segment.",
      "Third segment.",
    ]);
  });

  it("orders multiple photos by offset regardless of input order", () => {
    const entries = buildLectureTimeline(segments, [photo("late", 50), photo("early", 0)]);
    expect(photoIdsOf(entries)).toEqual(["early", "late"]);
  });

  it("returns only photos when there are no transcript segments", () => {
    const entries = buildLectureTimeline([], [photo("p1", 5)]);
    expect(entries).toEqual([{ type: "photo", photo: photo("p1", 5) }]);
  });
});
