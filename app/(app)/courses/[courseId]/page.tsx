import { notFound } from "next/navigation";
import { NotesList } from "@/components/notes-list";
import { LectureList } from "@/components/lectures/lecture-list";
import { createClient } from "@/lib/supabase/server";
import { getCourseRootNotes } from "@/lib/server/notes";
import { getLecturesByCourse } from "@/lib/server/lectures";

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("*").eq("id", courseId).maybeSingle();
  if (!course) notFound();

  const [notes, lectures] = await Promise.all([getCourseRootNotes(courseId), getLecturesByCourse(courseId)]);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: course.color }} />
        <h1 className="truncate text-2xl font-semibold tracking-tight">{course.name}</h1>
      </div>
      <NotesList notes={notes} emptyLabel="No notes at the course root yet. Add a folder, or create a note here." />
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Lectures</h2>
        <LectureList lectures={lectures} />
      </div>
    </div>
  );
}
