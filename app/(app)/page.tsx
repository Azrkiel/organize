import { NotesList } from "@/components/notes-list";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: notes } = await supabase
    .from("notes")
    .select("*")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome to Organize</h1>
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Recent notes</h2>
        <NotesList notes={notes ?? []} emptyLabel="No notes yet. Add a course, then create your first note." />
      </div>
    </div>
  );
}
