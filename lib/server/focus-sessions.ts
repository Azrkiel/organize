import "server-only";
import { endOfWeek, startOfWeek } from "date-fns";
import { createClient } from "@/lib/supabase/server";

export type CourseMinutes = { courseId: string | null; minutes: number };

/**
 * Total focus minutes per course for the current week (Sunday-start, matching
 * `components/calendar/calendar-view.tsx`'s week grid), for the dashboard stats chart
 * (PLAN.md Phase 7 task 6).
 */
export async function getWeeklyMinutesByCourse(now: Date = new Date()): Promise<CourseMinutes[]> {
  const supabase = await createClient();
  const start = startOfWeek(now, { weekStartsOn: 0 });
  const end = endOfWeek(now, { weekStartsOn: 0 });

  const { data } = await supabase
    .from("focus_sessions")
    .select("course_id, minutes")
    .gte("started_at", start.toISOString())
    .lte("started_at", end.toISOString());

  const totals = new Map<string | null, number>();
  for (const row of data ?? []) {
    totals.set(row.course_id, (totals.get(row.course_id) ?? 0) + row.minutes);
  }
  return Array.from(totals, ([courseId, minutes]) => ({ courseId, minutes }));
}
