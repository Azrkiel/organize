"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createTask } from "@/app/(app)/actions/tasks";

/**
 * A small floating menu that appears when text is selected in the note editor, offering
 * "Make task": creates a task titled from the selection, linked back to this note and course.
 */
export function MakeTaskMenu({
  editor,
  noteId,
  courseId,
}: {
  editor: Editor;
  noteId: string;
  courseId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [justCreated, setJustCreated] = useState(false);

  function handleMakeTask() {
    const { from, to } = editor.state.selection;
    const title = editor.state.doc.textBetween(from, to, " ").trim().slice(0, 200);
    if (!title) return;

    startTransition(async () => {
      const result = await createTask({ title, courseId, noteId });
      if (!result.error) {
        setJustCreated(true);
        router.refresh();
        setTimeout(() => setJustCreated(false), 1500);
      }
    });
  }

  return (
    <BubbleMenu editor={editor} options={{ placement: "top" }}>
      <div className="flex items-center gap-1 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          disabled={pending}
          onClick={handleMakeTask}
        >
          <ListTodo className="size-3.5" />
          {justCreated ? "Task created" : "Make task"}
        </Button>
      </div>
    </BubbleMenu>
  );
}
