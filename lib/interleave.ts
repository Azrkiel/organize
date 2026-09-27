/** Merges slide photos into a Whisper transcript as `[SLIDE n at MM:SS]` markers (PLAN.md Phase 12
 * task 6), positioning each by matching its `offsetSeconds` against the transcript's chunk-level
 * `transcript_segments` timestamps. Chunk-level (not word-level) resolution means a slide taken
 * mid-chunk lands right after that chunk's text rather than inside it — good enough for anchoring
 * a note's structure, which is all task 7 needs this for. Pure and synchronous so it's cheap to
 * call from both a lecture page render and the note-generation prompt builder. */
import { z } from "zod";

export type TranscriptSegment = { start: number; end: number; text: string };
export type SlideMarker = { index: number; offsetSeconds: number; slideText?: string };

const transcriptSegmentSchema = z.object({ start: z.number(), end: z.number(), text: z.string() });

/** `lectures.transcript_segments` is untyped JSON from the DB — this is the one place that
 * validates it, shared by everything that reads it (the notes prompt builder, the timeline) so
 * they can't drift into checking its shape differently. Malformed/missing data quietly becomes an
 * empty array rather than throwing, since a lecture with no segments (an imported or live
 * transcript, neither of which have timestamps) is a normal, expected case, not an error. */
export function parseTranscriptSegments(raw: unknown): TranscriptSegment[] {
  const parsed = z.array(transcriptSegmentSchema).safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export function interleaveSlides(segments: TranscriptSegment[], slides: SlideMarker[]): string {
  const sortedSlides = [...slides].sort((a, b) => a.offsetSeconds - b.offsetSeconds);
  const parts: string[] = [];
  let slideIndex = 0;

  function flushSlidesUpTo(threshold: number) {
    while (slideIndex < sortedSlides.length && sortedSlides[slideIndex].offsetSeconds <= threshold) {
      parts.push(formatMarker(sortedSlides[slideIndex]));
      slideIndex++;
    }
  }

  for (const segment of segments) {
    flushSlidesUpTo(segment.start);
    const text = segment.text.trim();
    if (text) parts.push(text);
  }
  flushSlidesUpTo(Infinity);

  return parts.join("\n\n");
}

function formatMarker(slide: SlideMarker): string {
  const header = `[SLIDE ${slide.index} at ${formatTimestamp(slide.offsetSeconds)}]`;
  return slide.slideText ? `${header}\n${slide.slideText}` : header;
}

function formatTimestamp(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}
