"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getLecturePhotos, type LecturePhotoWithUrl } from "@/lib/server/lecture-photos";
import { extractSlideTextWithGemini } from "@/lib/server/ai/slide-vision";

type ActionResult<T = object> = { error?: string } & Partial<T>;

export async function getLecturePhotosAction(lectureId: string): Promise<LecturePhotoWithUrl[]> {
  const parsed = z.string().uuid().safeParse(lectureId);
  if (!parsed.success) return [];
  return getLecturePhotos(parsed.data);
}

const recordSchema = z.object({
  lectureId: z.string().uuid().nullable(),
  courseId: z.string().uuid().nullable(),
  storagePath: z.string().min(1),
  offsetSeconds: z.number().int().min(0).nullable(),
  caption: z.string().trim().max(500).nullable(),
  sizeBytes: z.number().int().min(0).nullable(),
});

/** Records a slide photo already uploaded straight from the browser to Storage (PLAN.md Phase 12
 * task 3) — mirrors the attachments pattern: upload first, record second, roll back the upload if
 * recording fails. `sizeBytes` (task 9) feeds the combined storage-usage readout in Settings. */
export async function recordLecturePhoto(input: {
  lectureId: string | null;
  courseId: string | null;
  storagePath: string;
  offsetSeconds: number | null;
  caption: string | null;
  sizeBytes: number | null;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid photo data." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("lecture_photos")
    .insert({
      user_id: auth.user.id,
      lecture_id: parsed.data.lectureId,
      course_id: parsed.data.courseId,
      storage_path: parsed.data.storagePath,
      offset_seconds: parsed.data.offsetSeconds,
      caption: parsed.data.caption,
      size_bytes: parsed.data.sizeBytes,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "Could not save the photo." };
  if (parsed.data.lectureId) revalidatePath(`/lectures/${parsed.data.lectureId}`);
  return { id: data.id };
}

/** Tries Gemini vision for this photo's slide text; the caller runs the tesseract.js fallback
 * itself (client-only) whenever `ocrNeeded` comes back true — no key, a download failure, or any
 * Gemini API error all collapse to the same signal (PLAN.md Phase 12 task 5). */
export async function extractLecturePhotoText(photoId: string, storagePath: string): Promise<{ ocrNeeded: boolean }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ocrNeeded: false };
  if (!process.env.GEMINI_API_KEY) return { ocrNeeded: true };

  const { data: file } = await supabase.storage.from("lecture-photos").download(storagePath);
  if (!file) return { ocrNeeded: true };

  const bytes = Buffer.from(await file.arrayBuffer());
  const text = await extractSlideTextWithGemini(bytes, file.type || "image/jpeg");
  if (!text) return { ocrNeeded: true };

  const { error } = await supabase.from("lecture_photos").update({ slide_text: text }).eq("id", photoId);
  return { ocrNeeded: Boolean(error) };
}

export async function updateSlideText(photoId: string, text: string): Promise<ActionResult> {
  const parsed = z.string().trim().min(1).max(4000).safeParse(text);
  if (!parsed.success) return {};
  const supabase = await createClient();
  const { error } = await supabase.from("lecture_photos").update({ slide_text: parsed.data }).eq("id", photoId);
  return error ? { error: "Could not save slide text." } : {};
}

/** Retake support (PLAN.md Phase 12 task 8): points the same photo row at a freshly-uploaded
 * image and clears `slide_text` so the caller re-extracts it; the caller removes the old Storage
 * object only after this succeeds, so a failure here never leaves the row pointing at nothing. */
export async function replaceLecturePhotoStorage(
  photoId: string,
  newStoragePath: string,
  oldStoragePath: string,
  sizeBytes: number | null
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: photo, error } = await supabase
    .from("lecture_photos")
    .update({ storage_path: newStoragePath, slide_text: null, size_bytes: sizeBytes })
    .eq("id", photoId)
    .select("lecture_id")
    .single();
  if (error || !photo) return { error: "Could not save the retaken photo." };

  await supabase.storage.from("lecture-photos").remove([oldStoragePath]);
  if (photo.lecture_id) revalidatePath(`/lectures/${photo.lecture_id}`);
  return {};
}

export async function updatePhotoCaption(photoId: string, caption: string): Promise<ActionResult> {
  const parsed = z.string().trim().max(500).safeParse(caption);
  if (!parsed.success) return { error: "Caption is too long." };

  const supabase = await createClient();
  const { error } = await supabase.from("lecture_photos").update({ caption: parsed.data || null }).eq("id", photoId);
  if (error) return { error: "Could not save the caption." };
  revalidatePath("/", "layout");
  return {};
}

/** Deletes a slide photo — the DB row and its Storage object both (Storage cascades don't follow
 * a DB delete, same lesson as Phase 3's attachments). */
export async function deleteLecturePhoto(photoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: photo } = await supabase.from("lecture_photos").select("storage_path, lecture_id").eq("id", photoId).maybeSingle();
  if (!photo) return { error: "Photo not found." };

  await supabase.storage.from("lecture-photos").remove([photo.storage_path]);
  const { error } = await supabase.from("lecture_photos").delete().eq("id", photoId);
  if (error) return { error: "Could not delete the photo." };
  if (photo.lecture_id) revalidatePath(`/lectures/${photo.lecture_id}`);
  return {};
}
