"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckSquare, FileText, Mic, Plus } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { createNote } from "@/app/(app)/actions/notes";
import { searchAll, type SearchResult } from "@/app/(app)/actions/search";
import type { Course } from "@/lib/types";

/**
 * Ctrl/Cmd+K search: notes and tasks via `search_all`, plus jumping to a course, "New note",
 * "New task", or "Record lecture" (PLAN.md Phase 6 task 2, Record added in Phase 9 task 1).
 */
export function CommandPalette({
  courses,
  open,
  onOpenChange,
}: {
  courses: Course[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const requestId = useRef(0);

  // Centralized so the query resets no matter how the dialog closes — clicking an item, hitting
  // Escape, or clicking the overlay all end up here via CommandDialog's own onOpenChange, not just
  // the explicit close() paths below. Otherwise a stale query reappears the next time it's opened.
  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) setQuery("");
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        handleOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      searchAll(trimmed).then((found) => {
        if (id === requestId.current) {
          setResults(found);
          setSearching(false);
        }
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  function go(href: string) {
    router.push(href);
    handleOpenChange(false);
  }

  function handleNewNote() {
    handleOpenChange(false);
    createNote(null, null).then((result) => {
      if (result.id) router.push(`/notes/${result.id}`);
    });
  }

  const trimmedQuery = query.trim();
  const matchingCourses = trimmedQuery
    ? courses.filter((c) => c.name.toLowerCase().includes(trimmedQuery.toLowerCase()))
    : courses;

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange} shouldFilter={false}>
      <CommandInput placeholder="Search notes and tasks..." value={query} onValueChange={setQuery} />
      <CommandList>
        {trimmedQuery && !searching && results.length === 0 && matchingCourses.length === 0 && (
          <CommandEmpty>No results.</CommandEmpty>
        )}

        {results.length > 0 && (
          <CommandGroup heading="Notes & tasks">
            {results.map((r) => (
              <CommandItem
                key={`${r.kind}-${r.id}`}
                value={`${r.kind}-${r.id}`}
                onSelect={() => go(r.kind === "note" ? `/notes/${r.id}` : "/tasks")}
              >
                {r.kind === "note" ? <FileText /> : <CheckSquare />}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{r.title || "Untitled"}</span>
                  {r.snippet && (
                    <span
                      className="truncate text-xs text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: r.snippet }}
                    />
                  )}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!trimmedQuery && (
          <CommandGroup heading="Actions">
            <CommandItem value="new-note" onSelect={handleNewNote}>
              <Plus /> New note
            </CommandItem>
            <CommandItem value="new-task" onSelect={() => go("/tasks")}>
              <Plus /> New task
            </CommandItem>
            <CommandItem value="record-lecture" onSelect={() => go("/record")}>
              <Mic /> Record lecture
            </CommandItem>
          </CommandGroup>
        )}

        {matchingCourses.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Courses">
              {matchingCourses.map((course) => (
                <CommandItem
                  key={course.id}
                  value={`course-${course.id}`}
                  onSelect={() => go(`/courses/${course.id}`)}
                >
                  <BookOpen />
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: course.color }} />
                    {course.name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
