import "server-only";
import { createClient } from "@/lib/supabase/server";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — plenty for a gallery/lightbox session.

export type LecturePhotoWithUrl = {
  id: string;
  storagePath: string;
  signedUrl: string | null;
  offsetSeconds: number | null;
  caption: string | null;
  slideText: string | null;
  takenAt: string;
};

/** Every slide photo for one lecture, oldest first, with a signed URL each (the bucket is
 * private) — PLAN.md Phase 12 tasks 2, 4, 8. */
export async function getLecturePhotos(lectureId: string): Promise<LecturePhotoWithUrl[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lecture_photos")
    .select("id, storage_path, offset_seconds, caption, slide_text, taken_at")
    .eq("lecture_id", lectureId)
    .order("taken_at", { ascending: true });

  return Promise.all(
    (data ?? []).map(async (p) => {
      const { data: signed } = await supabase.storage
        .from("lecture-photos")
        .createSignedUrl(p.storage_path, SIGNED_URL_TTL_SECONDS);
      return {
        id: p.id,
        storagePath: p.storage_path,
        signedUrl: signed?.signedUrl ?? null,
        offsetSeconds: p.offset_seconds,
        caption: p.caption,
        slideText: p.slide_text,
        takenAt: p.taken_at,
      };
    })
  );
}
