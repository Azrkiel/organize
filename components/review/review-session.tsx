"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { gradeFlashcard } from "@/app/(app)/actions/flashcards";
import type { Grade } from "@/lib/sm2";
import type { Course, Flashcard } from "@/lib/types";

const GRADE_KEYS: { key: string; grade: Grade; label: string }[] = [
  { key: "1", grade: "again", label: "Again" },
  { key: "2", grade: "hard", label: "Hard" },
  { key: "3", grade: "good", label: "Good" },
  { key: "4", grade: "easy", label: "Easy" },
];

/**
 * Shows due cards one at a time. Space flips the card, keys 1-4 grade it (Again/Hard/Good/
 * Easy). Grading is fire-and-forget against the server — the session advances locally so
 * reviewing stays fast, and a card removed here won't reappear until its next due date
 * (PLAN.md Phase 7 task 3).
 */
export function ReviewSession({
  cards,
  courses,
  activeCourseId,
}: {
  cards: Flashcard[];
  courses: Course[];
  activeCourseId: string | null;
}) {
  const router = useRouter();
  const [queue, setQueue] = useState(cards);
  const [flipped, setFlipped] = useState(false);
  const [grading, setGrading] = useState(false);

  // The page's own cards prop only refreshes on navigation; resync the local queue whenever
  // the server hands us a new due list (e.g. switching the course filter).
  useEffect(() => {
    setQueue(cards);
    setFlipped(false);
  }, [cards]);

  const current = queue[0];

  function handleGrade(grade: Grade) {
    if (!current || !flipped || grading) return;
    setGrading(true);
    const cardId = current.id;
    gradeFlashcard(cardId, grade).finally(() => setGrading(false));
    setQueue((prev) => prev.slice(1));
    setFlipped(false);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!current) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
        return;
      }
      if (!flipped) return;
      const match = GRADE_KEYS.find((g) => g.key === e.key);
      if (match) handleGrade(match.grade);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, flipped, grading]);

  const courseName = useMemo(
    () => courses.find((c) => c.id === activeCourseId)?.name,
    [courses, activeCourseId]
  );

  function handleCourseChange(value: string | null) {
    router.push(!value || value === "__all__" ? "/review" : `/review?course=${value}`);
  }

  return (
    <div className="space-y-4">
      <Select value={activeCourseId ?? "__all__"} onValueChange={handleCourseChange}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="All courses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All courses</SelectItem>
          {courses.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!current ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border py-16 text-center">
          <CheckCircle2 className="size-8 text-emerald-500" />
          <p className="text-lg font-medium">All done</p>
          <p className="text-sm text-muted-foreground">
            {courseName ? `No cards due for ${courseName} right now.` : "No cards due right now."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{queue.length} card{queue.length === 1 ? "" : "s"} left</p>
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="flex min-h-64 w-full flex-col items-center justify-center gap-4 rounded-lg border bg-card p-8 text-center"
          >
            <p className="text-lg font-medium whitespace-pre-wrap">{current.front}</p>
            {flipped && (
              <>
                <div className="h-px w-16 bg-border" />
                <p className="whitespace-pre-wrap text-muted-foreground">{current.back}</p>
              </>
            )}
            {!flipped && <p className="text-xs text-muted-foreground">Click or press Space to flip</p>}
          </button>

          {flipped && (
            <div className="grid grid-cols-4 gap-2">
              {GRADE_KEYS.map(({ key, grade, label }) => (
                <Button key={grade} type="button" variant="outline" disabled={grading} onClick={() => handleGrade(grade)}>
                  <span className="text-xs text-muted-foreground">{key}</span>&nbsp;{label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
