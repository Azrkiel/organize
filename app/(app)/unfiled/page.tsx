import { NotesList } from "@/components/notes-list";
import { getUnfiledNotes } from "@/lib/server/notes";

export default async function UnfiledPage() {
  const notes = await getUnfiledNotes();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Unfiled</h1>
      <NotesList notes={notes} emptyLabel="Nothing here. Notes without a course show up in this list." />
    </div>
  );
}
