import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Deletes slide photos for lectures whose notes have already been generated, once the owner's
 * configured retention window has passed (PLAN.md Phase 12 task 9, off by default — see
 * `settings.delete_slide_photos_after_days`). Called from the daily cron alongside the digest.
 *
 * Uses `lectures.updated_at` as a stand-in for "since notes were generated": the update that links
 * `note_id` and flips `status` to `notes_ready` is normally the last thing that touches a lecture,
 * so this is close enough for an opt-in, best-effort cleanup — not a precise audit trail.
 */
export async function cleanupOldSlidePhotos(): Promise<{ deletedPhotos: number }> {
  const supabase = createServiceClient();

  const { data: candidates } = await supabase
    .from("settings")
    .select("user_id, delete_slide_photos_after_days")
    .not("delete_slide_photos_after_days", "is", null)
    .gt("delete_slide_photos_after_days", 0);

  let deletedPhotos = 0;

  for (const { user_id: userId, delete_slide_photos_after_days: days } of candidates ?? []) {
    const cutoff = new Date(Date.now() - days! * 24 * 60 * 60 * 1000).toISOString();

    const { data: lectures } = await supabase
      .from("lectures")
      .select("id")
      .eq("user_id", userId)
      .not("note_id", "is", null)
      .lt("updated_at", cutoff);
    const lectureIds = (lectures ?? []).map((l) => l.id);
    if (lectureIds.length === 0) continue;

    const { data: photos } = await supabase.from("lecture_photos").select("id, storage_path").in("lecture_id", lectureIds);
    if (!photos || photos.length === 0) continue;

    await supabase.storage.from("lecture-photos").remove(photos.map((p) => p.storage_path));
    await supabase
      .from("lecture_photos")
      .delete()
      .in(
        "id",
        photos.map((p) => p.id)
      );
    deletedPhotos += photos.length;
  }

  return { deletedPhotos };
}
