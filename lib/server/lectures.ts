import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Lecture } from "@/lib/types";

/** All lectures for one course, newest first — the per-course list (PLAN.md Phase 9 task 6). */
export async function getLecturesByCourse(courseId: string): Promise<Lecture[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lectures")
    .select("*")
    .eq("course_id", courseId)
    .order("recorded_at", { ascending: false });
  return data ?? [];
}

/** One lecture by id, or null if it doesn't exist (or isn't the signed-in user's — RLS handles that). */
export async function getLecture(id: string): Promise<Lecture | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("lectures").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

/** Whether the one-time recording-policy reminder has already been shown (PLAN.md Phase 9 task 1). */
export async function getRecordingPolicyAck(): Promise<boolean> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { data } = await supabase.from("settings").select("recording_policy_ack").eq("user_id", auth.user.id).maybeSingle();
  return data?.recording_policy_ack ?? false;
}
