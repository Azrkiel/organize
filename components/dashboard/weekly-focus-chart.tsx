"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Course } from "@/lib/types";
import type { CourseMinutes } from "@/lib/server/focus-sessions";

const NO_COURSE_COLOR = "var(--muted-foreground)";

/**
 * Minutes focused per course this week. Each bar takes its color straight from that course's
 * own accent (the identity it already carries everywhere else in the app — sidebar, tasks,
 * calendar), and the course name is a direct axis label, so no separate legend is needed for
 * a single series (PLAN.md Phase 7 task 6).
 */
export function WeeklyFocusChart({ minutes, courses }: { minutes: CourseMinutes[]; courses: Course[] }) {
  if (minutes.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No focus sessions yet this week.</p>;
  }

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const data = minutes
    .map((m) => ({
      key: m.courseId ?? "__none__",
      name: m.courseId ? (courseById.get(m.courseId)?.name ?? "Unknown course") : "No course",
      color: m.courseId ? (courseById.get(m.courseId)?.color ?? NO_COURSE_COLOR) : NO_COURSE_COLOR,
      minutes: m.minutes,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            interval={0}
          />
          <YAxis hide domain={[0, (max: number) => Math.max(max * 1.2, 1)]} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--popover-foreground)",
            }}
            formatter={(value) => [`${value} min`, "Focus time"]}
            labelStyle={{ color: "var(--popover-foreground)" }}
          />
          <Bar dataKey="minutes" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.color} />
            ))}
            <LabelList dataKey="minutes" position="top" style={{ fill: "var(--foreground)", fontSize: 12 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
