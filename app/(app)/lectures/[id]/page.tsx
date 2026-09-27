import { notFound } from "next/navigation";
import { LectureDetail } from "@/components/lectures/lecture-detail";
import { SlideGallery } from "@/components/lectures/slide-gallery";
import { LectureTimeline } from "@/components/lectures/lecture-timeline";
import { createClient } from "@/lib/supabase/server";
import { getLecture } from "@/lib/server/lectures";
import { getLecturePhotos } from "@/lib/server/lecture-photos";
import { parseTranscriptSegments } from "@/lib/interleave";

export default async function LecturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lecture = await getLecture(id);
  if (!lecture) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const [{ data: course }, { data: settings }, photos] = await Promise.all([
    lecture.course_id
      ? supabase.from("courses").select("id, name, color").eq("id", lecture.course_id).maybeSingle()
      : Promise.resolve({ data: null }),
    auth.user
      ? supabase.from("settings").select("whisper_model_size").eq("user_id", auth.user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    getLecturePhotos(id),
  ]);

  const timelinePhotos = photos
    .filter((p) => p.offsetSeconds !== null)
    .map((p) => ({ id: p.id, offsetSeconds: p.offsetSeconds!, url: p.signedUrl, caption: p.caption }));

  return (
    <div className="space-y-6">
      <LectureDetail
        lecture={lecture}
        course={course}
        defaultModelSize={(settings?.whisper_model_size as "tiny" | "base" | "small") ?? "base"}
        geminiConfigured={Boolean(process.env.GEMINI_API_KEY)}
      />
      <LectureTimeline segments={parseTranscriptSegments(lecture.transcript_segments)} photos={timelinePhotos} />
      {auth.user && <SlideGallery lectureId={id} userId={auth.user.id} lectureTitle={lecture.title} initialPhotos={photos} />}
    </div>
  );
}
