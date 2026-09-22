import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Total bytes of attachments the signed-in user has stored, or null if they're signed out. */
export async function getAttachmentStorageBytes(): Promise<number | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase.from("attachments").select("size_bytes");
  return (data ?? []).reduce((sum, row) => sum + (row.size_bytes ?? 0), 0);
}
