import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/lib/types";

/** Every task for the signed-in user, sorted by due date (nulls last) then priority. */
export async function getTasks(): Promise<Task[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false });
  return data ?? [];
}
