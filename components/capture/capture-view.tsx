"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compressImage } from "@/lib/client/compress-image";
import { uploadLecturePhoto } from "@/lib/client/lecture-photo-upload";
import { enqueuePhoto, flushPhotoQueue, getQueuedPhotos } from "@/lib/client/lecture-photo-queue";
import type { LecturePhotoWithUrl } from "@/lib/server/lecture-photos";

type LocalPhoto = { id: string; url: string; caption: string | null };

/** Phone-first slide capture (PLAN.md Phase 12 tasks 2-3) — shared by the QR-code entry point
 * (`/capture/[lectureId]`, lecture-scoped, with a real `offsetSeconds` per photo) and the mobile
 * bottom nav's course-only fallback (`/capture` with nothing currently recording — photos just
 * get `course_id`, no `lecture_id`, no meaningful offset). */
export function CaptureView({
  userId,
  lectureId,
  courseId,
  heading,
  recordedAt,
  initialPhotos,
}: {
  userId: string;
  lectureId: string | null;
  courseId: string | null;
  heading: string;
  recordedAt: string | null;
  initialPhotos: LecturePhotoWithUrl[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<LocalPhoto[]>(
    initialPhotos.map((p) => ({ id: p.id, url: p.signedUrl ?? "", caption: p.caption }))
  );
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    function flush() {
      flushPhotoQueue(() => setQueuedCount((n) => Math.max(0, n - 1))).catch(() => {});
    }
    getQueuedPhotos()
      .then((items) => setQueuedCount(items.length))
      .catch(() => {});
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);

  function computeOffsetSeconds(): number | null {
    if (!recordedAt) return null;
    return Math.max(0, Math.round((Date.now() - new Date(recordedAt).getTime()) / 1000));
  }

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    const takenCaption = caption.trim() || null;
    try {
      const blob = await compressImage(file);
      const offsetSeconds = computeOffsetSeconds();

      if (!navigator.onLine) {
        await enqueuePhoto({ userId, lectureId, courseId, blob, offsetSeconds, caption: takenCaption });
        setQueuedCount((n) => n + 1);
        setCaption("");
        return;
      }

      const result = await uploadLecturePhoto({ userId, lectureId, courseId, blob, offsetSeconds, caption: takenCaption });
      if (result.error) {
        // A real upload failure (not just "offline") still shouldn't lose the photo — queue it
        // for the next retry rather than making the owner re-take the shot.
        await enqueuePhoto({ userId, lectureId, courseId, blob, offsetSeconds, caption: takenCaption });
        setQueuedCount((n) => n + 1);
        setError("Couldn't upload right now — it'll send automatically once you're back online.");
      } else if (result.id) {
        setPhotos((prev) => [...prev, { id: result.id!, url: URL.createObjectURL(blob), caption: takenCaption }]);
      }
      setCaption("");
    } catch {
      setError("Could not process that photo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <div className="text-center">
        <h1 className="text-lg font-semibold tracking-tight">{heading}</h1>
        {queuedCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {queuedCount} photo{queuedCount === 1 ? "" : "s"} waiting to upload…
          </p>
        )}
      </div>

      <Input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Caption for the next photo (optional)"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <Button
        size="lg"
        className="h-32 w-full flex-col gap-2 text-lg"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? <Loader2 className="size-8 animate-spin" /> : <Camera className="size-8" />}
        {uploading ? "Uploading…" : "Snap slide"}
      </Button>

      {error && <p className="text-center text-sm text-destructive">{error}</p>}

      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {photos.map((p) => (
            <div key={p.id} className="w-20 shrink-0 space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URLs / local object URLs, not next/image-optimizable */}
              <img src={p.url} alt={p.caption ?? "Slide photo"} className="h-20 w-20 rounded-md object-cover" />
              {p.caption && <p className="truncate text-center text-xs text-muted-foreground">{p.caption}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
