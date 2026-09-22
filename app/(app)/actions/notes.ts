"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

type ActionResult = { error?: string };

export async function createNote(courseId: string | null, folderId: string | null): Promise<ActionResult & { id?: string }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  // A folder always belongs to a course, so a note dropped into one inherits that course
  // (ignoring whatever courseId the caller passed) so it can never end up inconsistent.
  let resolvedCourseId = courseId;
  if (folderId) {
    const { data: folder } = await supabase.from("folders").select("course_id").eq("id", folderId).single();
    if (!folder) return { error: "Folder not found." };
    resolvedCourseId = folder.course_id;
  }

  const { data, error } = await supabase
    .from("notes")
    .insert({ user_id: auth.user.id, course_id: resolvedCourseId, folder_id: folderId, title: "Untitled" })
    .select("id")
    .single();

  if (error) return { error: "Could not create note." };
  revalidatePath("/", "layout");
  return { id: data.id };
}

const saveSchema = z.object({
  title: z.string().trim().min(1).max(200).default("Untitled"),
  content: z.custom<Json>(),
  contentText: z.string().max(500_000),
});

/** Autosave: writes title, TipTap JSON, and the plain-text mirror used for search. */
export async function saveNote(
  noteId: string,
  input: { title: string; content: Json; contentText: string }
): Promise<ActionResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: "Could not save: invalid content." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notes")
    .update({
      title: parsed.data.title,
      content: parsed.data.content,
      content_text: parsed.data.contentText,
    })
    .eq("id", noteId);

  if (error) return { error: "Could not save." };
  revalidatePath("/", "layout");
  return {};
}

export async function setNotePinned(noteId: string, pinned: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("notes").update({ pinned }).eq("id", noteId);
  if (error) return { error: "Could not update note." };
  revalidatePath("/", "layout");
  return {};
}

/** Deletes a note. Storage objects for its attachments are removed first (the DB cascade won't touch Storage). */
export async function deleteNote(noteId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  const { data: attachments } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("note_id", noteId);

  if (attachments && attachments.length > 0) {
    await supabase.storage.from("attachments").remove(attachments.map((a) => a.storage_path));
  }

  const { error } = await supabase.from("notes").delete().eq("id", noteId);
  if (error) return { error: "Could not delete note." };
  revalidatePath("/", "layout");
  return {};
}
