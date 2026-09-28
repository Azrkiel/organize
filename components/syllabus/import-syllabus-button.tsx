"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { createSyllabus } from "@/app/(app)/actions/syllabus";

const MAX_PDF_BYTES = 20 * 1024 * 1024;

/** "Import syllabus" (PLAN.md Phase 13 task 1): a PDF (text extracted in the browser, original
 * kept in the attachments bucket) or pasted text. Saves it, then opens the review screen. */
export function ImportSyllabusButton({ courseId, userId }: { courseId: string; userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"pdf" | "text">("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = status !== null;
  const canSubmit = mode === "pdf" ? file !== null : text.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      let rawText = text;
      let uploaded: { storagePath: string; fileName: string; sizeBytes: number } | null = null;

      if (mode === "pdf" && file) {
        if (file.size > MAX_PDF_BYTES) throw new Error("That PDF is over the 20 MB limit.");
        setStatus("Reading PDF…");
        const { extractPdfText } = await import("@/lib/client/pdf-text");
        rawText = await extractPdfText(file);
        if (rawText.trim().length < 20) {
          throw new Error("This PDF has no selectable text (it may be a scan). Paste the syllabus text instead.");
        }

        setStatus("Uploading…");
        const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-150);
        const storagePath = `${userId}/syllabi/${courseId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await createClient()
          .storage.from("attachments")
          .upload(storagePath, file, { contentType: "application/pdf", upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        uploaded = { storagePath, fileName: file.name, sizeBytes: file.size };
      }

      setStatus("Saving…");
      const result = await createSyllabus({ courseId, rawText, file: uploaded });
      if (result.error || !result.id) throw new Error(result.error ?? "Could not save the syllabus.");
      router.push(`/courses/${courseId}/syllabus/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import the syllabus.");
      setStatus(null);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileText className="size-4" /> Import syllabus
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Import syllabus</DialogTitle>
              <DialogDescription>
                You&apos;ll review the schedule and assessments before anything is added to your calendar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="flex gap-1">
                {(["pdf", "text"] as const).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={mode === m ? "secondary" : "ghost"}
                    onClick={() => setMode(m)}
                  >
                    {m === "pdf" ? "PDF" : "Paste text"}
                  </Button>
                ))}
              </div>
              {mode === "pdf" ? (
                <Input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  aria-label="Syllabus PDF"
                />
              ) : (
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="min-h-56 text-sm"
                  placeholder="Paste the syllabus here…"
                  aria-label="Syllabus text"
                />
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy || !canSubmit} className="w-full">
                {status ?? "Continue"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
