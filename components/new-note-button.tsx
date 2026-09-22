"use client";

import { useEffect, useRef, useTransition } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createNote } from "@/app/(app)/actions/notes";

/**
 * Renders a "New note" button and registers the global Cmd/Ctrl+N shortcut. Both create a note
 * in whatever course/folder the current page belongs to, then jump straight to the editor.
 */
export function NewNoteButton({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ courseId?: string; folderId?: string }>();
  const [pending, startTransition] = useTransition();

  // Refs so the keydown listener (registered once) always sees the latest route.
  const pathnameRef = useRef(pathname);
  const paramsRef = useRef(params);
  pathnameRef.current = pathname;
  paramsRef.current = params;

  function resolveTarget(): { courseId: string | null; folderId: string | null } {
    if (pathnameRef.current.startsWith("/folders/") && paramsRef.current.folderId) {
      return { courseId: null, folderId: paramsRef.current.folderId };
    }
    if (pathnameRef.current.startsWith("/courses/") && paramsRef.current.courseId) {
      return { courseId: paramsRef.current.courseId, folderId: null };
    }
    return { courseId: null, folderId: null };
  }

  function handleCreate() {
    startTransition(async () => {
      const { courseId, folderId } = resolveTarget();
      const result = await createNote(courseId, folderId);
      if (result.id) router.push(`/notes/${result.id}`);
    });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleCreate();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Button size="sm" className={className} disabled={pending} onClick={handleCreate}>
      <Plus className="size-4" /> New note
    </Button>
  );
}
