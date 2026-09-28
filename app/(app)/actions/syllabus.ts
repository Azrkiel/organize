"use server";

import { revalidatePath } from "next/cache";
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildSyllabusPrompt } from "@/lib/server/ai/prompts";
import { parseSyllabusWithGemini } from "@/lib/server/ai/syllabus-parser";
import { RateLimitError } from "@/lib/server/ai/types";
import { syncEventOut } from "@/lib/server/calendar/sync";
import { syncTaskDeadline } from "@/lib/server/calendar/task-deadline";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/lib/timezone";
import {
  allDayStartsAt,
  parseSyllabusJson,
  parsedSyllabusSchema,
  planSyllabusImport,
  type ParsedSyllabus,
} from "@/lib/syllabus";

type ActionResult<T = object> = { error?: string; rateLimited?: boolean } & Partial<T>;

const MAX_SYLLABUS_CHARS = 100_000;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

const createSchema = z.object({
  courseId: z.string().uuid(),
  rawText: z.string().trim().min(20, "That syllabus text looks too short.").max(MAX_SYLLABUS_CHARS, "That syllabus is too long."),
  file: z
    .object({
      storagePath: z.string().min(1).max(500),
      fileName: z.string().min(1).max(255),
      sizeBytes: z.number().int().positive().max(MAX_PDF_BYTES),
    })
    .nullable()
    .optional(),
});

/**
 * Saves an imported syllabus's text (PLAN.md Phase 13 task 1). The browser has already extracted
 * the PDF's text and uploaded the original file to the `attachments` bucket; the file also gets
 * an `attachments` row (no note) so it counts toward the one combined storage-usage total.
 * Parsing is a separate step, so a rate limit never loses the imported text.
 */
export async function createSyllabus(input: z.input<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  const { data: course } = await supabase.from("courses").select("id").eq("id", parsed.data.courseId).maybeSingle();
  if (!course) return { error: "Course not found." };

  const file = parsed.data.file ?? null;
  if (file && !file.storagePath.startsWith(`${auth.user.id}/`)) return { error: "Invalid path." };

  const { data: syllabus, error } = await supabase
    .from("syllabi")
    .insert({
      user_id: auth.user.id,
      course_id: course.id,
      raw_text: parsed.data.rawText,
      storage_path: file?.storagePath ?? null,
    })
    .select("id")
    .single();
  if (error || !syllabus) {
    if (file) await supabase.storage.from("attachments").remove([file.storagePath]);
    return { error: "Could not save the syllabus." };
  }

  if (file) {
    await supabase.from("attachments").insert({
      user_id: auth.user.id,
      note_id: null,
      storage_path: file.storagePath,
      file_name: file.fileName,
      mime_type: "application/pdf",
      size_bytes: file.sizeBytes,
    });
  }

  return { id: syllabus.id };
}

async function getSyllabusWithCourse(syllabusId: string) {
  const supabase = await createClient();
  const { data: syllabus } = await supabase.from("syllabi").select("*").eq("id", syllabusId).maybeSingle();
  if (!syllabus) return { supabase, syllabus: null, courseName: null };
  const { data: course } = await supabase.from("courses").select("name").eq("id", syllabus.course_id).maybeSingle();
  return { supabase, syllabus, courseName: course?.name ?? null };
}

/** The real Gemini path (PLAN.md Phase 13 task 2). */
export async function parseSyllabus(syllabusId: string): Promise<ActionResult> {
  const id = z.string().uuid().safeParse(syllabusId);
  if (!id.success) return { error: "Invalid syllabus." };

  const { supabase, syllabus, courseName } = await getSyllabusWithCourse(id.data);
  if (!syllabus) return { error: "Syllabus not found." };

  let text: string | null;
  try {
    text = await parseSyllabusWithGemini(syllabus.raw_text, courseName);
  } catch (err) {
    if (err instanceof RateLimitError) return { error: err.message, rateLimited: true };
    return { error: err instanceof Error ? err.message : "Could not parse the syllabus." };
  }
  if (text === null) return { error: "No Gemini API key is configured." };

  const result = parseSyllabusJson(text);
  if (!result) return { error: "Gemini's reply wasn't usable. Try again, or use the copy-prompt fallback." };

  const { error } = await supabase.from("syllabi").update({ parsed: result }).eq("id", syllabus.id);
  if (error) return { error: "Could not save the parsed syllabus." };
  revalidatePath(`/courses/${syllabus.course_id}/syllabus/${syllabus.id}`);
  return {};
}

