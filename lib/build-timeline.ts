import type { TranscriptSegment } from "@/lib/interleave";

export type TimelinePhoto = { id: string; offsetSeconds: number; url: string | null; caption: string | null };

export type TimelineEntry =
  | { type: "transcript"; start: number; end: number; text: string }
  | { type: "photo"; photo: TimelinePhoto };

/** Weaves a lecture's transcript and slide photos into one chronological list (PLAN.md Phase 12
 * task 13, owner request: "what is the context?" for each photo, not just the photo on its own).
 * Same merge algorithm as `lib/interleave.ts`'s `interleaveSlides`, but returns structured entries
 * instead of a joined string, since the timeline UI renders a real photo thumbnail inline rather
 * than a plain-text marker. */
export function buildLectureTimeline(segments: TranscriptSegment[], photos: TimelinePhoto[]): TimelineEntry[] {
  const sortedPhotos = [...photos].sort((a, b) => a.offsetSeconds - b.offsetSeconds);
  const entries: TimelineEntry[] = [];
  let photoIndex = 0;

  function flushPhotosUpTo(threshold: number) {
    while (photoIndex < sortedPhotos.length && sortedPhotos[photoIndex].offsetSeconds <= threshold) {
      entries.push({ type: "photo", photo: sortedPhotos[photoIndex] });
      photoIndex++;
    }
  }

  for (const segment of segments) {
    flushPhotosUpTo(segment.start);
    entries.push({ type: "transcript", start: segment.start, end: segment.end, text: segment.text });
  }
  flushPhotosUpTo(Infinity);

  return entries;
}
