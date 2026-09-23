"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string };

const schema = z.object({
  courseId: z.string().uuid().nullable().optional(),
  minutes: z.number().int().min(1).max(600),
  startedAt: z.date(),
});

/** Records one completed work interval (breaks aren't logged) — PLAN.md Phase 7 task 5. */
export async function logFocusSession(input: {
  courseId?: string | null;
  minutes: number;
  startedAt: Date;
}): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  const { error } = await supabase.from("focus_sessions").insert({
    user_id: auth.user.id,
    course_id: parsed.data.courseId ?? null,
    minutes: parsed.data.minutes,
    started_at: parsed.data.startedAt.toISOString(),
  });

  if (error) return { error: "Could not save focus session." };
  revalidatePath("/", "layout");
  return {};
}
