"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildLectureNotesPrompt } from "@/lib/server/ai/prompts";
import { getGeminiProvider } from "@/lib/server/ai/gemini-provider";
import { RateLimitError } from "@/lib/server/ai/types";
import { markdownToTiptapJson } from "@/lib/server/markdown-to-tiptap";
import { parseLectureNotes, type FlashcardSuggestion } from "@/lib/flashcard-suggestions";

type ActionResult<T = object> = { error?: string; rateLimited?: boolean } & Partial<T>;

async function getLectureWithCourse(supabase: Awaited<ReturnType<typeof createClient>>, lectureId: string) {
  const { data: lecture } = await supabase.from("lectures").select("*").eq("id", lectureId).maybeSingle();
  if (!lecture) return { lecture: null, course: null };
  const { data: course } = lecture.course_id
    ? await supabase.from("courses").select("id, name").eq("id", lecture.course_id).maybeSingle()
    : { data: null };
  return { lecture, course };
}

/** The prompt text for the "Copy prompt for Claude" fallback — same prompt the real Gemini call
 * uses, so pasting Claude's reply back in produces the same shape of notes (PLAN.md Phase 10 task 6). */
export async function getLectureNotesPrompt(lectureId: string): Promise<ActionResult<{ prompt: string }>> {
  const parsedId = z.string().uuid().safeParse(lectureId);
  if (!parsedId.success) return { error: "Invalid lecture." };

  const supabase = await createClient();
  const { lecture, course } = await getLectureWithCourse(supabase, parsedId.data);
  if (!lecture) return { error: "Lecture not found." };
  const transcript = lecture.transcript || lecture.transcript_live;
  if (!transcript) return { error: "This lecture doesn't have a transcript yet." };

  return { prompt: buildLectureNotesPrompt(transcript, course?.name ?? null) };
}

const createFromMarkdownSchema = z.object({
  lectureId: z.string().uuid(),
  markdown: z.string().trim().min(1),
});

/** Finds the course's "Lectures" folder, creating it if missing (PLAN.md Phase 10 task 3). */
async function findOrCreateLecturesFolder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  courseId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("folders")
    .select("id")
    .eq("course_id", courseId)
    .is("parent_id", null)
    .eq("name", "Lectures")
    .maybeSingle();
  if (existing) return existing.id;

  const { count } = await supabase
    .from("folders")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId)
    .is("parent_id", null);

  const { data: created, error } = await supabase
    .from("folders")
    .insert({ user_id: userId, course_id: courseId, parent_id: null, name: "Lectures", position: count ?? 0 })
    .select("id")
    .single();
  if (error || !created) throw new Error("Could not create the Lectures folder.");
  return created.id;
}

/**
 * The shared core both paths in this phase funnel through: Gemini's real output, and the no-key
 * "Paste notes" fallback (PLAN.md Phase 10 tasks 3-4, 6). Splits the trailing flashcard
 * suggestions off (tolerating malformed/missing JSON — the note is kept either way), converts the
 * remaining Markdown to TipTap JSON with the exact extensions the note editor uses, creates the
 * note in the course's Lectures folder, and links it back to the lecture.
 */
export async function createNoteFromMarkdown(input: {
  lectureId: string;
  markdown: string;
}): Promise<ActionResult<{ noteId: string; suggestions: FlashcardSuggestion[] }>> {
  const parsed = createFromMarkdownSchema.safeParse(input);
  if (!parsed.success) return { error: "That doesn't look like valid notes." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  const { lecture } = await getLectureWithCourse(supabase, parsed.data.lectureId);
  if (!lecture) return { error: "Lecture not found." };

  const { body, suggestions } = parseLectureNotes(parsed.data.markdown);
  if (!body) return { error: "Those notes look empty." };

  let folderId: string | null = null;
  try {
    if (lecture.course_id) folderId = await findOrCreateLecturesFolder(supabase, auth.user.id, lecture.course_id);
  } catch {
    return { error: "Could not create the Lectures folder." };
  }

  const { data: note, error: noteError } = await supabase
    .from("notes")
    .insert({
      user_id: auth.user.id,
      course_id: lecture.course_id,
      folder_id: folderId,
      title: lecture.title,
      content: markdownToTiptapJson(body),
      content_text: body,
    })
    .select("id")
    .single();
  if (noteError || !note) return { error: "Could not create the note." };

  const { error: linkError } = await supabase
    .from("lectures")
    .update({ note_id: note.id, status: "notes_ready" })
    .eq("id", lecture.id);
  if (linkError) return { error: "The note was created, but couldn't be linked back to the lecture." };

  revalidatePath("/", "layout");
  return { noteId: note.id, suggestions };
}

/** The real Gemini path (PLAN.md Phase 10 tasks 1, 3, 5). Falls through to `createNoteFromMarkdown`
 * once Gemini's raw Markdown comes back, so both paths create the note identically. */
export async function generateLectureNotes(
  lectureId: string
): Promise<ActionResult<{ noteId: string; suggestions: FlashcardSuggestion[] }>> {
  const parsedId = z.string().uuid().safeParse(lectureId);
  if (!parsedId.success) return { error: "Invalid lecture." };

  const provider = getGeminiProvider();
  if (!provider) return { error: "No Gemini API key is configured." };

  const supabase = await createClient();
  const { lecture, course } = await getLectureWithCourse(supabase, parsedId.data);
  if (!lecture) return { error: "Lecture not found." };
  const transcript = lecture.transcript || lecture.transcript_live;
  if (!transcript) return { error: "This lecture doesn't have a transcript yet." };

  let markdown: string;
  try {
    markdown = await provider.generateLectureNotes({ transcript, courseName: course?.name ?? null });
  } catch (err) {
    if (err instanceof RateLimitError) return { error: err.message, rateLimited: true };
    return { error: err instanceof Error ? err.message : "Could not generate notes." };
  }

  return createNoteFromMarkdown({ lectureId: parsedId.data, markdown });
}
