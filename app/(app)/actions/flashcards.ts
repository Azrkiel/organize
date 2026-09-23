"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { schedule, type Grade } from "@/lib/sm2";

type ActionResult = { error?: string };

const createSchema = z.object({
  front: z.string().trim().min(1, "Front is required").max(2000),
  back: z.string().trim().min(1, "Back is required").max(2000),
  courseId: z.string().uuid().nullable().optional(),
  noteId: z.string().uuid().nullable().optional(),
});

export async function createFlashcard(input: {
  front: string;
  back: string;
  courseId?: string | null;
  noteId?: string | null;
}): Promise<ActionResult & { id?: string }> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("flashcards")
    .insert({
      user_id: auth.user.id,
      front: parsed.data.front,
      back: parsed.data.back,
      course_id: parsed.data.courseId ?? null,
      note_id: parsed.data.noteId ?? null,
      // ease/interval_days/repetitions/due_at all take the table's defaults (fresh SM-2
      // card, due now — see lib/sm2.ts's NEW_CARD), so a new card shows up for review right away.
    })
    .select("id")
    .single();

  if (error) return { error: "Could not create flashcard." };
  revalidatePath("/flashcards");
  revalidatePath("/review");
  return { id: data.id };
}

const updateSchema = z.object({
  front: z.string().trim().min(1, "Front is required").max(2000),
  back: z.string().trim().min(1, "Back is required").max(2000),
  courseId: z.string().uuid().nullable().optional(),
});

export async function updateFlashcard(
  cardId: string,
  input: { front: string; back: string; courseId?: string | null }
): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("flashcards")
    .update({ front: parsed.data.front, back: parsed.data.back, course_id: parsed.data.courseId ?? null })
    .eq("id", cardId);

  if (error) return { error: "Could not save flashcard." };
  revalidatePath("/flashcards");
  return {};
}

export async function deleteFlashcard(cardId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("flashcards").delete().eq("id", cardId);
  if (error) return { error: "Could not delete flashcard." };
  revalidatePath("/flashcards");
  revalidatePath("/review");
  return {};
}

const gradeSchema = z.enum(["again", "hard", "good", "easy"]);

/** Reschedules a card via SM-2 after the reviewer grades it (PLAN.md Phase 7 task 3). */
export async function gradeFlashcard(cardId: string, grade: Grade): Promise<ActionResult> {
  const parsed = gradeSchema.safeParse(grade);
  if (!parsed.success) return { error: "Invalid grade." };

  const supabase = await createClient();
  const { data: card, error: fetchError } = await supabase
    .from("flashcards")
    .select("ease, interval_days, repetitions")
    .eq("id", cardId)
    .single();
  if (fetchError || !card) return { error: "Flashcard not found." };

  const next = schedule(
    { ease: card.ease, intervalDays: card.interval_days, repetitions: card.repetitions },
    parsed.data
  );

  const { error } = await supabase
    .from("flashcards")
    .update({
      ease: next.ease,
      interval_days: next.intervalDays,
      repetitions: next.repetitions,
      due_at: next.dueAt.toISOString(),
    })
    .eq("id", cardId);

  if (error) return { error: "Could not reschedule flashcard." };
  return {};
}
