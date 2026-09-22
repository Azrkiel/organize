import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Note } from "@/lib/types";

const noteListOrder = { column: "updated_at" as const, ascending: false };

/** Notes directly at a course's root (no folder), pinned first. */
export async function getCourseRootNotes(courseId: string): Promise<Note[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select("*")
    .eq("course_id", courseId)
    .is("folder_id", null)
    .order("pinned", { ascending: false })
    .order(noteListOrder.column, { ascending: noteListOrder.ascending });
  return data ?? [];
}

/** Notes inside one folder, pinned first. */
export async function getFolderNotes(folderId: string): Promise<Note[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select("*")
    .eq("folder_id", folderId)
    .order("pinned", { ascending: false })
    .order(noteListOrder.column, { ascending: noteListOrder.ascending });
  return data ?? [];
}

/** Notes with no course at all. */
export async function getUnfiledNotes(): Promise<Note[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select("*")
    .is("course_id", null)
    .order("pinned", { ascending: false })
    .order(noteListOrder.column, { ascending: noteListOrder.ascending });
  return data ?? [];
}
