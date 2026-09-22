"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Flag, StickyNote, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { deleteTask, setTaskDone } from "@/app/(app)/actions/tasks";
import { isOverdue } from "@/lib/task-buckets";
import type { Course, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIORITY_COLOR: Record<number, string> = {
  1: "text-muted-foreground",
  2: "text-amber-500",
  3: "text-destructive",
};

export function TaskItem({ task, course }: { task: Task; course: Course | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const overdue = !task.done && isOverdue(task.due_at);

  function toggleDone(checked: boolean) {
    startTransition(async () => {
      await setTaskDone(task.id, checked);
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteTask(task.id);
      router.refresh();
    });
  }

  return (
    <li className="group flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
      <Checkbox
        checked={task.done}
        disabled={pending}
        onCheckedChange={toggleDone}
        className="mt-0.5"
        aria-label={task.done ? "Mark not done" : "Mark done"}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm", task.done && "text-muted-foreground line-through")}>
          {task.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {task.due_at && (
            <span className={cn(overdue && "font-medium text-destructive")}>
              {format(new Date(task.due_at), "EEE MMM d, h:mm a")}
            </span>
          )}
          {course && (
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full" style={{ backgroundColor: course.color }} />
              {course.name}
            </span>
          )}
          {task.priority > 0 && (
            <Flag className={cn("size-3", PRIORITY_COLOR[task.priority])} />
          )}
          {task.note_id && (
            <Link href={`/notes/${task.note_id}`} className="flex items-center gap-1 hover:text-foreground">
              <StickyNote className="size-3" /> Note
            </Link>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
        aria-label={`Delete ${task.title}`}
        onClick={handleDelete}
        disabled={pending}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  );
}
