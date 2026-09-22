import { TasksView } from "@/components/tasks/tasks-view";
import { createClient } from "@/lib/supabase/server";
import { getTasks } from "@/lib/server/tasks";

export default async function TasksPage() {
  const supabase = await createClient();
  const [tasks, { data: courses }] = await Promise.all([
    getTasks(),
    supabase.from("courses").select("*").eq("archived", false).order("position"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
      <TasksView tasks={tasks} courses={courses ?? []} />
    </div>
  );
}
