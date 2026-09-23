"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardEditDialog } from "@/components/flashcards/card-edit-dialog";
import { deleteFlashcard } from "@/app/(app)/actions/flashcards";
import type { Course, Flashcard } from "@/lib/types";

function FlashcardRow({ card, onEdit }: { card: Flashcard; onEdit: (card: Flashcard) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteFlashcard(card.id);
      router.refresh();
    });
  }

  return (
    <li className="group flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{card.front}</p>
        <p className="truncate text-sm text-muted-foreground">{card.back}</p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label="Edit" onClick={() => onEdit(card)}>
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          aria-label="Delete"
          disabled={pending}
          onClick={handleDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}

/** All flashcards, grouped by course, with inline edit/delete (PLAN.md Phase 7 task 4). */
export function FlashcardsView({ cards, courses }: { cards: Flashcard[]; courses: Course[] }) {
  const [editing, setEditing] = useState<Flashcard | null>(null);

  const byCourse = useMemo(() => {
    const groups = new Map<string, Flashcard[]>();
    for (const card of cards) {
      const key = card.course_id ?? "__unfiled__";
      const list = groups.get(key);
      if (list) list.push(card);
      else groups.set(key, [card]);
    }
    return groups;
  }, [cards]);

  if (cards.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No flashcards yet. Select text in a note and choose &quot;Make flashcard&quot; to create one.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {courses
        .filter((c) => byCourse.has(c.id))
        .map((course) => (
          <div key={course.id}>
            <div className="mb-1 flex items-center gap-1.5 text-sm font-medium">
              <span className="size-2 rounded-full" style={{ backgroundColor: course.color }} />
              {course.name}
            </div>
            <ul className="divide-y rounded-lg border">
              {(byCourse.get(course.id) ?? []).map((card) => (
                <FlashcardRow key={card.id} card={card} onEdit={setEditing} />
              ))}
            </ul>
          </div>
        ))}

      {byCourse.has("__unfiled__") && (
        <div>
          <div className="mb-1 text-sm font-medium text-muted-foreground">No course</div>
          <ul className="divide-y rounded-lg border">
            {(byCourse.get("__unfiled__") ?? []).map((card) => (
              <FlashcardRow key={card.id} card={card} onEdit={setEditing} />
            ))}
          </ul>
        </div>
      )}

      <CardEditDialog card={editing} courses={courses} open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} />
    </div>
  );
}
