import { createClient } from "@/lib/supabase/client";
import { recordAttachment } from "@/app/(app)/actions/attachments";

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export class AttachmentTooLargeError extends Error {
  constructor() {
    super(`File is over the 20 MB limit.`);
  }
}

/** Uploads a file straight from the browser to Storage (bypasses server action body limits), then records it. */
export async function uploadAttachment(noteId: string, userId: string, file: File) {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new AttachmentTooLargeError();

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-150);
  const storagePath = `${userId}/${noteId}/${crypto.randomUUID()}-${safeName}`;

  const supabase = createClient();
  const { error: uploadError } = await supabase.storage.from("attachments").upload(storagePath, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const result = await recordAttachment({
    noteId,
    storagePath,
    fileName: file.name,
    mimeType: file.type || null,
    sizeBytes: file.size,
  });
  if (result.error) {
    await supabase.storage.from("attachments").remove([storagePath]);
    throw new Error(result.error);
  }
  return result.id!;
}
