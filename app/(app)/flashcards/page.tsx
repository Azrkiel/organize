import { FlashcardsView } from "@/components/flashcards/flashcards-view";
import { getAllFlashcards } from "@/lib/server/flashcards";
import { createClient } from "@/lib/supabase/server";

export default async function FlashcardsPage() {
  const supabase = await createClient();
  const [cards, { data: courses }] = await Promise.all([
    getAllFlashcards(),
    supabase.from("courses").select("*").order("position"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Flashcards</h1>
      <FlashcardsView cards={cards} courses={courses ?? []} />
    </div>
  );
}
