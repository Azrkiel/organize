"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNotebookLmExportPayload } from "@/app/(app)/actions/notebooklm-export";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import { sanitizeFilename } from "@/lib/sanitize-filename";
import type { NotebookLmExportData } from "@/lib/server/notebooklm-export";

/** A folder's path within this course (course name isn't included — the whole ZIP is already
 * scoped to one course), built by walking its parent chain. */
function folderPath(folderId: string, folders: NotebookLmExportData["folders"]): string[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const segments: string[] = [];
  let current = byId.get(folderId);
  while (current) {
    segments.unshift(sanitizeFilename(current.name));
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return segments;
}

/** Appends " (2)", " (3)", ... if `path` was already used, so same-named files never overwrite
 * each other in the ZIP — same approach as the Phase 8 "Export all notes" button. */
function dedupe(path: string, used: Set<string>): string {
  if (!used.has(path)) {
    used.add(path);
    return path;
  }
  const dot = path.lastIndexOf(".");
  const base = dot === -1 ? path : path.slice(0, dot);
  const ext = dot === -1 ? "" : path.slice(dot);
  let n = 2;
  let candidate = `${base} (${n})${ext}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${base} (${n})${ext}`;
  }
  used.add(candidate);
  return candidate;
}

/** "Export for NotebookLM" (PLAN.md Phase 11 task 2) — a ZIP of one Markdown file per note, one
 * per lecture transcript, plus a combined `<Course>-all-notes.md`, all built in the browser
 * (no server time, no paid API — NotebookLM itself has no official API for personal accounts, so
 * this is export-only; the owner uploads the files by hand). */
export function NotebookLmExportButton({ courseId }: { courseId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    setError(null);
    startTransition(async () => {
      try {
        const data = await getNotebookLmExportPayload(courseId);
        if (!data) throw new Error("Course not found");

        // Dynamic import, not top-level: jszip only loads when this actually runs.
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        const usedPaths = new Set<string>();
        const courseSlug = sanitizeFilename(data.courseName);
        const combinedParts: string[] = [];

        for (const note of data.notes) {
          const dir = note.folderId ? folderPath(note.folderId, data.folders) : [];
          const title = sanitizeFilename(note.title, "Untitled");
          const markdown = tiptapToMarkdown(note.content);
          zip.file(dedupe([...dir, `${title}.md`].join("/"), usedPaths), markdown);
          combinedParts.push(`# ${note.title || "Untitled"}\n\n${markdown}`);
        }

        for (const lecture of data.lectures) {
          const transcript = lecture.transcript || lecture.transcriptLive;
          if (!transcript) continue; // nothing to export for a lecture that hasn't been transcribed yet
          const title = sanitizeFilename(lecture.title, "Lecture");
          zip.file(dedupe(`Lecture Transcripts/${title}.md`, usedPaths), `# ${lecture.title}\n\n${transcript}`);
        }

        if (combinedParts.length > 0) {
          zip.file(`${courseSlug}-all-notes.md`, combinedParts.join("\n\n---\n\n"));
        }

        if (Object.keys(zip.files).length === 0) {
          setError("This course has no notes or transcripts to export yet.");
          return;
        }

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${courseSlug}-notebooklm-export.zip`;
        link.click();
        URL.revokeObjectURL(url);
      } catch {
        setError("Could not build the export. Try again.");
      }
    });
  }

  return (
    <div className="space-y-1 text-right">
      <Button variant="outline" size="sm" onClick={handleExport} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        Export for NotebookLM
      </Button>
      <p className="text-xs text-muted-foreground">
        At{" "}
        <a href="https://notebooklm.google.com" target="_blank" rel="noreferrer" className="underline">
          notebooklm.google.com
        </a>
        : create a notebook → Add sources → upload the files from this ZIP.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
