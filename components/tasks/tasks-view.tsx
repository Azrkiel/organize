"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskItem } from "@/components/tasks/task-item";
import { isDueTodayOrOverdue, isUpcoming } from "@/lib/task-buckets";
import type { Course, TaskWithSync } from "@/lib/types";

function CompletedSection({ tasks, courseById }: { tasks: TaskWithSync[]; courseById: Map<string, Course> }) {
  const [open, setOpen] = useState(false);
  if (tasks.length === 0) return null;

  return (
    <div className="mt-4 border-t pt-2">
      <button
        type="button"
        className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronRight className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
        Completed ({tasks.length})
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5">
          {tasks.map((t) => (
            <TaskItem key={t.id} task={t} course={t.course_id ? (courseById.get(t.course_id) ?? null) : null} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskList({
  tasks,
  courseById,
  emptyLabel,
}: {
  tasks: TaskWithSync[];
  courseById: Map<string, Course>;
  emptyLabel: string;
}) {
  if (tasks.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-0.5">
      {tasks.map((t) => (
        <TaskItem key={t.id} task={t} course={t.course_id ? (courseById.get(t.course_id) ?? null) : null} />
      ))}
    </ul>
  );
}

export function TasksView({ tasks, courses }: { tasks: TaskWithSync[]; courses: Course[] }) {
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

  const { notDone, done } = useMemo(() => {
    const notDone: TaskWithSync[] = [];
    const done: TaskWithSync[] = [];
    for (const t of tasks) (t.done ? done : notDone).push(t);
    return { notDone, done };
  }, [tasks]);

  const today = useMemo(() => notDone.filter((t) => isDueTodayOrOverdue(t.due_at)), [notDone]);
  const todayDone = useMemo(() => done.filter((t) => isDueTodayOrOverdue(t.due_at)), [done]);

  const upcoming = useMemo(() => notDone.filter((t) => isUpcoming(t.due_at)), [notDone]);
  const upcomingDone = useMemo(() => done.filter((t) => isUpcoming(t.due_at)), [done]);

  const byCourse = useMemo(() => {
    const groups = new Map<string, TaskWithSync[]>();
    for (const t of notDone) {
      const key = t.course_id ?? "__unfiled__";
      const list = groups.get(key);
      if (list) list.push(t);
      else groups.set(key, [t]);
    }
    return groups;
  }, [notDone]);

  return (
    <div className="space-y-4">
      <QuickAdd courses={courses} />

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="by-course">By course</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <TaskList tasks={today} courseById={courseById} emptyLabel="Nothing due today. Nice." />
          <CompletedSection tasks={todayDone} courseById={courseById} />
        </TabsContent>

        <TabsContent value="upcoming">
          <TaskList tasks={upcoming} courseById={courseById} emptyLabel="Nothing due in the next 7 days." />
          <CompletedSection tasks={upcomingDone} courseById={courseById} />
        </TabsContent>

        <TabsContent value="all">
          <TaskList tasks={notDone} courseById={courseById} emptyLabel="No tasks yet." />
          <CompletedSection tasks={done} courseById={courseById} />
        </TabsContent>

        <TabsContent value="by-course" className="space-y-4">
          {byCourse.size === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No tasks yet.</p>}
          {courses
            .filter((c) => byCourse.has(c.id))
            .map((c) => (
              <div key={c.id}>
                <div className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                  <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </div>
                <TaskList tasks={byCourse.get(c.id) ?? []} courseById={courseById} emptyLabel="" />
              </div>
            ))}
          {byCourse.has("__unfiled__") && (
            <div>
              <div className="mb-1 text-sm font-medium text-muted-foreground">No course</div>
              <TaskList tasks={byCourse.get("__unfiled__") ?? []} courseById={courseById} emptyLabel="" />
            </div>
          )}
          <CompletedSection tasks={done} courseById={courseById} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
