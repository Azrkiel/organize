"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateFlashcard } from "@/app/(app)/actions/flashcards";
import type { Course, Flashcard } from "@/lib/types";

/** Edits an existing flashcard's front, back, and course. */
export function CardEditDialog({
  card,
  courses,
  open,
  onOpenChange,
}: {
  card: Flashcard | null;
  courses: Course[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [courseId, setCourseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // A stable reference: Base UI's Select re-syncs this into its own store on every render
  // where the reference changes, so an inline object literal here would churn on every
  // keystroke in the front/back fields.
  const courseItems = useMemo(
    () => ({ __none__: "No course", ...Object.fromEntries(courses.map((c) => [c.id, c.name])) }),
    [courses]
  );

  // This dialog is opened purely by the parent flipping `open` from outside (there's no
  // internal Trigger), and Base UI's `onOpenChange` only fires for its own internally-detected
  // close requests (Escape/backdrop/close button) — never for an externally-driven open. So the
  // prefill has to react to the `open` prop directly, not to onOpenChange.
  useEffect(() => {
    if (open && card) {
      setFront(card.front);
      setBack(card.back);
      setCourseId(card.course_id);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, card?.id]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!card) return;
    startTransition(async () => {
      const result = await updateFlashcard(card.id, { front, back, courseId });
      if (result.error) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit flashcard</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-card-front">Front</Label>
              <Textarea id="edit-card-front" autoFocus value={front} onChange={(e) => setFront(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-card-back">Back</Label>
              <Textarea id="edit-card-back" value={back} onChange={(e) => setBack(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Course</Label>
              <Select
                items={courseItems}
                value={courseId ?? "__none__"}
                onValueChange={(v) => setCourseId(v === "__none__" ? null : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No course</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || !front.trim() || !back.trim()} className="w-full">
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
