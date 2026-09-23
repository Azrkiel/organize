"use client";

import dynamic from "next/dynamic";
import type { CourseMinutes } from "@/lib/server/focus-sessions";
import type { Course } from "@/lib/types";

// `next/dynamic` with `ssr: false` only works from inside a Client Component boundary — a
// Server Component (app/(app)/page.tsx) can't disable SSR for part of its own tree. Doing it
// here, rather than directly in the page, is what actually keeps Recharts (~90kB) out of the
// home page's initial JS: it becomes a separate chunk fetched only in the browser, after
// hydration, instead of code the server needs to render synchronously on first load.
const WeeklyFocusChart = dynamic(
  () => import("@/components/dashboard/weekly-focus-chart").then((m) => m.WeeklyFocusChart),
  { ssr: false, loading: () => <div className="h-44 w-full animate-pulse rounded-lg bg-muted" /> }
);

export function WeeklyFocusChartLoader({ minutes, courses }: { minutes: CourseMinutes[]; courses: Course[] }) {
  return <WeeklyFocusChart minutes={minutes} courses={courses} />;
}
