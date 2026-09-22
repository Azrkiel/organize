import Link from "next/link";
import { notFound } from "next/navigation";
import { NotesList } from "@/components/notes-list";
import { createClient } from "@/lib/supabase/server";
import { getFolderNotes } from "@/lib/server/notes";

export default async function FolderPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = await params;
  const supabase = await createClient();
  const { data: folder } = await supabase
    .from("folders")
    .select("*, courses(id, name, color)")
    .eq("id", folderId)
    .maybeSingle();
  if (!folder) notFound();

  const notes = await getFolderNotes(folderId);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        {folder.courses && (
          <Link
            href={`/courses/${folder.courses.id}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: folder.courses.color }} />
            {folder.courses.name}
          </Link>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-tight">{folder.name}</h1>
      </div>
      <NotesList notes={notes} emptyLabel="No notes in this folder yet." />
    </div>
  );
}
