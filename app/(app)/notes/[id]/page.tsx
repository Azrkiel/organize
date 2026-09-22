import { notFound } from "next/navigation";
import { NoteEditor } from "@/components/notes/note-editor";
import { createClient } from "@/lib/supabase/server";
import type { AttachmentWithUrl } from "@/components/notes/attachments-panel";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour: plenty for one viewing of the note.

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) notFound();

  const { data: note } = await supabase.from("notes").select("*").eq("id", id).maybeSingle();
  if (!note) notFound();

  const { data: attachmentRows } = await supabase
    .from("attachments")
    .select("*")
    .eq("note_id", id)
    .order("created_at");

  const attachments: AttachmentWithUrl[] = await Promise.all(
    (attachmentRows ?? []).map(async (a) => {
      const { data: signed } = await supabase.storage
        .from("attachments")
        .createSignedUrl(a.storage_path, SIGNED_URL_TTL_SECONDS);
      return {
        id: a.id,
        file_name: a.file_name,
        mime_type: a.mime_type,
        size_bytes: a.size_bytes,
        signedUrl: signed?.signedUrl ?? null,
      };
    })
  );

  return <NoteEditor note={note} userId={auth.user.id} attachments={attachments} />;
}
