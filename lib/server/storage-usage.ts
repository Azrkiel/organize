import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Total bytes of Supabase Storage the signed-in user has used — attachments plus lecture slide
 * photos (PLAN.md Phase 12 task 9: one combined total, not a second untracked number) — or null if
 * they're signed out. */
export async function getAttachmentStorageBytes(): Promise<number | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const [{ data: attachments }, { data: photos }] = await Promise.all([
    supabase.from("attachments").select("size_bytes"),
    supabase.from("lecture_photos").select("size_bytes"),
  ]);

  const attachmentBytes = (attachments ?? []).reduce((sum, row) => sum + (row.size_bytes ?? 0), 0);
  const photoBytes = (photos ?? []).reduce((sum, row) => sum + (row.size_bytes ?? 0), 0);
  return attachmentBytes + photoBytes;
}
