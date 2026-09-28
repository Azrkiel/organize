import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { NotesList } from "@/components/notes-list";
import { LectureList } from "@/components/lectures/lecture-list";
import { NotebookLmExportButton } from "@/components/courses/notebooklm-export-button";
import { ImportSyllabusButton } from "@/components/syllabus/import-syllabus-button";
import { TopicMap } from "@/components/topics/topic-map";
import { createClient } from "@/lib/supabase/server";
import { getCourseRootNotes } from "@/lib/server/notes";
import { getLecturesByCourse } from "@/lib/server/lectures";
import { getCourseTopicMap } from "@/lib/server/topics";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/lib/timezone";

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("*").eq("id", courseId).maybeSingle();
  if (!course) notFound();

  const [notes, lectures, topics, { data: settings }] = await Promise.all([
    getCourseRootNotes(courseId),
    getLecturesByCourse(courseId),
    getCourseTopicMap(courseId),
    supabase.from("settings").select("timezone").eq("user_id", course.user_id).maybeSingle(),
  ]);
  const timeZone = settings?.timezone && isValidTimeZone(settings.timezone) ? settings.timezone : DEFAULT_TIMEZONE;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: course.color }} />
          <h1 className="truncate text-2xl font-semibold tracking-tight">{course.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportSyllabusButton courseId={course.id} userId={course.user_id} />
          <NotebookLmExportButton courseId={course.id} />
        </div>
      </div>
      <NotesList notes={notes} emptyLabel="No notes at the course root yet. Add a folder, or create a note here." />
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Lectures</h2>
        <LectureList lectures={lectures} />
      </div>
      {topics.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Topics</h2>
          <TopicMap topics={topics} today={formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd")} />
        </div>
      )}
    </div>
  );
}
