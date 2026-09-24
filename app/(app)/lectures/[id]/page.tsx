import { notFound } from "next/navigation";
import { LectureDetail } from "@/components/lectures/lecture-detail";
import { createClient } from "@/lib/supabase/server";
import { getLecture } from "@/lib/server/lectures";

export default async function LecturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lecture = await getLecture(id);
  if (!lecture) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const [{ data: course }, { data: settings }] = await Promise.all([
    lecture.course_id
      ? supabase.from("courses").select("id, name, color").eq("id", lecture.course_id).maybeSingle()
      : Promise.resolve({ data: null }),
    auth.user
      ? supabase.from("settings").select("whisper_model_size").eq("user_id", auth.user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="space-y-6">
      <LectureDetail lecture={lecture} course={course} defaultModelSize={(settings?.whisper_model_size as "tiny" | "base" | "small") ?? "base"} />
    </div>
  );
}
