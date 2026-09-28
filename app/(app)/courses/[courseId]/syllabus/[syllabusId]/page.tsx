import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parsedSyllabusSchema } from "@/lib/syllabus";
import { SyllabusParsePanel, SyllabusReviewTables } from "@/components/syllabus/syllabus-review";

/** The syllabus review screen (PLAN.md Phase 13 tasks 2-3): parse first, then edit and confirm. */
export default async function SyllabusReviewPage({
  params,
}: {
  params: Promise<{ courseId: string; syllabusId: string }>;
}) {
  const { courseId, syllabusId } = await params;
  const supabase = await createClient();
  const [{ data: syllabus }, { data: course }, { count: topicCount }] = await Promise.all([
    supabase.from("syllabi").select("*").eq("id", syllabusId).eq("course_id", courseId).maybeSingle(),
    supabase.from("courses").select("id, name, color").eq("id", courseId).maybeSingle(),
    supabase.from("topics").select("id", { count: "exact", head: true }).eq("course_id", courseId),
  ]);
  if (!syllabus || !course) notFound();

  const parsed = syllabus.parsed ? parsedSyllabusSchema.safeParse(syllabus.parsed) : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href={`/courses/${course.id}`} className="text-sm text-muted-foreground hover:underline">
          ← {course.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Review syllabus</h1>
      </div>

      {parsed?.success ? (
        <SyllabusReviewTables
          syllabusId={syllabus.id}
          courseId={course.id}
          parsed={parsed.data}
          existingTopicCount={topicCount ?? 0}
        />
      ) : (
        <SyllabusParsePanel syllabusId={syllabus.id} geminiConfigured={Boolean(process.env.GEMINI_API_KEY)} />
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Extracted syllabus text</summary>
        <pre className="mt-2 max-h-96 overflow-auto rounded-lg border p-3 text-xs whitespace-pre-wrap">{syllabus.raw_text}</pre>
      </details>
    </div>
  );
}
