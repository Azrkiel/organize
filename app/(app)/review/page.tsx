import { ReviewSession } from "@/components/review/review-session";
import { getDueFlashcards } from "@/lib/server/flashcards";
import { createClient } from "@/lib/supabase/server";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const { course: courseId } = await searchParams;
  const supabase = await createClient();

  const [cards, { data: courses }] = await Promise.all([
    getDueFlashcards(courseId ?? null),
    supabase.from("courses").select("*").eq("archived", false).order("position"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
      <ReviewSession cards={cards} courses={courses ?? []} activeCourseId={courseId ?? null} />
    </div>
  );
}
