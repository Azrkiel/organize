"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Mathematics } from "@tiptap/extension-mathematics";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import "katex/dist/katex.min.css";
import "katex/contrib/mhchem";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EditorToolbar } from "@/components/notes/editor-toolbar";
import { MakeTaskMenu } from "@/components/notes/make-task-menu";
import { AttachmentsPanel, type AttachmentWithUrl } from "@/components/notes/attachments-panel";
import { deleteNote, saveNote, setNotePinned } from "@/app/(app)/actions/notes";
import type { Note } from "@/lib/types";
import type { Json } from "@/lib/database.types";
import { cn } from "@/lib/utils";

const SAVE_DEBOUNCE_MS = 800;

type SaveStatus = "idle" | "saving" | "saved" | "error";

function backHref(note: Note): string {
  if (note.folder_id) return `/folders/${note.folder_id}`;
  if (note.course_id) return `/courses/${note.course_id}`;
  return "/unfiled";
}

/** Empty jsonb ('{}') isn't a valid TipTap doc; treat it as "no content yet". */
function initialContent(content: Json): JSONContent | string {
  if (content && typeof content === "object" && !Array.isArray(content) && Object.keys(content).length === 0) {
    return "";
  }
  return content as JSONContent;
}

export function NoteEditor({
  note,
  userId,
  attachments,
}: {
  note: Note;
  userId: string;
  attachments: AttachmentWithUrl[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(note.title);
  const [pinned, setPinned] = useState(note.pinned);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const titleRef = useRef(title);
  titleRef.current = title;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: true } }),
      Image,
      Mathematics.configure({ katexOptions: { throwOnError: false } }),
    ],
    content: initialContent(note.content),
    editorProps: {
      attributes: { class: "min-h-[50vh] max-w-none focus:outline-none" },
    },
    onUpdate: () => scheduleSave(),
  });

  function scheduleSave() {
    setStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, SAVE_DEBOUNCE_MS);
  }

  async function doSave() {
    if (!editor) return;
    // editor.getJSON() nodes carry ProseMirror's internal attrs objects, which React Server
    // Actions' argument serialization silently drops properties from (they aren't plain
    // objects it recognizes). A real JSON round-trip first forces plain data across the boundary.
    const content = JSON.parse(JSON.stringify(editor.getJSON())) as Json;
    const result = await saveNote(note.id, {
      title: titleRef.current.trim() || "Untitled",
      content,
      contentText: editor.getText(),
    });
    setStatus(result.error ? "error" : "saved");
  }

  // Flush a pending save when the page is closed/navigated away from.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        doSave();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTitleChange(value: string) {
    setTitle(value);
    scheduleSave();
  }

  async function togglePin() {
    const next = !pinned;
    setPinned(next);
    await setNotePinned(note.id, next);
  }

  async function handleDelete() {
    const target = backHref(note);
    await deleteNote(note.id);
    router.push(target);
  }

  if (!editor) return null;

  return (
    <div className="space-y-4 pb-16">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-xs text-muted-foreground transition-opacity",
            status === "idle" && "opacity-0"
          )}
        >
          {status === "saving" && "Saving…"}
          {status === "saved" && "Saved"}
          {status === "error" && "Could not save"}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" aria-label={pinned ? "Unpin" : "Pin"} onClick={togglePin}>
            {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            aria-label="Delete note"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <Input
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        placeholder="Untitled"
        className="h-auto border-none px-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
      />

      <div className="rounded-lg border">
        <EditorToolbar editor={editor} />
        <div className="px-4 py-3">
          <MakeTaskMenu editor={editor} noteId={note.id} courseId={note.course_id} />
          <EditorContent editor={editor} />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Attachments</h2>
        <AttachmentsPanel noteId={note.id} userId={userId} attachments={attachments} />
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the note and its attachments. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
