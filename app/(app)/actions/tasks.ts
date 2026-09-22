"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
  revalidatePath("/tasks");
  revalidatePath("/", "layout");
  return { id: data.id };
}

export async function setTaskDone(taskId: string, done: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", taskId);
  if (error) return { error: "Could not update task." };
  revalidatePath("/tasks");
  return {};
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { error: "Could not delete task." };
  revalidatePath("/tasks");
  return {};
}
