"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  deleteLectureAudio,
  getLectureAudioBytes,
  getRecordingMeta,
  getSegmentChunks,
  getSegmentIndexes,
} from "@/lib/client/lecture-audio-db";
import { concatenateChunks } from "@/lib/client/audio-decode";
import { formatBytes } from "@/lib/format-bytes";

/** The local (IndexedDB) copy of a lecture's audio — download it, or clear it once you're done
 * with it (PLAN.md Phase 9 task 7). Only appears when this device actually has audio for this
 * lecture; a lecture opened on a different device, or one whose audio was already cleared, won't
 * show this at all. */
export function LocalAudioPanel({ lectureId, refreshKey }: { lectureId: string; refreshKey: string }) {
  const [bytes, setBytes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getLectureAudioBytes(lectureId)
      .then((b) => {
        if (!cancelled) setBytes(b);
      })
      .catch(() => {
        if (!cancelled) setBytes(0);
      });
    return () => {
      cancelled = true;
    };
  }, [lectureId, refreshKey]);

  if (!bytes) return null;

  async function handleDownload() {
    setBusy(true);
    try {
      const [meta, segmentIndexes] = await Promise.all([getRecordingMeta(lectureId), getSegmentIndexes(lectureId)]);
      const allChunks = [];
      for (const segmentIndex of segmentIndexes) allChunks.push(...(await getSegmentChunks(lectureId, segmentIndex)));
      const mimeType = meta?.mimeType || "audio/webm";
      const blob = concatenateChunks(allChunks, mimeType);
      const extension = mimeType.includes("mp4") ? "m4a" : "webm";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `lecture-audio.${extension}`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteLectureAudio(lectureId);
      setBytes(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <p className="text-sm font-medium text-muted-foreground">Local audio on this device</p>
      <p className="text-sm text-muted-foreground">{formatBytes(bytes)} stored in this browser.</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={handleDownload}>
          Download audio
        </Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={handleDelete}>
          Delete audio
        </Button>
      </div>
    </div>
  );
}