/** Prompt text for the no-key "Copy prompt" fallback — the same prompt Gemini gets. */
export async function getSyllabusPrompt(syllabusId: string): Promise<ActionResult<{ prompt: string }>> {
  const id = z.string().uuid().safeParse(syllabusId);
  if (!id.success) return { error: "Invalid syllabus." };
  const { syllabus, courseName } = await getSyllabusWithCourse(id.data);
  if (!syllabus) return { error: "Syllabus not found." };
  return { prompt: buildSyllabusPrompt(syllabus.raw_text, courseName, new Date().getFullYear()) };
}

/** The paste-JSON half of the fallback. */
export async function savePastedSyllabus(syllabusId: string, reply: string): Promise<ActionResult> {
  const id = z.string().uuid().safeParse(syllabusId);
  if (!id.success) return { error: "Invalid syllabus." };
  const result = parseSyllabusJson(reply);
  if (!result) return { error: "That doesn't look like the syllabus JSON — paste the whole reply." };

  const { supabase, syllabus } = await getSyllabusWithCourse(id.data);
  if (!syllabus) return { error: "Syllabus not found." };
  const { error } = await supabase.from("syllabi").update({ parsed: result }).eq("id", syllabus.id);
  if (error) return { error: "Could not save the parsed syllabus." };
  revalidatePath(`/courses/${syllabus.course_id}/syllabus/${syllabus.id}`);
  return {};
}

const confirmSchema = z.object({
  syllabusId: z.string().uuid(),
  parsed: parsedSyllabusSchema,
  replaceTopics: z.boolean(),
});

/**
 * Commits the reviewed syllabus (PLAN.md Phase 13 task 3): saves the edited version, creates
 * `topics`, and creates a calendar event or task per assessment (see `planSyllabusImport`), each
 * synced out to Google/Outlook through Phase 5's existing paths. Sync is best-effort — a broken
 * calendar connection never blocks the import itself.
 */
export async function confirmSyllabusImport(input: {
  syllabusId: string;
  parsed: ParsedSyllabus;
  replaceTopics: boolean;
}): Promise<ActionResult<{ topics: number; events: number; tasks: number }>> {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { error: "Something in the review table isn't valid." };

  const { supabase, syllabus } = await getSyllabusWithCourse(parsed.data.syllabusId);
  if (!syllabus) return { error: "Syllabus not found." };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };
  const userId = auth.user.id;
  const courseId = syllabus.course_id;

  const { data: settings } = await supabase.from("settings").select("timezone").eq("user_id", userId).maybeSingle();
  const timeZone = settings?.timezone && isValidTimeZone(settings.timezone) ? settings.timezone : DEFAULT_TIMEZONE;

  await supabase
    .from("syllabi")
    .update({ parsed: { ...parsed.data.parsed, imported_at: new Date().toISOString() } })
    .eq("id", syllabus.id);

  const plan = planSyllabusImport(parsed.data.parsed);

  let positionOffset = 0;
  if (parsed.data.replaceTopics) {
    const { error } = await supabase.from("topics").delete().eq("course_id", courseId);
    if (error) return { error: "Could not replace the existing topics." };
  } else {
    const { count } = await supabase.from("topics").select("id", { count: "exact", head: true }).eq("course_id", courseId);
    positionOffset = count ?? 0;
  }

  if (plan.topics.length > 0) {
    const { error } = await supabase.from("topics").insert(
      plan.topics.map((t) => ({
        user_id: userId,
        course_id: courseId,
        title: t.title,
        description: t.description,
        week: t.week,
        scheduled_date: t.scheduledDate,
        position: positionOffset + t.position,
      }))
    );
    if (error) return { error: "Could not create the topics." };
  }

  let events = 0;
  let tasks = 0;
  for (const item of plan.assessments) {
    if (item.type === "event") {
      const { data: event } = await supabase
        .from("events")
        .insert({
          user_id: userId,
          course_id: courseId,
          kind: "exam",
          title: item.title,
          starts_at: allDayStartsAt(item.date),
          all_day: true,
        })
        .select("*")
        .single();
      if (!event) continue;
      events += 1;
      try {
        await syncEventOut(userId, event);
      } catch (err) {
        console.error("syncEventOut failed during syllabus import", err);
      }
    } else {
      // Due at 11:59 PM local time on the due date — the usual syllabus meaning of "due Friday".
      const dueAt = item.date ? fromZonedTime(`${item.date}T23:59:00`, timeZone).toISOString() : null;
      const { data: task } = await supabase
        .from("tasks")
        .insert({ user_id: userId, course_id: courseId, title: item.title, due_at: dueAt })
        .select("id, title, due_at, course_id, done")
        .single();
      if (!task) continue;
      tasks += 1;
      try {
        await syncTaskDeadline(userId, task);
      } catch (err) {
        console.error("syncTaskDeadline failed during syllabus import", err);
      }
    }
  }

  revalidatePath("/", "layout");
  return { topics: plan.topics.length, events, tasks };
}
