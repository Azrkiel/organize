import { notFound } from "next/navigation";
import { CaptureView } from "@/components/capture/capture-view";
import { getLecturePhotos } from "@/lib/server/lecture-photos";
import { createClient } from "@/lib/supabase/server";

/** QR-code landing page for slide capture (PLAN.md Phase 12 tasks 1-2) — RLS means the lecture
 * lookup below naturally 404s for a lecture that isn't this signed-in user's own. */
export default async function CaptureLecturePage({ params }: { params: Promise<{ lectureId: string }> }) {
  const { lectureId } = await params;
  const supabase = await createClient();

  const [{ data: auth }, { data: lecture }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("lectures").select("id, title, course_id, recorded_at").eq("id", lectureId).maybeSingle(),
  ]);
  if (!auth.user || !lecture) notFound();

  const photos = await getLecturePhotos(lecture.id);

  return (
    <CaptureView
      userId={auth.user.id}
      lectureId={lecture.id}
      courseId={lecture.course_id}
      heading={lecture.title}
      recordedAt={lecture.recorded_at}
      initialPhotos={photos}
    />
  );
}
