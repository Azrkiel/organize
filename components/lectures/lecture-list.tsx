"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteLecture } from "@/app/(app)/actions/lectures";
import { deleteLectureAudio } from "@/lib/client/lecture-audio-db";
import { formatDuration } from "@/lib/format-duration";
import type { Lecture } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  recorded: "Recorded",
  transcribing: "Transcribing…",
  transcribed: "Transcribed",
  notes_ready: "Notes ready",
  error: "Error",
};

/** Per-course lecture list — title, date, duration, status (PLAN.md Phase 9 task 6). */
export function LectureList({ lectures }: { lectures: Lecture[] }) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<Lecture | null>(null);

  if (lectures.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No lectures recorded yet.</p>;
  }

  return (
    <>
      <ul className="divide-y">
        {lectures.map((lecture) => (
          <li key={lecture.id} className="group flex h-14 items-center gap-2">
            <Link href={`/lectures/${lecture.id}`} className="flex h-full min-w-0 flex-1 items-center gap-3 px-1 hover:bg-muted/50">
              <span className="min-w-0 flex-1 truncate font-medium">{lecture.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{format(new Date(lecture.recorded_at), "MMM d, yyyy")}</span>
              {lecture.duration_seconds !== null && (
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatDuration(lecture.duration_seconds)}</span>
              )}
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs",
                  lecture.status === "error" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                )}
              >
                {STATUS_LABEL[lecture.status] ?? lecture.status}
              </span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="mr-1 shrink-0 opacity-0 group-hover:opacity-100"
              aria-label="Delete lecture"
              onClick={() => setPendingDelete(lecture)}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{pendingDelete?.title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the lecture record, its transcript, and any audio stored locally on this device. It
              doesn&apos;t delete the generated note, if there is one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!pendingDelete) return;
                const id = pendingDelete.id;
                deleteLectureAudio(id).catch(() => {});
                deleteLecture(id).then(() => router.refresh());
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
