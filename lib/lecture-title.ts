import { format } from "date-fns";

/** "Chem Lecture, Sep 21" (PLAN.md Phase 9 task 1) — falls back to a bare date when there's no course. */
export function generateLectureTitle(courseName: string | null | undefined, date: Date): string {
  const day = format(date, "MMM d");
  return courseName ? `${courseName} Lecture, ${day}` : `Lecture, ${day}`;
}
