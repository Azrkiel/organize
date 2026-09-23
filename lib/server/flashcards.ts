import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Flashcard } from "@/lib/types";

/** Cards due now (or overdue), optionally narrowed to one course, oldest-due first (PLAN.md Phase 7 task 3). */
export async function getDueFlashcards(courseId?: string | null): Promise<Flashcard[]> {
  const supabase = await createClient();
  let query = supabase.from("flashcards").select("*").lte("due_at", new Date().toISOString()).order("due_at");
  if (courseId) query = query.eq("course_id", courseId);

  const { data } = await query;
  return data ?? [];
}

/** Every card the user has, newest first — for the per-course list/edit page (PLAN.md Phase 7 task 4). */
export async function getAllFlashcards(): Promise<Flashcard[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("flashcards").select("*").order("created_at", { ascending: false });
  return data ?? [];
}

/** How many cards are due right now, for the dashboard's "flashcards due" count (Phase 6 groundwork). */
export async function getDueFlashcardCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("flashcards")
    .select("*", { count: "exact", head: true })
    .lte("due_at", new Date().toISOString());
  return count ?? 0;
}
