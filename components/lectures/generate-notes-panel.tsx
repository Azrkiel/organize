"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
 * note plus an optional flashcard review dialog.
 *
 * This component stays mounted and renders its own "already has a note" branch internally
 * (`noteId`), rather than the parent swapping it out for a separate link component once
 * `lecture.note_id` is set. It used to be the latter — but `handleResult` calls `router.refresh()`
 * right as it opens the flashcard review dialog, and that refresh delivers the new `note_id` to
 * the parent fast enough to unmount this component (dialog state and all) before the dialog ever
 * got to show. Confirmed live: the note saved correctly every time, but the review dialog never
 * appeared. Keeping one stable component whether or not a note exists yet means the parent's
 * refresh just updates a prop, not this component's identity. */
export function GenerateNotesPanel({
  lectureId,
  courseId,
  geminiConfigured,
  initialNoteId,
}: {
  lectureId: string;
  courseId: string | null;
  geminiConfigured: boolean;
  initialNoteId: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [reviewNoteId, setReviewNoteId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<FlashcardSuggestion[]>([]);
  const [createdNoteId, setCreatedNoteId] = useState<string | null>(null);
  const noteId = createdNoteId ?? initialNoteId;

  type NoteResult = { error?: string; rateLimited?: boolean; noteId?: string; suggestions?: FlashcardSuggestion[] };

  /** Opening the review dialog is deferred to the next tick rather than done in the same render
   * as closing another dialog (the Paste dialog, on the paste-notes path). Confirmed live: with
   * both happening in one render, the note always saved correctly, but the review dialog's own
   * `open` state silently never took — Base UI's dialog handling doesn't cleanly support one
   * dialog opening in the exact instant a sibling one closes. A tick's delay sidesteps it
   * entirely and isn't perceptible. */
  function handleResult(result: NoteResult): boolean {
    if (result.error) {
      setError(result.error);
      return false;
    }
    if (result.noteId) setCreatedNoteId(result.noteId);
    router.refresh();
    if (result.suggestions && result.suggestions.length > 0 && result.noteId) {
      const { suggestions: picked, noteId: id } = result;
      setTimeout(() => {
        setSuggestions(picked);
        setReviewNoteId(id);
      }, 0);
    }
    return true;
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

      {noteId ? (
        <Link href={`/notes/${noteId}`} className="text-sm font-medium hover:underline">
          View generated note →
        </Link>
      ) : geminiConfigured ? (
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
