import { RecordView } from "@/components/record/record-view";
import { getRecordingPolicyAck } from "@/lib/server/lectures";
import { createClient } from "@/lib/supabase/server";

export default async function RecordPage() {
  const supabase = await createClient();
  const [{ data: courses }, policyAcked] = await Promise.all([
    supabase.from("courses").select("*").eq("archived", false).order("position"),
    getRecordingPolicyAck(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Record lecture</h1>
      <RecordView courses={courses ?? []} initialPolicyAcked={policyAcked} />
    </div>
  );
}
