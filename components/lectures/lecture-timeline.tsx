import { buildLectureTimeline, type TimelinePhoto } from "@/lib/build-timeline";
import type { TranscriptSegment } from "@/lib/interleave";

function formatTimestamp(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

/** Chronological transcript + slide photos on the lecture page (PLAN.md Phase 12 task 13, owner
 * request: "what is the context?" for a photo, not just the photo on its own) — a read-only
 * complement to the slide gallery below it, not a replacement. No interactivity needed, so this is
 * a plain server-renderable component, unlike the gallery's lightbox. */
export function LectureTimeline({ segments, photos }: { segments: TranscriptSegment[]; photos: TimelinePhoto[] }) {
  if (segments.length === 0 || photos.length === 0) return null;

  const entries = buildLectureTimeline(segments, photos);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium text-muted-foreground">Timeline</p>
      <div className="max-h-[32rem] space-y-3 overflow-y-auto">
        {entries.map((entry, i) =>
          entry.type === "photo" ? (
            <div key={`photo-${entry.photo.id}`} className="flex items-start gap-3">
              <span className="w-12 shrink-0 pt-1 text-right font-mono text-xs text-muted-foreground">
                {formatTimestamp(entry.photo.offsetSeconds)}
              </span>
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border p-2">
                {entry.photo.url && (
                  // eslint-disable-next-line @next/next/no-img-element -- a signed Storage URL, not next/image-optimizable
                  <img
                    src={entry.photo.url}
                    alt={entry.photo.caption ?? "Slide photo"}
                    className="size-14 shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0 text-sm">
                  <p className="font-medium">Slide photo</p>
                  {entry.photo.caption && <p className="truncate text-muted-foreground">{entry.photo.caption}</p>}
                </div>
              </div>
            </div>
          ) : (
            <div key={`transcript-${i}`} className="flex items-start gap-3">
              <span className="w-12 shrink-0 pt-0.5 text-right font-mono text-xs text-muted-foreground">
                {formatTimestamp(entry.start)}
              </span>
              <p className="min-w-0 flex-1 text-sm leading-relaxed">{entry.text}</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
