import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TaskWithSync } from "@/lib/types";

/** Every task for the signed-in user, sorted by due date (nulls last) then priority, each
 * carrying its linked deadline event's calendar-sync status (PLAN.md Phase 5 task 7). */
export async function getTasks(): Promise<TaskWithSync[]> {
  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false });
  if (!tasks || tasks.length === 0) return [];

  const { data: failedEvents } = await supabase
    .from("events")
    .select("task_id, sync_error")
    .in(
      "task_id",
      tasks.map((t) => t.id)
    )
    .not("sync_error", "is", null);

  const errorByTaskId = new Map((failedEvents ?? []).map((e) => [e.task_id as string, e.sync_error as string]));
  return tasks.map((t) => ({ ...t, syncError: errorByTaskId.get(t.id) ?? null }));
}
