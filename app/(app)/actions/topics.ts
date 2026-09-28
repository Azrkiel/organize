"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string };

const linkSchema = z.object({ lectureId: z.string().uuid(), topicId: z.string().uuid() });

/** Confirms a lecture covers a topic (PLAN.md Phase 13 task 4) — from a suggestion or picked by hand. */
export async function linkLectureTopic(input: { lectureId: string; topicId: string }): Promise<ActionResult> {
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid topic." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("lecture_topics")
    .upsert(
      { user_id: auth.user.id, lecture_id: parsed.data.lectureId, topic_id: parsed.data.topicId },
      { onConflict: "lecture_id,topic_id", ignoreDuplicates: true }
    );
  if (error) return { error: "Could not link the topic." };
  revalidatePath("/", "layout");
  return {};
}

export async function unlinkLectureTopic(input: { lectureId: string; topicId: string }): Promise<ActionResult> {
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid topic." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lecture_topics")
    .delete()
    .eq("lecture_id", parsed.data.lectureId)
    .eq("topic_id", parsed.data.topicId);
  if (error) return { error: "Could not unlink the topic." };
  revalidatePath("/", "layout");
  return {};
}
