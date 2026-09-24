"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setLectureStatus, saveWhisperTranscript } from "@/app/(app)/actions/lectures";
import { transcribeLecture, type WhisperModelSize, type WhisperProgress } from "@/lib/client/whisper-transcription";
import { formatDuration } from "@/lib/format-duration";

const MODEL_LABEL: Record<WhisperModelSize, string> = {
  tiny: "Tiny — fastest, least accurate",
  base: "Base — balanced",
  small: "Small — most accurate, slowest",
};

/** "Transcribe accurately" — runs Whisper in a Web Worker over every stored audio segment for
 * this lecture, entirely on-device (PLAN.md Phase 9 task 4). */
export function TranscribeButton({
  lectureId,
  previousStatus,
  durationSeconds,
  defaultModelSize,
}: {
  lectureId: string;
  previousStatus: string;
  durationSeconds: number | null;
  defaultModelSize: WhisperModelSize;
}) {
  const router = useRouter();
  const [modelSize, setModelSize] = useState<WhisperModelSize>(defaultModelSize);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<WhisperProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function handleStart() {
    setError(null);
    setRunning(true);
    setProgress(null);
    const controller = new AbortController();
    abortRef.current = controller;

    await setLectureStatus({ id: lectureId, status: "transcribing" });

    try {
      const text = await transcribeLecture({
        lectureId,
        modelSize,
        totalDurationSeconds: durationSeconds,
        onProgress: setProgress,
        signal: controller.signal,
      });
      const result = await saveWhisperTranscript({ id: lectureId, transcript: text });
      if (result.error) setError(result.error);
      router.refresh();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        await setLectureStatus({ id: lectureId, status: previousStatus });
      } else {
        setError(err instanceof Error ? err.message : "Transcription failed.");
        await setLectureStatus({ id: lectureId, status: "error" });
      }
      router.refresh();
    } finally {
      setRunning(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  const modelItems = { tiny: MODEL_LABEL.tiny, base: MODEL_LABEL.base, small: MODEL_LABEL.small };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium text-muted-foreground">Accurate transcript (on-device)</p>

      {running ? (
        <div className="space-y-2">
          {progress?.phase === "loading-model" ? (
            <>
              <p className="text-sm">Downloading the {modelSize} model (once — it&apos;s cached after this)…</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress.total ? Math.round((progress.loaded / progress.total) * 100) : 0}%` }}
                />
              </div>
            </>
          ) : progress?.phase === "transcribing" ? (
            <>
              <p className="text-sm">
                Transcribing segment {progress.segmentIndex + 1} of {progress.totalSegments}
                {progress.secondsTotal
                  ? ` (${formatDuration(progress.secondsDone)} of ${formatDuration(progress.secondsTotal)})`
                  : ""}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.round(((progress.segmentIndex + 1) / progress.totalSegments) * 100)}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Starting…</p>
          )}
          <Button variant="outline" size="sm" onClick={handleCancel}>
            <X className="size-4" /> Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Select items={modelItems} value={modelSize} onValueChange={(v) => v && setModelSize(v as WhisperModelSize)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tiny">{MODEL_LABEL.tiny}</SelectItem>
              <SelectItem value="base">{MODEL_LABEL.base}</SelectItem>
              <SelectItem value="small">{MODEL_LABEL.small}</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleStart}>
            <Sparkles className="size-4" /> Transcribe accurately
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Runs on this device — nothing is uploaded. The model downloads once and is cached by the browser after that.
      </p>
    </div>
  );
}
