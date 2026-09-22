"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { File as FileIcon, Image as ImageIcon, Loader2, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteAttachment } from "@/app/(app)/actions/attachments";
import { AttachmentTooLargeError, MAX_ATTACHMENT_BYTES, uploadAttachment } from "@/lib/attachments-client";
import { formatBytes } from "@/lib/format-bytes";
import { cn } from "@/lib/utils";

export type AttachmentWithUrl = {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  signedUrl: string | null;
};

export function AttachmentsPanel({
  noteId,
  userId,
  attachments,
}: {
  noteId: string;
  userId: string;
  attachments: AttachmentWithUrl[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | File[]) {
    setError(null);
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading(true);
    for (const file of list) {
      try {
        await uploadAttachment(noteId, userId, file);
      } catch (e) {
        setError(e instanceof AttachmentTooLargeError ? `${file.name}: over the 20 MB limit.` : `${file.name}: upload failed.`);
      }
    }
    setUploading(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    const result = await deleteAttachment(id);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed py-6 text-center text-sm text-muted-foreground transition",
          dragOver && "border-primary bg-muted/50"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        {uploading ? <Loader2 className="size-5 animate-spin" /> : <Paperclip className="size-5" />}
        <p>
          Drag files here, or{" "}
          <button type="button" className="underline underline-offset-2" onClick={() => inputRef.current?.click()}>
            browse
          </button>
        </p>
        <p className="text-xs">Up to {formatBytes(MAX_ATTACHMENT_BYTES)} per file.</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {attachments.length > 0 && (
        <ul className="space-y-1">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              {a.mime_type?.startsWith("image/") ? (
                <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileIcon className="size-4 shrink-0 text-muted-foreground" />
              )}
              {a.signedUrl ? (
                <a
                  href={a.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  {a.file_name}
                </a>
              ) : (
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{a.file_name}</span>
              )}
              <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(a.size_bytes ?? 0)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${a.file_name}`}
                onClick={() => handleDelete(a.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
