"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createNoteFromMarkdown, generateLectureNotes, getLectureNotesPrompt } from "@/app/(app)/actions/lecture-notes";
import { createFlashcard } from "@/app/(app)/actions/flashcards";
import type { FlashcardSuggestion } from "@/lib/flashcard-suggestions";

/** "Generate notes" (real Gemini path) or, with no API key configured, "Copy prompt for Claude" +
 * "Paste notes" (PLAN.md Phase 10 tasks 1, 3, 5, 6). Both paths end at the same place: a created
 * note plus an optional flashcard review dialog. */
export function GenerateNotesPanel({
  lectureId,
  courseId,
  geminiConfigured,
}: {
  lectureId: string;
  courseId: string | null;
  geminiConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [reviewNoteId, setReviewNoteId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<FlashcardSuggestion[]>([]);

  function handleResult(result: { error?: string; rateLimited?: boolean; noteId?: string; suggestions?: FlashcardSuggestion[] }) {
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    if (result.suggestions && result.suggestions.length > 0 && result.noteId) {
      setSuggestions(result.suggestions);
      setReviewNoteId(result.noteId);
    }
  }

  async function handleGenerate() {
    setError(null);
    setPending(true);
    try {
      handleResult(await generateLectureNotes(lectureId));
    } finally {
      setPending(false);
    }
  }

  async function handleCopyPrompt() {
    setError(null);
    const result = await getLectureNotesPrompt(lectureId);
    if (result.error || !result.prompt) {
      setError(result.error ?? "Could not build the prompt.");
      return;
    }
    try {
      await navigator.clipboard.writeText(result.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy — your browser blocked clipboard access.");
    }
  }

  async function handleSavePastedNotes() {
    if (!pasteValue.trim()) return;
    setError(null);
    setPending(true);
    try {
      const result = await createNoteFromMarkdown({ lectureId, markdown: pasteValue });
      handleResult(result);
      if (!result.error) {
        setPasteOpen(false);
        setPasteValue("");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium text-muted-foreground">Notes</p>

      {geminiConfigured ? (
        <Button size="sm" onClick={handleGenerate} disabled={pending}>
          <Sparkles className="size-4" /> {pending ? "Generating…" : "Generate notes"}
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            No Gemini API key is set, so notes aren&apos;t generated automatically — copy the prompt into a Claude
            chat (or any AI), then paste the reply back in.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyPrompt}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy prompt for Claude"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPasteOpen(true)}>
              Paste notes
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Paste notes</DialogTitle>
            <DialogDescription>
              Paste the Markdown reply from Claude (or another AI) here. If it includes the flashcard suggestions
              block, those get offered below after saving.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            className="min-h-64 font-mono text-xs"
            placeholder="## Summary&#10;..."
          />
          <DialogFooter>
            <Button onClick={handleSavePastedNotes} disabled={pending || !pasteValue.trim()} className="w-full">
              {pending ? "Saving…" : "Save notes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FlashcardReviewDialog
        open={reviewNoteId !== null}
        onOpenChange={(open) => !open && setReviewNoteId(null)}
        suggestions={suggestions}
        courseId={courseId}
        noteId={reviewNoteId}
      />
    </div>
  );
}

/** Lets the owner tick which of the 5 suggested flashcards to actually keep (PLAN.md Phase 10 task 4). */
function FlashcardReviewDialog({
  open,
  onOpenChange,
  suggestions,
  courseId,
  noteId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: FlashcardSuggestion[];
  courseId: string | null;
  noteId: string | null;
}) {
  const [checked, setChecked] = useState<boolean[]>([]);
  const [saving, setSaving] = useState(false);

  // Resets to all-checked each time a fresh set of suggestions opens — same "react to the `open`
  // prop directly" pattern as NameDialog, since this dialog has no internal trigger either.
  useEffect(() => {
    if (open) setChecked(suggestions.map(() => true));
  }, [open, suggestions]);

  async function handleSave() {
    if (!noteId) return;
    setSaving(true);
    try {
      const picked = suggestions.filter((_, i) => checked[i]);
      await Promise.all(picked.map((s) => createFlashcard({ front: s.front, back: s.back, courseId, noteId })));
    } finally {
      setSaving(false);
      onOpenChange(false);
    }
  }

  const pickedCount = checked.filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save suggested flashcards?</DialogTitle>
          <DialogDescription>Generated from this lecture&apos;s notes. Untick any you don&apos;t want.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-3 overflow-y-auto">
          {suggestions.map((s, i) => (
            <label key={i} className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={checked[i] ?? true}
                onCheckedChange={(c) => setChecked((prev) => prev.map((v, idx) => (idx === i ? c === true : v)))}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">{s.front}</span>
                <br />
                <span className="text-muted-foreground">{s.back}</span>
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving || pickedCount === 0} className="w-full">
            {saving ? "Saving…" : `Save ${pickedCount} flashcard${pickedCount === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
