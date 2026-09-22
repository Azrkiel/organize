"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string };

const MAX_BYTES = 20 * 1024 * 1024;

const recordSchema = z.object({
  noteId: z.string().uuid(),
  storagePath: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(255).nullable(),
  sizeBytes: z.number().int().positive().max(MAX_BYTES),
});

/**
 * Records an attachment row after the browser has already uploaded the file directly to
 * Storage (see lib/attachments-client.ts). Verifies the note is the caller's and the stored
 * path actually starts with `{user_id}/`, matching the Storage RLS policy.
 */
export async function recordAttachment(input: {
  noteId: string;
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
}): Promise<ActionResult & { id?: string }> {
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid attachment." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };
  if (!parsed.data.storagePath.startsWith(`${auth.user.id}/`)) return { error: "Invalid path." };

  const { data: note } = await supabase.from("notes").select("id").eq("id", parsed.data.noteId).single();
  if (!note) return { error: "Note not found." };

  const { data, error } = await supabase
    .from("attachments")
    .insert({
      user_id: auth.user.id,
      note_id: parsed.data.noteId,
      storage_path: parsed.data.storagePath,
      file_name: parsed.data.fileName,
      mime_type: parsed.data.mimeType,
      size_bytes: parsed.data.sizeBytes,
    })
    .select("id")
    .single();

  if (error) return { error: "Could not save attachment." };
  revalidatePath("/", "layout");
  return { id: data.id };
}

export async function deleteAttachment(attachmentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: attachment } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .single();
  if (!attachment) return { error: "Attachment not found." };

  const { error: storageError } = await supabase.storage.from("attachments").remove([attachment.storage_path]);
  if (storageError) return { error: "Could not delete the file." };

  const { error } = await supabase.from("attachments").delete().eq("id", attachmentId);
  if (error) return { error: "Could not delete attachment." };
  revalidatePath("/", "layout");
  return {};
}
