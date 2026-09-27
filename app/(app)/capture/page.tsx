import { redirect } from "next/navigation";
import { CaptureEntryClient } from "@/components/capture/capture-entry-client";
import { createClient } from "@/lib/supabase/server";

export default async function CapturePage() {
  const supabase = await createClient();
  const [{ data: auth }, { data: courses }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("courses").select("*").eq("archived", false).order("position"),
  ]);
  if (!auth.user) redirect("/login");

  return (
    <div className="space-y-6">
      <h1 className="text-center text-2xl font-semibold tracking-tight">Capture slides</h1>
      <CaptureEntryClient userId={auth.user.id} courses={courses ?? []} />
    </div>
  );
}
