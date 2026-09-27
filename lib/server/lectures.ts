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

const ACTIVE_RECORDING_MAX_AGE_HOURS = 6;

/**
 * The lecture currently being recorded on ANY of the owner's devices, or null — the server-side
 * signal the phone's "Capture" nav tab needs (PLAN.md Phase 12 task 10 fix). Recording state used
 * to only live in the recording device's own IndexedDB, which the phone can never see; `status =
 * 'recording'` (set by `createLecture`, cleared by `finishRecording`) makes it visible cross-device.
 * Ignores anything older than a few hours so a laptop that crashed mid-recording without ever
 * calling `finishRecording` doesn't strand the phone on a dead lecture forever.
 */
export async function getActiveRecordingLecture(): Promise<Pick<Lecture, "id" | "title" | "course_id" | "recorded_at"> | null> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - ACTIVE_RECORDING_MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("lectures")
    .select("id, title, course_id, recorded_at")
    .eq("status", "recording")
    .gt("recorded_at", cutoff)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
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
