"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Check, Copy, Pencil, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NameDialog } from "@/components/sidebar/name-dialog";
import { TranscribeButton } from "@/components/lectures/transcribe-button";
import { LocalAudioPanel } from "@/components/lectures/local-audio-panel";
import { renameLecture, saveImportedTranscript } from "@/app/(app)/actions/lectures";
import { parseTranscriptFile } from "@/lib/transcript-import";
import { formatDuration } from "@/lib/format-duration";
import type { WhisperModelSize } from "@/lib/client/whisper-transcription";
import type { Lecture } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  recorded: "Recorded",
  transcribing: "Transcribing…",
  transcribed: "Transcribed",
  notes_ready: "Notes ready",
  error: "Error",
};

const SOURCE_LABEL: Record<string, string> = {
  live: "Live transcript (rough — Web Speech API)",
  whisper: "Accurate transcript (Whisper)",
  import: "Imported transcript",
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Wraps case-insensitive matches of `query` in <mark>, otherwise returns the plain text. */
function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/60">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function LectureDetail({
  lecture,
  course,
  defaultModelSize,
}: {
  lecture: Lecture;
  course: { id: string; name: string; color: string } | null;
  defaultModelSize: WhisperModelSize;
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const transcriptText = lecture.transcript || lecture.transcript_live || "";
  const sourceLabel = lecture.transcript
    ? SOURCE_LABEL[lecture.transcript_source ?? "import"]
    : lecture.transcript_live
      ? SOURCE_LABEL.live
      : null;

  const filteredText = useMemo(() => {
    if (!query.trim()) return transcriptText;
    // Show only the paragraphs/lines that match, so searching a long lecture is actually useful.
    const lines = transcriptText.split("\n");
    const matches = lines.filter((line) => line.toLowerCase().includes(query.toLowerCase()));
    return matches.length > 0 ? matches.join("\n") : "";
  }, [transcriptText, query]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(transcriptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setImportError("Couldn't copy — your browser blocked clipboard access.");
    }
  }

  async function handleImportFile(file: File) {
    setImportError(null);
    setImporting(true);
    try {
      const raw = await file.text();
      const text = parseTranscriptFile(file.name, raw);
      if (!text) {
        setImportError("That file doesn't look like a .txt, .srt, or .vtt transcript.");
        return;
      }
      const result = await saveImportedTranscript({ id: lecture.id, transcript: text });
      if (result.error) setImportError(result.error);
      else router.refresh();
    } catch {
      setImportError("Couldn't read that file.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{lecture.title}</h1>
          <Button variant="ghost" size="icon" aria-label="Rename lecture" onClick={() => setRenameOpen(true)}>
            <Pencil className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {course && (
            <Link href={`/courses/${course.id}`} className="flex items-center gap-1.5 hover:underline">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: course.color }} />
              {course.name}
            </Link>
          )}
          <span>{format(new Date(lecture.recorded_at), "MMM d, yyyy")}</span>
          {lecture.duration_seconds !== null && <span className="font-mono">{formatDuration(lecture.duration_seconds)}</span>}
          <span>{STATUS_LABEL[lecture.status] ?? lecture.status}</span>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">Transcript{sourceLabel ? ` — ${sourceLabel}` : ""}</p>
          {transcriptText && (
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy transcript"}
            </Button>
          )}
        </div>

        {transcriptText ? (
          <>
            <Input placeholder="Search this transcript…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="max-h-96 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap">
              {filteredText ? highlight(filteredText, query) : <span className="text-muted-foreground">No matches.</span>}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No transcript yet. Import one below, or run the accurate transcription from this device.
          </p>
        )}
      </div>

      <TranscribeButton
        lectureId={lecture.id}
        previousStatus={lecture.status}
        durationSeconds={lecture.duration_seconds}
        defaultModelSize={defaultModelSize}
      />

      <LocalAudioPanel lectureId={lecture.id} refreshKey={lecture.updated_at} />

      <div className="space-y-2 rounded-lg border p-4">
        <p className="text-sm font-medium text-muted-foreground">Import a transcript</p>
        <p className="text-xs text-muted-foreground">
          From whisper.cpp or another tool — .txt, .srt, or .vtt. This replaces the transcript above.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.srt,.vtt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
          }}
        />
        <Button variant="outline" size="sm" disabled={importing} onClick={() => fileInputRef.current?.click()}>
          <Upload className="size-4" /> {importing ? "Importing…" : "Choose file"}
        </Button>
        {importError && <p className="text-sm text-destructive">{importError}</p>}
      </div>

      <NameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename lecture"
        initialValue={lecture.title}
        submitLabel="Rename"
        onSubmit={async (name) => {
          const result = await renameLecture({ id: lecture.id, title: name });
          if (!result.error) router.refresh();
          return result;
        }}
      />
    </div>
  );
}
