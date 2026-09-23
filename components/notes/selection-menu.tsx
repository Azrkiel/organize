"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { Layers, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createTask } from "@/app/(app)/actions/tasks";
import { createFlashcard } from "@/app/(app)/actions/flashcards";

/**
 * The floating menu that appears when text is selected in the note editor: "Make task"
 * (creates one directly, titled from the selection) and "Make flashcard" (opens a small
 * dialog with the front prefilled). Both live in one BubbleMenu — two separate ones would
 * render two overlapping floating toolbars at the same selection.
 */
export function SelectionMenu({
  editor,
  noteId,
  courseId,
}: {
  editor: Editor;
  noteId: string;
  courseId: string | null;
}) {
  const router = useRouter();
  const [taskPending, startTaskTransition] = useTransition();
  const [justCreatedTask, setJustCreatedTask] = useState(false);

  const [cardOpen, setCardOpen] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardPending, startCardTransition] = useTransition();

  function selectedText(): string {
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, " ").trim();
  }

  function handleMakeTask() {
    const title = selectedText().slice(0, 200);
    if (!title) return;

    startTaskTransition(async () => {
      const result = await createTask({ title, courseId, noteId });
      if (!result.error) {
        setJustCreatedTask(true);
        router.refresh();
        setTimeout(() => setJustCreatedTask(false), 1500);
      }
    });
  }

  function handleOpenFlashcard() {
    const selected = selectedText().slice(0, 2000);
    if (!selected) return;
    setFront(selected);
    setBack("");
    setCardError(null);
    setCardOpen(true);
  }

  function handleSubmitFlashcard(e: React.FormEvent) {
    e.preventDefault();
    startCardTransition(async () => {
      const result = await createFlashcard({ front, back, courseId, noteId });
      if (result.error) {
        setCardError(result.error);
        return;
      }
      setCardOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <BubbleMenu editor={editor} options={{ placement: "top" }}>
        <div className="flex items-center gap-1 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            disabled={taskPending}
            onClick={handleMakeTask}
          >
            <ListTodo className="size-3.5" />
            {justCreatedTask ? "Task created" : "Make task"}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={handleOpenFlashcard}>
            <Layers className="size-3.5" />
            Make flashcard
          </Button>
        </div>
      </BubbleMenu>

      <Dialog open={cardOpen} onOpenChange={setCardOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmitFlashcard}>
            <DialogHeader>
              <DialogTitle>New flashcard</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="flashcard-front">Front</Label>
                <Textarea id="flashcard-front" autoFocus value={front} onChange={(e) => setFront(e.target.value)} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="flashcard-back">Back</Label>
                <Textarea
                  id="flashcard-back"
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                  rows={3}
                  placeholder="Answer…"
                />
              </div>
              {cardError && <p className="text-sm text-destructive">{cardError}</p>}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={cardPending || !front.trim() || !back.trim()} className="w-full">
                {cardPending ? "Saving…" : "Create flashcard"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
