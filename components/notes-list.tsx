import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Pin } from "lucide-react";
import type { Note } from "@/lib/types";

export function NotesList({ notes, emptyLabel }: { notes: Note[]; emptyLabel: string }) {
  if (notes.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y">
      {notes.map((note) => (
        <li key={note.id}>
          <Link
            href={`/notes/${note.id}`}
            className="flex h-14 items-center gap-2 px-1 hover:bg-muted/50"
          >
            {note.pinned && <Pin className="size-3.5 shrink-0 fill-current text-muted-foreground" />}
            <span className="min-w-0 flex-1 truncate font-medium">{note.title || "Untitled"}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
