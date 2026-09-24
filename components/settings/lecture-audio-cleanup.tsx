"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getTranscribedLectureIds } from "@/app/(app)/actions/lectures";
import { deleteLectureAudio, getAllLectureIdsWithAudio, getTotalAudioBytes } from "@/lib/client/lecture-audio-db";
import { formatBytes } from "@/lib/format-bytes";

/** How much lecture audio is sitting in this browser's IndexedDB, and a way to clear the audio
 * for lectures that already have a saved transcript (PLAN.md Phase 9 task 7). This is local
 * (per-device, per-browser) storage — not the Supabase Storage readout above it. */
export function LectureAudioCleanup() {
  const [bytes, setBytes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setBytes(await getTotalAudioBytes());
  }

  useEffect(() => {
    refresh().catch(() => setBytes(0));
  }, []);

  async function handleDeleteTranscribed() {
    setBusy(true);
    setMessage(null);
    try {
      const idsWithAudio = await getAllLectureIdsWithAudio();
      const transcribedIds = idsWithAudio.length > 0 ? await getTranscribedLectureIds(idsWithAudio) : [];
      if (transcribedIds.length === 0) {
        setMessage("No transcribed lectures have local audio left to clear.");
        return;
      }
      for (const id of transcribedIds) await deleteLectureAudio(id);
      await refresh();
      setMessage(`Cleared audio for ${transcribedIds.length} transcribed lecture${transcribedIds.length === 1 ? "" : "s"}.`);
    } finally {
      setBusy(false);
    }
  }

  if (bytes === null) return null;

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <h2 className="text-sm font-medium">Lecture audio (this device)</h2>
      <p className="text-sm text-muted-foreground">{formatBytes(bytes)} stored locally, waiting to be transcribed.</p>
      <Button variant="outline" size="sm" disabled={busy || bytes === 0} onClick={handleDeleteTranscribed}>
        Delete all transcribed audio
      </Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
