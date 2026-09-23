"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getExportPayload } from "@/app/(app)/actions/export";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import { sanitizeFilename } from "@/lib/sanitize-filename";
import type { ExportData } from "@/lib/server/export";

/** A folder's full path (course name first), built by walking its parent chain. */
function folderPath(folderId: string, folders: ExportData["folders"], courses: ExportData["courses"]): string[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const segments: string[] = [];
  let current = byId.get(folderId);
  while (current) {
    segments.unshift(sanitizeFilename(current.name));
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  const course = folders.find((f) => f.id === folderId);
  const courseName = course && courses.find((c) => c.id === course.courseId)?.name;
  if (courseName) segments.unshift(sanitizeFilename(courseName));
  return segments;
}

/** Appends " (2)", " (3)", ... if `path` was already used, so same-named notes never overwrite each other. */
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

export function ExportButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    setError(null);
    startTransition(async () => {
      try {
        // Dynamic import, not a top-level one: jszip only loads when this actually runs, instead
        // of bloating the settings page's initial bundle for an action used maybe once a month.
        const { default: JSZip } = await import("jszip");
        const data = await getExportPayload();
        const zip = new JSZip();
        const usedPaths = new Set<string>();
        const attachmentsByNote = new Map<string, ExportData["attachments"]>();
        for (const a of data.attachments) {
          const list = attachmentsByNote.get(a.noteId);
          if (list) list.push(a);
          else attachmentsByNote.set(a.noteId, [a]);
        }

        for (const note of data.notes) {
          const dir = note.folderId
            ? folderPath(note.folderId, data.folders, data.courses)
            : note.courseId
              ? [sanitizeFilename(data.courses.find((c) => c.id === note.courseId)?.name ?? "")]
              : ["Unfiled"];

          const title = sanitizeFilename(note.title, "Untitled");
          const mdPath = dedupe([...dir, `${title}.md`].join("/"), usedPaths);
          let markdown = tiptapToMarkdown(note.content);

          const noteAttachments = attachmentsByNote.get(note.id) ?? [];
          if (noteAttachments.length > 0) {
            markdown += `\n\n---\n\nAttachments: ${noteAttachments.map((a) => `[${a.fileName}](./${title}/${a.fileName})`).join(", ")}`;
            for (const a of noteAttachments) {
              if (!a.signedUrl) continue;
              try {
                const blob = await fetch(a.signedUrl).then((r) => r.blob());
                zip.file(dedupe([...dir, title, a.fileName].join("/"), usedPaths), blob);
              } catch {
                // One failed attachment fetch shouldn't fail the whole export.
              }
            }
          }

          zip.file(mdPath, markdown);
        }

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `organize-export-${new Date().toISOString().slice(0, 10)}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        setError("Could not build the export. Try again.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={handleExport} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        Export all notes
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
