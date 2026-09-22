import "server-only";
import { createClient } from "@/lib/supabase/server";
import { syncEventOut, unsyncEventOut } from "./sync";

type TaskLike = {
  id: string;
  title: string;
  due_at: string | null;
  course_id: string | null;
  done: boolean;
};

/**
 * Keeps a task's linked "deadline" `events` row (events.task_id) in sync with the task, and
 * mirrors it to connected calendars. Call after every task create/edit/complete.
 *
 * A task only has a linked event while it has a due date and isn't done — completing a task
 * removes its calendar event so finished work stops sending reminders, and un-completing
 * recreates it (PLAN.md Phase 5 task 4).
 */
export async function syncTaskDeadline(userId: string, task: TaskLike): Promise<void> {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("events").select("*").eq("task_id", task.id).maybeSingle();

  const shouldHaveEvent = Boolean(task.due_at) && !task.done;

  if (!shouldHaveEvent) {
    if (existing) {
      await unsyncEventOut(userId, {
        google: existing.google_event_id,
        microsoft: existing.outlook_event_id,
      });
      await supabase.from("events").delete().eq("id", existing.id);
    }
    return;
  }

  // shouldHaveEvent guarantees task.due_at is set, but TS can't narrow through that boolean.
  const dueAt = task.due_at as string;

  if (existing) {
    const changed =
      existing.title !== task.title || existing.starts_at !== dueAt || existing.course_id !== task.course_id;
    if (changed) {
      await supabase
        .from("events")
        .update({ title: task.title, starts_at: dueAt, course_id: task.course_id })
        .eq("id", existing.id);
    }
    await syncEventOut(userId, { ...existing, title: task.title, starts_at: dueAt, course_id: task.course_id });
    return;
  }

  const { data: created } = await supabase
    .from("events")
    .insert({
      user_id: userId,
      task_id: task.id,
      course_id: task.course_id,
      kind: "deadline",
      title: task.title,
      starts_at: dueAt,
      all_day: false,
    })
    .select("*")
    .single();

  if (created) await syncEventOut(userId, created);
}

/**
 * Call this right before a task row is deleted. `events.task_id` cascades on task delete, which
 * would otherwise wipe out the external calendar ids before we get a chance to clean them up.
 */
export async function unsyncTaskDeadline(userId: string, taskId: string): Promise<void> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("events")
    .select("google_event_id, outlook_event_id")
    .eq("task_id", taskId)
    .maybeSingle();
  if (!existing) return;

  await unsyncEventOut(userId, {
    google: existing.google_event_id,
    microsoft: existing.outlook_event_id,
  });
  // No need to delete the `events` row ourselves — it cascades when the task is deleted right after this.
}
