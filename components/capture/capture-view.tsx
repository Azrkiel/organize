"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compressImage } from "@/lib/client/compress-image";
import { uploadLecturePhoto } from "@/lib/client/lecture-photo-upload";
import { enqueuePhoto, flushPhotoQueue, getQueuedPhotos } from "@/lib/client/lecture-photo-queue";
import { startSlideWatcher, type SlideWatcherHandle, type SlideWatcherStatus } from "@/lib/client/slide-watcher";
import type { LecturePhotoWithUrl } from "@/lib/server/lecture-photos";

type LocalPhoto = { id: string; url: string; caption: string | null };

const SMART_STATUS_LABEL: Record<SlideWatcherStatus, string> = {
  settling: "Point at the board — getting the first slide…",
  watching: "Watching for the next slide…",
  "detecting-change": "Slide changing, hold steady…",
};

/** Phone-first slide capture (PLAN.md Phase 12 tasks 2-3, smart capture task 11) — shared by the
 * QR-code entry point (`/capture/[lectureId]`, lecture-scoped, with a real `offsetSeconds` per
 * photo) and the mobile bottom nav's course-only fallback (`/capture` with nothing currently
 * recording — photos just get `course_id`, no `lecture_id`, no meaningful offset). */
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const watcherRef = useRef<SlideWatcherHandle | null>(null);
  const captureQueueRef = useRef<Blob[]>([]);
  const drainingRef = useRef(false);

  const [photos, setPhotos] = useState<LocalPhoto[]>(
    initialPhotos.map((p) => ({ id: p.id, url: p.signedUrl ?? "", caption: p.caption }))
  );
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [smartActive, setSmartActive] = useState(false);
  const [smartStatus, setSmartStatus] = useState<SlideWatcherStatus>("settling");
  const [justCaptured, setJustCaptured] = useState(false);

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

  // Stop the camera if the owner navigates away without explicitly turning smart capture off.
  useEffect(() => () => watcherRef.current?.stop(), []);

  function computeOffsetSeconds(): number | null {
    if (!recordedAt) return null;
    return Math.max(0, Math.round((Date.now() - new Date(recordedAt).getTime()) / 1000));
  }

  async function handleBlob(blob: Blob) {
    setError(null);
    setUploading(true);
    const takenCaption = caption.trim() || null;
    try {
      const compressed = await compressImage(blob);
      const offsetSeconds = computeOffsetSeconds();

      if (!navigator.onLine) {
        await enqueuePhoto({ userId, lectureId, courseId, blob: compressed, offsetSeconds, caption: takenCaption });
        setQueuedCount((n) => n + 1);
        setCaption("");
        return;
      }

      const result = await uploadLecturePhoto({ userId, lectureId, courseId, blob: compressed, offsetSeconds, caption: takenCaption });
      if (result.error) {
        // A real upload failure (not just "offline") still shouldn't lose the photo — queue it
        // for the next retry rather than making the owner re-take the shot.
        await enqueuePhoto({ userId, lectureId, courseId, blob: compressed, offsetSeconds, caption: takenCaption });
        setQueuedCount((n) => n + 1);
        setError("Couldn't upload right now — it'll send automatically once you're back online.");
      } else if (result.id) {
        setPhotos((prev) => [...prev, { id: result.id!, url: URL.createObjectURL(compressed), caption: takenCaption }]);
      }
      setCaption("");
    } catch {
      setError("Could not process that photo.");
    } finally {
      setUploading(false);
    }
  }

  // Smart capture can fire again (per lib/client/slide-watcher.ts's own cooldown/settle timing)
  // before a slow upload+OCR from the previous slide finishes — queue rather than run them
  // concurrently, since slide text extraction is meant to happen one photo at a time.
  async function drainCaptureQueue() {
    if (drainingRef.current) return;
    drainingRef.current = true;
    while (captureQueueRef.current.length > 0) {
      const blob = captureQueueRef.current.shift()!;
      await handleBlob(blob);
    }
    drainingRef.current = false;
  }

  function handleSmartCapture(blob: Blob) {
    captureQueueRef.current.push(blob);
    drainCaptureQueue();
    setJustCaptured(true);
    setTimeout(() => setJustCaptured(false), 1000);
  }

  async function toggleSmartCapture() {
    if (smartActive) {
      watcherRef.current?.stop();
      watcherRef.current = null;
      setSmartActive(false);
      return;
    }
    if (!videoRef.current) return;
    setError(null);
    try {
      watcherRef.current = await startSlideWatcher({
        video: videoRef.current,
        onCapture: handleSmartCapture,
        onStatusChange: setSmartStatus,
      });
      setSmartActive(true);
    } catch {
      setError("Couldn't access the camera. Check your browser's permission for this site.");
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

      <div className={smartActive ? "block" : "hidden"}>
        <video ref={videoRef} muted playsInline className="w-full rounded-md border" />
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {justCaptured ? "New slide captured!" : SMART_STATUS_LABEL[smartStatus]}
        </p>
      </div>

      <Button variant="outline" size="sm" className="w-full" onClick={toggleSmartCapture}>
        {smartActive ? <VideoOff className="size-4" /> : <Video className="size-4" />}
        {smartActive ? "Stop smart capture" : "Smart capture (auto-detect slide changes)"}
      </Button>

      {!smartActive && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleBlob(file);
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
        </>
      )}

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
