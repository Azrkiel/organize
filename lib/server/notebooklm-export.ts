import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

export type NotebookLmNote = { id: string; title: string; content: Json; folderId: string | null };
export type NotebookLmFolder = { id: string; name: string; parentId: string | null };
export type NotebookLmLecture = { id: string; title: string; transcript: string | null; transcriptLive: string | null };

export type NotebookLmExportData = {
  courseName: string;
  notes: NotebookLmNote[];
  folders: NotebookLmFolder[];
  lectures: NotebookLmLecture[];
};

/** Everything needed to build one course's "NotebookLM export" ZIP client-side, in the browser
 * (free tier, no server time) — PLAN.md Phase 11 task 2. Returns null if the course doesn't exist
 * (or isn't the signed-in user's — RLS handles that). */
export async function getNotebookLmExportData(courseId: string): Promise<NotebookLmExportData | null> {
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("name").eq("id", courseId).maybeSingle();
  if (!course) return null;

  const [{ data: notes }, { data: folders }, { data: lectures }] = await Promise.all([
    supabase.from("notes").select("id, title, content, folder_id").eq("course_id", courseId),
    supabase.from("folders").select("id, name, parent_id").eq("course_id", courseId),
    supabase.from("lectures").select("id, title, transcript, transcript_live").eq("course_id", courseId),
  ]);

  return {
    courseName: course.name,
    notes: (notes ?? []).map((n) => ({ id: n.id, title: n.title, content: n.content, folderId: n.folder_id })),
    folders: (folders ?? []).map((f) => ({ id: f.id, name: f.name, parentId: f.parent_id })),
    lectures: (lectures ?? []).map((l) => ({
      id: l.id,
      title: l.title,
      transcript: l.transcript,
      transcriptLive: l.transcript_live,
    })),
  };
}
