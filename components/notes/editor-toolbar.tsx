"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Sigma,
  Table as TableIcon,
  TextQuote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NameDialog } from "@/components/sidebar/name-dialog";
import { cn } from "@/lib/utils";

function ToolbarButton({
  active,
  disabled,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-8", active && "bg-muted text-foreground")}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/**
 * Formatting buttons for the note editor. Math is inserted via a LaTeX prompt (see the note
 * above the editor for the $$ / $$$ live-typing shortcuts the Mathematics extension ships with).
 */
export function EditorToolbar({ editor }: { editor: Editor }) {
  const [mathOpen, setMathOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b py-1">
      <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="size-4" />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarButton
        label="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <TextQuote className="size-4" />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarButton
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Task list" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <ListChecks className="size-4" />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarButton
        label="Table"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <TableIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Link" active={editor.isActive("link")} onClick={() => setLinkOpen(true)}>
        <LinkIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Insert math" onClick={() => setMathOpen(true)}>
        <Sigma className="size-4" />
      </ToolbarButton>

      <NameDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title="Link"
        description="Paste a URL. Leave empty to remove the link."
        initialValue={editor.getAttributes("link").href ?? ""}
        submitLabel="Apply"
        onSubmit={async (url) => {
          const trimmed = url.trim();
          if (!trimmed) editor.chain().focus().unsetLink().run();
          else editor.chain().focus().setLink({ href: trimmed }).run();
        }}
      />
      <NameDialog
        open={mathOpen}
        onOpenChange={setMathOpen}
        title="Insert math (LaTeX)"
        description="Inline: E = mc^2. Block math is best for standalone equations."
        submitLabel="Insert"
        onSubmit={async (latex) => {
          if (latex.trim()) editor.chain().focus().insertInlineMath({ latex: latex.trim() }).run();
        }}
      />
    </div>
  );
}
