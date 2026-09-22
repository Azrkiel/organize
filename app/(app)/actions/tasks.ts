"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { syncTaskDeadline, unsyncTaskDeadline } from "@/lib/server/calendar/task-deadline";

type ActionResult = { error?: string };

const createSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  details: z.string().max(5000).nullable().optional(),
  dueAt: z.date().nullable().optional(),
  priority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(0),
  courseId: z.string().uuid().nullable().optional(),
  noteId: z.string().uuid().nullable().optional(),
});

export async function createTask(input: {
  title: string;
  details?: string | null;
  dueAt?: Date | null;
  priority?: 0 | 1 | 2 | 3;
  courseId?: string | null;
  noteId?: string | null;
}): Promise<ActionResult & { id?: string }> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: auth.user.id,
      title: parsed.data.title,
      details: parsed.data.details ?? null,
      due_at: parsed.data.dueAt ? parsed.data.dueAt.toISOString() : null,
      priority: parsed.data.priority,
      course_id: parsed.data.courseId ?? null,
      note_id: parsed.data.noteId ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: "Could not create task." };

  // Best-effort: a broken calendar connection must never fail task creation.
  try {
    await syncTaskDeadline(auth.user.id, {
      id: data.id,
      title: parsed.data.title,
      due_at: parsed.data.dueAt ? parsed.data.dueAt.toISOString() : null,
      course_id: parsed.data.courseId ?? null,
      done: false,
    });
  } catch (err) {
    console.error("syncTaskDeadline failed after createTask", err);
  }

  revalidatePath("/tasks");
  revalidatePath("/", "layout");
  return { id: data.id };
}

export async function setTaskDone(taskId: string, done: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("tasks")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", taskId)
    .select("id, title, due_at, course_id, done")
    .single();
  if (error) return { error: "Could not update task." };

  try {
    await syncTaskDeadline(auth.user.id, data);
  } catch (err) {
    console.error("syncTaskDeadline failed after setTaskDone", err);
  }

  revalidatePath("/tasks");
  return {};
}

/** Re-attempts calendar sync for one task's linked deadline event, from the "sync failed" badge. */
export async function retryTaskSync(taskId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  const { data: task, error } = await supabase
    .from("tasks")
    .select("id, title, due_at, course_id, done")
    .eq("id", taskId)
    .single();
  if (error || !task) return { error: "Task not found." };

  try {
    await syncTaskDeadline(auth.user.id, task);
  } catch (err) {
    console.error("syncTaskDeadline failed during retry", err);
  }

  revalidatePath("/tasks");
  return {};
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  // Must run before the delete: `events.task_id` cascades, which would wipe the external
  // calendar ids before we get a chance to remove those events from the calendar too.
  try {
    await unsyncTaskDeadline(auth.user.id, taskId);
  } catch (err) {
    console.error("unsyncTaskDeadline failed before deleteTask", err);
  }

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { error: "Could not delete task." };
  revalidatePath("/tasks");
  return {};
}
