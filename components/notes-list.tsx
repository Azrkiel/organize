"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { formatDistanceToNow } from "date-fns";
import { GripVertical, Pin } from "lucide-react";
import type { Note } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Draggable so a note can be filed into a course/folder from the sidebar (or back to Unfiled) —
 * the drop targets live in components/app-shell.tsx's single shared DndContext, which wraps
 * this list wherever it's rendered (dashboard, course/folder pages, Unfiled).
 */
function NoteRow({ note }: { note: Note }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `note:${note.id}`,
    data: { type: "note", noteId: note.id, title: note.title || "Untitled" },
  });

  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn("group flex h-14 cursor-grab items-center gap-1 active:cursor-grabbing", isDragging && "opacity-40")}
    >
      <GripVertical className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
      <Link
        href={`/notes/${note.id}`}
        draggable={false}
        className="flex h-full min-w-0 flex-1 items-center gap-2 px-1 hover:bg-muted/50"
      >
        {note.pinned && <Pin className="size-3.5 shrink-0 fill-current text-muted-foreground" />}
        <span className="min-w-0 flex-1 truncate font-medium">{note.title || "Untitled"}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
        </span>
      </Link>
    </li>
  );
}

export function NotesList({ notes, emptyLabel }: { notes: Note[]; emptyLabel: string }) {
  if (notes.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y">
      {notes.map((note) => (
        <NoteRow key={note.id} note={note} />
      ))}
    </ul>
  );
}
