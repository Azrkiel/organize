"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult<T = object> = { error?: string } & Partial<T>;

const createSchema = z.object({
  courseId: z.string().uuid().nullable(),
  title: z.string().trim().min(1).max(200),
});

/** Creates the lecture row the moment recording starts, so a crash/reload mid-lecture still has
 * something to resume into (PLAN.md Phase 9 tasks 1-2). */
export async function createLecture(input: { courseId: string | null; title: string }): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("lectures")
    .insert({ user_id: auth.user.id, course_id: parsed.data.courseId, title: parsed.data.title, status: "recorded" })
    .select("id")
    .single();

  if (error || !data) return { error: "Could not start the lecture." };
  revalidatePath("/record");
  return { id: data.id };
}

const liveTranscriptSchema = z.object({ id: z.string().uuid(), transcriptLive: z.string() });

/** Autosaves the rough live transcript every 30s while recording (PLAN.md Phase 9 task 3). */
export async function saveLiveTranscript(input: { id: string; transcriptLive: string }): Promise<ActionResult> {
  const parsed = liveTranscriptSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("lectures").update({ transcript_live: parsed.data.transcriptLive }).eq("id", parsed.data.id);
  if (error) return { error: "Could not save the live transcript." };
  return {};
}

const finishSchema = z.object({ id: z.string().uuid(), durationSeconds: z.number().int().min(0) });

/** Marks recording stopped and records the final duration (PLAN.md Phase 9 task 1). */
export async function finishRecording(input: { id: string; durationSeconds: number }): Promise<ActionResult> {
  const parsed = finishSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("lectures").update({ duration_seconds: parsed.data.durationSeconds }).eq("id", parsed.data.id);
  if (error) return { error: "Could not save the recording." };
  revalidatePath("/record");
  return {};
}

const renameSchema = z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(200) });

export async function renameLecture(input: { id: string; title: string }): Promise<ActionResult> {
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("lectures").update({ title: parsed.data.title }).eq("id", parsed.data.id);
  if (error) return { error: "Could not rename the lecture." };
  revalidatePath("/", "layout");
  return {};
}

export async function deleteLecture(id: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid lecture." };

  const supabase = await createClient();
  const { error } = await supabase.from("lectures").delete().eq("id", parsed.data);
  if (error) return { error: "Could not delete the lecture." };
  revalidatePath("/", "layout");
  return {};
}

/** Given a set of lecture ids that have local audio, returns the subset that already have a saved
 * transcript — safe to discard the audio for (PLAN.md Phase 9 task 7's "Delete all transcribed
 * audio" only ever touches lectures whose transcript text is already preserved server-side). */
export async function getTranscribedLectureIds(ids: string[]): Promise<string[]> {
  const parsed = z.array(z.string().uuid()).safeParse(ids);
  if (!parsed.success || parsed.data.length === 0) return [];

  const supabase = await createClient();
  const { data } = await supabase.from("lectures").select("id").in("id", parsed.data).not("transcript", "is", null);
  return (data ?? []).map((row) => row.id);
}

/** One-time acknowledgement of the recording-policy reminder, shown before the first-ever recording. */
export async function ackRecordingPolicy(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  const { error } = await supabase.from("settings").update({ recording_policy_ack: true }).eq("user_id", auth.user.id);
  if (error) return { error: "Could not save that." };
  return {};
}

const lectureStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["recorded", "transcribing", "transcribed", "notes_ready", "error"]),
});

/** Sets a lecture's status directly — used to mark "transcribing" while the Whisper worker runs
 * client-side, and to revert that if the run is cancelled (PLAN.md Phase 9 task 4). */
export async function setLectureStatus(input: { id: string; status: string }): Promise<ActionResult> {
  const parsed = lectureStatusSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid status." };

  const supabase = await createClient();
  const { error } = await supabase.from("lectures").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  if (error) return { error: "Could not update the lecture." };
  revalidatePath("/", "layout");
  return {};
}

const whisperSchema = z.object({ id: z.string().uuid(), transcript: z.string().trim().min(1) });

export async function saveWhisperTranscript(input: { id: string; transcript: string }): Promise<ActionResult> {
  const parsed = whisperSchema.safeParse(input);
  if (!parsed.success) return { error: "The transcription came back empty." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lectures")
    .update({ transcript: parsed.data.transcript, transcript_source: "whisper", status: "transcribed" })
    .eq("id", parsed.data.id);
  if (error) return { error: "Could not save the transcript." };
  revalidatePath("/", "layout");
  return {};
}

const importSchema = z.object({
  id: z.string().uuid(),
  transcript: z.string().trim().min(1),
});

/** Saves an imported transcript (.txt/.srt/.vtt, already parsed client-side) — PLAN.md Phase 9 task 5. */
export async function saveImportedTranscript(input: { id: string; transcript: string }): Promise<ActionResult> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { error: "That transcript file looks empty." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lectures")
    .update({ transcript: parsed.data.transcript, transcript_source: "import", status: "transcribed" })
    .eq("id", parsed.data.id);
  if (error) return { error: "Could not save the transcript." };
  revalidatePath("/", "layout");
  return {};
}
