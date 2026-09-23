import { FocusTimerView } from "@/components/focus/focus-timer-view";
import { createClient } from "@/lib/supabase/server";

export default async function FocusPage() {
  const supabase = await createClient();
  const { data: courses } = await supabase.from("courses").select("*").eq("archived", false).order("position");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Focus</h1>
      <FocusTimerView courses={courses ?? []} />
    </div>
  );
}
