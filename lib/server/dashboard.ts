import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getTasks } from "@/lib/server/tasks";
import { isDueTodayOrOverdue } from "@/lib/task-buckets";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import type { Course, Event, Note, TaskWithSync } from "@/lib/types";

export type DashboardData = {
  /** Current hour (0-23) in the owner's settings time zone, for the greeting. */
  greetingHour: number;
  upcomingExams: Event[];
  todayTasks: TaskWithSync[];
  upcomingEvents: Event[];
  recentNotes: Note[];
  courses: Course[];
};

const EMPTY: DashboardData = {
  greetingHour: new Date().getHours(),
  upcomingExams: [],
  todayTasks: [],
  upcomingEvents: [],
  recentNotes: [],
  courses: [],
};

/** Everything the home dashboard needs, in one round trip per widget (PLAN.md Phase 6 task 1). */
export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return EMPTY;

  const nowIso = new Date().toISOString();

  const [tasks, { data: exams }, { data: events }, { data: notes }, { data: courses }, { data: settings }] =
    await Promise.all([
      getTasks(),
      supabase.from("events").select("*").eq("kind", "exam").gte("starts_at", nowIso).order("starts_at").limit(3),
      // Exams get their own widget above, so leave them out here to avoid showing the same thing twice.
      supabase.from("events").select("*").neq("kind", "exam").gte("starts_at", nowIso).order("starts_at").limit(5),
      supabase.from("notes").select("*").order("updated_at", { ascending: false }).limit(6),
      supabase.from("courses").select("*").eq("archived", false).order("position"),
      supabase.from("settings").select("timezone").maybeSingle(),
    ]);

  return {
    greetingHour: getHourInTimeZone(settings?.timezone ?? DEFAULT_TIMEZONE),
    upcomingExams: exams ?? [],
    todayTasks: tasks.filter((t) => !t.done && isDueTodayOrOverdue(t.due_at)),
    upcomingEvents: events ?? [],
    recentNotes: notes ?? [],
    courses: courses ?? [],
  };
}

function getHourInTimeZone(timeZone: string, now: Date = new Date()): number {
  try {
    const hourStr = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).format(now);
    return parseInt(hourStr, 10) % 24; // Intl can print "24" for midnight in this format
  } catch {
    return now.getHours();
  }
}
