import { redirect } from "next/navigation";
import { CaptureEntryClient } from "@/components/capture/capture-entry-client";
import { createClient } from "@/lib/supabase/server";
import { getActiveRecordingLecture } from "@/lib/server/lectures";

export default async function CapturePage() {
  const supabase = await createClient();
  const [{ data: auth }, { data: courses }, activeLecture] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("courses").select("*").eq("archived", false).order("position"),
    getActiveRecordingLecture(),
  ]);
  if (!auth.user) redirect("/login");

  // Server-side signal (PLAN.md Phase 12 task 10 fix), not the phone's own IndexedDB — recording
  // always happens on the laptop, so a per-device local check could never see it from the phone.
  if (activeLecture) redirect(`/capture/${activeLecture.id}`);

  return (
    <div className="space-y-6">
      <h1 className="text-center text-2xl font-semibold tracking-tight">Capture slides</h1>
      <CaptureEntryClient userId={auth.user.id} courses={courses ?? []} />
    </div>
  );
}
