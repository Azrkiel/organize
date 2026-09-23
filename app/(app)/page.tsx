import Link from "next/link";
import { format } from "date-fns";
import { CalendarClock, GraduationCap, Layers } from "lucide-react";
import { NotesList } from "@/components/notes-list";
import { TaskItem } from "@/components/tasks/task-item";
import { WeeklyFocusChartLoader } from "@/components/dashboard/weekly-focus-chart-loader";
import { getDashboardData } from "@/lib/server/dashboard";
import { getGreeting } from "@/lib/greeting";
import { daysUntil, formatCountdown } from "@/lib/countdown";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const [data, supabase] = await Promise.all([getDashboardData(), createClient()]);
  const { data: auth } = await supabase.auth.getUser();
  const courseById = new Map(data.courses.map((c) => [c.id, c]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {getGreeting(data.greetingHour)}
          {auth.user?.email ? `, ${auth.user.email.split("@")[0]}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d")}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="space-y-2 rounded-lg border p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <GraduationCap className="size-4" /> Upcoming exams
          </h2>
          {data.upcomingExams.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No exams scheduled.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.upcomingExams.map((exam) => {
                const course = exam.course_id ? courseById.get(exam.course_id) : undefined;
                return (
                  <li key={exam.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5 truncate font-medium">
                      {course && (
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: course.color }}
                        />
                      )}
                      {exam.title}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatCountdown(daysUntil(new Date(exam.starts_at)))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-2 rounded-lg border p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <CalendarClock className="size-4" /> Next up
          </h2>
          {data.upcomingEvents.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nothing on the calendar.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.upcomingEvents.map((event) => {
                const course = event.course_id ? courseById.get(event.course_id) : undefined;
                return (
                  <li key={event.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5 truncate font-medium">
                      {course && (
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: course.color }}
                        />
                      )}
                      {event.title}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {event.all_day ? format(new Date(event.starts_at), "MMM d") : format(new Date(event.starts_at), "MMM d, h:mm a")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/calendar" className="block pt-1 text-xs text-muted-foreground hover:text-foreground">
            View calendar →
          </Link>
        </section>
      </div>

      {data.flashcardsDue > 0 && (
        <Link
          href="/review"
          className="flex items-center gap-2 rounded-lg border p-4 text-sm hover:bg-muted/50"
        >
          <Layers className="size-4 text-muted-foreground" />
          <span className="font-medium">
            {data.flashcardsDue} flashcard{data.flashcardsDue === 1 ? "" : "s"} due
          </span>
          <span className="ml-auto text-xs text-muted-foreground">Review →</span>
        </Link>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Today&apos;s tasks</h2>
        {data.todayTasks.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nothing due today. Nice.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {data.todayTasks.map((task) => (
              <TaskItem key={task.id} task={task} course={task.course_id ? courseById.get(task.course_id) ?? null : null} />
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Recent notes</h2>
        <NotesList notes={data.recentNotes} emptyLabel="No notes yet. Add a course, then create your first note." />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Focus time this week</h2>
        <WeeklyFocusChartLoader minutes={data.weeklyFocusMinutes} courses={data.courses} />
      </div>
    </div>
  );
}
