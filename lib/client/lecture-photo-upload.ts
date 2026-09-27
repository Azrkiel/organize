import { createClient } from "@/lib/supabase/client";
import {
  recordLecturePhoto,
  extractLecturePhotoText,
  updateSlideText,
  replaceLecturePhotoStorage,
} from "@/app/(app)/actions/lecture-photos";
import { compressImage } from "@/lib/client/compress-image";
import { ocrSlideText } from "@/lib/client/slide-ocr";

/** Best-effort slide text (PLAN.md Phase 12 task 5) — one photo at a time (awaited by every
 * caller), never lets an extraction failure affect the upload/retake's own success. */
async function extractAndSaveSlideText(photoId: string, storagePath: string, blob: Blob): Promise<void> {
  try {
    const { ocrNeeded } = await extractLecturePhotoText(photoId, storagePath);
    if (ocrNeeded) {
      const text = await ocrSlideText(blob);
      if (text) await updateSlideText(photoId, text);
    }
  } catch {
    // Slide text is enrichment, not required for the photo to count as uploaded.
  }
}

/** Compresses (PLAN.md Phase 12 task 3) and uploads a slide photo straight from the browser to
 * Storage — bypasses server action body limits and costs no server time, same reasoning as
 * Phase 3's `uploadAttachment`. Compression happens here, not by the caller, so both the live
 * upload path and the offline-queue retry path (which stores the already-compressed blob) share
 * one place that actually talks to Storage. */
export async function uploadLecturePhoto({
  userId,
  lectureId,
  courseId,
  blob,
  offsetSeconds,
  caption,
}: {
  userId: string;
  lectureId: string | null;
  courseId: string | null;
  blob: Blob;
  offsetSeconds: number | null;
  caption: string | null;
}): Promise<{ id?: string; error?: string }> {
  const storagePath = `${userId}/${lectureId ?? "unfiled"}/${crypto.randomUUID()}.jpg`;

  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from("lecture-photos")
    .upload(storagePath, blob, { contentType: "image/jpeg", upsert: false });
  if (uploadError) return { error: uploadError.message };

  const result = await recordLecturePhoto({ lectureId, courseId, storagePath, offsetSeconds, caption });
  if (result.error) {
    await supabase.storage.from("lecture-photos").remove([storagePath]);
    return { error: result.error };
  }

  await extractAndSaveSlideText(result.id!, storagePath, blob);
  return { id: result.id };
}

/** Retake (PLAN.md Phase 12 task 8): replaces one photo's image in place — same row, same
 * caption/offset — rather than deleting and re-adding, so its position in the gallery/notes
 * doesn't shift. Re-runs slide text extraction against the new image. */
export async function retakeLecturePhoto({
  userId,
  photoId,
  oldStoragePath,
  lectureId,
  file,
}: {
  userId: string;
  photoId: string;
  oldStoragePath: string;
  lectureId: string | null;
  file: File;
}): Promise<{ error?: string }> {
  let blob: Blob;
  try {
    blob = await compressImage(file);
  } catch {
    return { error: "Could not process that photo." };
  }

  const newStoragePath = `${userId}/${lectureId ?? "unfiled"}/${crypto.randomUUID()}.jpg`;
  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from("lecture-photos")
    .upload(newStoragePath, blob, { contentType: "image/jpeg", upsert: false });
  if (uploadError) return { error: uploadError.message };

  const result = await replaceLecturePhotoStorage(photoId, newStoragePath, oldStoragePath);
  if (result.error) {
    await supabase.storage.from("lecture-photos").remove([newStoragePath]);
    return { error: result.error };
  }

  await extractAndSaveSlideText(photoId, newStoragePath, blob);
  return {};
}

/** Compresses a raw camera photo and uploads it in one step — the normal (online) path. */
export async function compressAndUploadLecturePhoto(input: {
  userId: string;
  lectureId: string | null;
  courseId: string | null;
  file: File;
  offsetSeconds: number | null;
  caption: string | null;
}): Promise<{ id?: string; error?: string }> {
  let blob: Blob;
  try {
    blob = await compressImage(input.file);
  } catch {
    return { error: "Could not process that photo." };
  }
  return uploadLecturePhoto({ ...input, blob });
}
