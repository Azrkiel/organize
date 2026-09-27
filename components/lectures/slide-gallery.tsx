"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ChevronLeft, ChevronRight, Download, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteLecturePhoto, updatePhotoCaption } from "@/app/(app)/actions/lecture-photos";
import { retakeLecturePhoto } from "@/lib/client/lecture-photo-upload";
import { downloadSlidesPdf } from "@/lib/client/slides-pdf";
import type { LecturePhotoWithUrl } from "@/lib/server/lecture-photos";

type Photo = LecturePhotoWithUrl;

/** Slide gallery + lightbox on the lecture page (PLAN.md Phase 12 task 8): captions, retake,
 * delete, and a jsPDF export — nothing here talks to Gemini or OCR again except a retake, which
 * re-extracts slide text for the new image the same way the original upload did. */
export function SlideGallery({
  lectureId,
  userId,
  lectureTitle,
  initialPhotos,
}: {
  lectureId: string;
  userId: string;
  lectureTitle: string;
  initialPhotos: Photo[];
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");
  const [savingCaption, setSavingCaption] = useState(false);
  const [retaking, setRetaking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const retakeInputRef = useRef<HTMLInputElement>(null);
  const retakeTargetRef = useRef<Photo | null>(null);

  if (photos.length === 0) return null;

  const active = lightboxIndex !== null ? photos[lightboxIndex] : null;

  function openLightbox(index: number) {
    setLightboxIndex(index);
    setCaptionDraft(photos[index].caption ?? "");
  }

  function closeLightbox() {
    setLightboxIndex(null);
  }

  function step(delta: number) {
    if (lightboxIndex === null) return;
    const next = (lightboxIndex + delta + photos.length) % photos.length;
    setLightboxIndex(next);
    setCaptionDraft(photos[next].caption ?? "");
  }

  async function handleSaveCaption() {
    if (!active) return;
    setSavingCaption(true);
    const result = await updatePhotoCaption(active.id, captionDraft);
    setSavingCaption(false);
    if (!result.error) {
      setPhotos((prev) => prev.map((p) => (p.id === active.id ? { ...p, caption: captionDraft.trim() || null } : p)));
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    await deleteLecturePhoto(id);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    if (active?.id === id) closeLightbox();
    router.refresh();
  }

  function handleRetakeClick() {
    if (!active) return;
    retakeTargetRef.current = active;
    retakeInputRef.current?.click();
  }

  async function handleRetakeFile(file: File) {
    const target = retakeTargetRef.current;
    if (!target) return;
    setRetaking(true);
    const result = await retakeLecturePhoto({
      userId,
      photoId: target.id,
      oldStoragePath: target.storagePath,
      lectureId,
      file,
    });
    setRetaking(false);
    if (!result.error) router.refresh();
  }

  async function handleExportPdf() {
    setExporting(true);
    try {
      await downloadSlidesPdf(
        lectureTitle,
        photos.filter((p) => p.signedUrl).map((p) => ({ url: p.signedUrl!, caption: p.caption }))
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">Slide photos ({photos.length})</p>
        <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting}>
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Download as PDF
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            onClick={() => openLightbox(index)}
            className="aspect-square overflow-hidden rounded-md border hover:opacity-80"
          >
            {photo.signedUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- a signed Storage URL, not next/image-optimizable
              <img src={photo.signedUrl} alt={photo.caption ?? "Slide photo"} className="size-full object-cover" />
            )}
          </button>
        ))}
      </div>

      <input
        ref={retakeInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleRetakeFile(file);
          e.target.value = "";
        }}
      />

      {active && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 p-4" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {(lightboxIndex ?? 0) + 1} of {photos.length}
            </span>
            <Button variant="ghost" size="icon" aria-label="Close" onClick={closeLightbox}>
              <X className="size-4" />
            </Button>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            {photos.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-0"
                aria-label="Previous photo"
                onClick={() => step(-1)}
              >
                <ChevronLeft className="size-6" />
              </Button>
            )}
            {active.signedUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- a signed Storage URL, not next/image-optimizable
              <img src={active.signedUrl} alt={active.caption ?? "Slide photo"} className="max-h-full max-w-full object-contain" />
            )}
            {photos.length > 1 && (
              <Button variant="ghost" size="icon" className="absolute right-0" aria-label="Next photo" onClick={() => step(1)}>
                <ChevronRight className="size-6" />
              </Button>
            )}
          </div>

          <div className="mx-auto w-full max-w-lg space-y-2">
            <Textarea
              placeholder="Add a caption…"
              value={captionDraft}
              onChange={(e) => setCaptionDraft(e.target.value)}
              onBlur={handleSaveCaption}
              rows={2}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{savingCaption ? "Saving…" : null}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleRetakeClick} disabled={retaking}>
                  {retaking ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                  Retake
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPendingDeleteId(active.id)}>
                  <Trash2 className="size-4" /> Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this slide photo?</AlertDialogTitle>
            <AlertDialogDescription>This removes the photo and its extracted text. It can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
