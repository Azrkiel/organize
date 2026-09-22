"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string };
const nameSchema = z.string().trim().min(1, "Name is required").max(100);

export async function createFolder(
  courseId: string,
  name: string,
  parentId: string | null
): Promise<ActionResult & { id?: string }> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  let siblingFilter = supabase
    .from("folders")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);
  siblingFilter = parentId ? siblingFilter.eq("parent_id", parentId) : siblingFilter.is("parent_id", null);
  const { count } = await siblingFilter;

  const { data, error } = await supabase
    .from("folders")
    .insert({
      user_id: auth.user.id,
      course_id: courseId,
      parent_id: parentId,
      name: parsed.data,
      position: count ?? 0,
    })
    .select("id")
    .single();

  if (error) return { error: "Could not create folder." };
  revalidatePath("/", "layout");
  return { id: data.id };
}

export async function renameFolder(folderId: string, name: string): Promise<ActionResult> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("folders").update({ name: parsed.data }).eq("id", folderId);
  if (error) return { error: "Could not rename folder." };
  revalidatePath("/", "layout");
  return {};
}

/**
 * Deletes a folder. The database cascades: subfolders are deleted too, and any note that was in
 * this folder (or a deleted subfolder) has its folder_id set to null, i.e. it moves to the course root.
 */
export async function deleteFolder(folderId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("folders").delete().eq("id", folderId);
  if (error) return { error: "Could not delete folder." };
  revalidatePath("/", "layout");
  return {};
}

/** Moves a folder under a new parent (or to the course root when `newParentId` is null). */
export async function moveFolder(folderId: string, newParentId: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  const { data: folder } = await supabase
    .from("folders")
    .select("id, course_id, parent_id")
    .eq("id", folderId)
    .single();
  if (!folder) return { error: "Folder not found." };
  if (folderId === newParentId) return { error: "A folder can't be its own parent." };

  if (newParentId) {
    const { data: target } = await supabase
      .from("folders")
      .select("id, course_id, parent_id")
      .eq("id", newParentId)
      .single();
    if (!target) return { error: "Target folder not found." };
    if (target.course_id !== folder.course_id) return { error: "Folders can only move within the same course." };

    // Walk up from the target to the root; if we hit `folder`, this move would create a cycle.
    const { data: allFolders } = await supabase
      .from("folders")
      .select("id, parent_id")
      .eq("course_id", folder.course_id);
    const byId = new Map((allFolders ?? []).map((f) => [f.id, f.parent_id]));
    let cursor: string | null = newParentId;
    while (cursor) {
      if (cursor === folderId) return { error: "Can't move a folder into its own subfolder." };
      cursor = byId.get(cursor) ?? null;
    }
  }

  let siblingFilter = supabase
    .from("folders")
    .select("id", { count: "exact", head: true })
    .eq("course_id", folder.course_id);
  siblingFilter = newParentId ? siblingFilter.eq("parent_id", newParentId) : siblingFilter.is("parent_id", null);
  const { count } = await siblingFilter;

  const { error } = await supabase
    .from("folders")
    .update({ parent_id: newParentId, position: count ?? 0 })
    .eq("id", folderId);
  if (error) return { error: "Could not move folder." };
  revalidatePath("/", "layout");
  return {};
}
