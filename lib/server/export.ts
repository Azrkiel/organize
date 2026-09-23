import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes: plenty for a single export run right after this loads.

export type ExportNote = {
  id: string;
  title: string;
  content: Json;
  courseId: string | null;
  folderId: string | null;
};

export type ExportAttachment = {
  noteId: string;
  fileName: string;
  signedUrl: string | null;
};

export type ExportData = {
  courses: { id: string; name: string }[];
  folders: { id: string; name: string; parentId: string | null; courseId: string }[];
  notes: ExportNote[];
  attachments: ExportAttachment[];
};

/** Everything needed to build the "export all notes" ZIP client-side (PLAN.md Phase 8 task 4). */
export async function getExportData(): Promise<ExportData> {
  const supabase = await createClient();

  const [{ data: courses }, { data: folders }, { data: notes }, { data: attachmentRows }] = await Promise.all([
    supabase.from("courses").select("id, name").order("position"),
    supabase.from("folders").select("id, name, parent_id, course_id").order("position"),
    supabase.from("notes").select("id, title, content, course_id, folder_id"),
    supabase.from("attachments").select("id, note_id, file_name, storage_path").not("note_id", "is", null),
  ]);

  const attachments: ExportAttachment[] = await Promise.all(
    (attachmentRows ?? []).map(async (a) => {
      const { data: signed } = await supabase.storage
        .from("attachments")
        .createSignedUrl(a.storage_path, SIGNED_URL_TTL_SECONDS);
      return { noteId: a.note_id as string, fileName: a.file_name, signedUrl: signed?.signedUrl ?? null };
    })
  );

  return {
    courses: courses ?? [],
    folders: (folders ?? []).map((f) => ({ id: f.id, name: f.name, parentId: f.parent_id, courseId: f.course_id })),
    notes: (notes ?? []).map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      courseId: n.course_id,
      folderId: n.folder_id,
    })),
    attachments,
  };
}
