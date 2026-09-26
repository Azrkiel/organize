import "server-only";
import { MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { Mathematics } from "@tiptap/extension-mathematics";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import type { JSONContent } from "@tiptap/core";

// Same extension set as the note editor (components/notes/note-editor.tsx), so a generated note
// renders identically to a hand-written one — including math via @tiptap/extension-mathematics's
// own markdownTokenizer/parseMarkdown hooks, which is what actually turns `$...$` / `$$...$$` into
// real inline/block math nodes here (PLAN.md Phase 10 task 3), not a hand-rolled regex pass.
// A module-level singleton: the manager holds no per-call state, only the extension schema, so
// building it once and reusing it avoids re-registering every extension on every note generated.
let manager: MarkdownManager | null = null;

function getManager(): MarkdownManager {
  if (!manager) {
    manager = new MarkdownManager({
      extensions: [
        StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
        TaskList,
        TaskItem.configure({ nested: true }),
        TableKit.configure({ table: { resizable: true } }),
        Image,
        Mathematics.configure({ katexOptions: { throwOnError: false } }),
      ],
    });
  }
  return manager;
}

/** Converts Markdown (from Gemini, or pasted by the owner as the no-key fallback) into TipTap
 * JSON ready to store in `notes.content`. */
export function markdownToTiptapJson(markdown: string): JSONContent {
  return getManager().parse(markdown);
}
