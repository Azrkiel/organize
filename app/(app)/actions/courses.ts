"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const COURSE_COLORS = [
  "#6366f1", "#ec4899", "#f97316", "#eab308",
  "#22c55e", "#14b8a6", "#0ea5e9", "#8b5cf6",
];

function randomColor() {
  return COURSE_COLORS[Math.floor(Math.random() * COURSE_COLORS.length)];
}

type ActionResult = { error?: string };

const nameSchema = z.string().trim().min(1, "Name is required").max(100);
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid color");

async function requireUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

export async function createCourse(name: string): Promise<ActionResult & { id?: string }> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const userId = await requireUserId();

  const { count } = await supabase
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("archived", false);

  const { data, error } = await supabase
    .from("courses")
    .insert({ user_id: userId, name: parsed.data, color: randomColor(), position: count ?? 0 })
    .select("id")
    .single();

  if (error) return { error: "Could not create course." };
  revalidatePath("/", "layout");
  return { id: data.id };
}

export async function renameCourse(courseId: string, name: string): Promise<ActionResult> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("courses").update({ name: parsed.data }).eq("id", courseId);
  if (error) return { error: "Could not rename course." };
  revalidatePath("/", "layout");
  return {};
}

export async function recolorCourse(courseId: string, color: string): Promise<ActionResult> {
  const parsed = colorSchema.safeParse(color);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("courses").update({ color: parsed.data }).eq("id", courseId);
  if (error) return { error: "Could not recolor course." };
  revalidatePath("/", "layout");
  return {};
}

export async function setCourseArchived(courseId: string, archived: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("courses").update({ archived }).eq("id", courseId);
  if (error) return { error: "Could not update course." };
  revalidatePath("/", "layout");
  return {};
}

/** `orderedIds` is every non-archived course's id, in the order they should now have. */
export async function reorderCourses(orderedIds: string[]): Promise<ActionResult> {
  const supabase = await createClient();
  const userId = await requireUserId();

  const updates = orderedIds.map((id, position) =>
    supabase.from("courses").update({ position }).eq("id", id).eq("user_id", userId)
  );
  const results = await Promise.all(updates);
  if (results.some((r) => r.error)) return { error: "Could not save the new order." };
  revalidatePath("/", "layout");
  return {};
}
