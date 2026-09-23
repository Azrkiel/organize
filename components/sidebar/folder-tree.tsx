"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ChevronRight, Folder as FolderIcon, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { NameDialog } from "@/components/sidebar/name-dialog";
import { createFolder, deleteFolder, renameFolder } from "@/app/(app)/actions/folders";
import { buildFolderTree, type FolderNode } from "@/lib/types";
import type { Folder } from "@/lib/types";
import { cn } from "@/lib/utils";

const EXPANDED_KEY = "organize:expanded-folders";

function readExpanded(): Set<string> {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function writeExpanded(ids: Set<string>) {
  try {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify([...ids]));
  } catch {}
}

const ROOT_DROP_ID = (courseId: string) => `course-root:${courseId}`;

function FolderRow({
  node,
  depth,
  courseId,
  expanded,
  onToggle,
  onCreateChild,
}: {
  node: FolderNode;
  depth: number;
  courseId: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onCreateChild: (parentId: string) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const active = pathname === `/folders/${node.id}`;
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `folder:${node.id}`,
    data: { type: "folder", folderId: node.id },
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `folder:${node.id}`,
    data: { type: "folder", folderId: node.id },
  });

  return (
    <div>
      <div
        ref={(el) => {
          setDragRef(el);
          setDropRef(el);
        }}
        {...attributes}
        {...listeners}
        style={{ paddingLeft: `${depth * 16 + 8}px`, opacity: isDragging ? 0.4 : 1 }}
        className={cn(
          "group flex h-9 items-center gap-1 rounded-lg pr-1 text-sm hover:bg-muted",
          active && "bg-muted font-medium",
          isOver && "outline outline-2 outline-primary"
        )}
      >
        <button
          type="button"
          aria-label={isExpanded ? "Collapse" : "Expand"}
          className="flex size-5 shrink-0 items-center justify-center text-muted-foreground"
          onClick={() => onToggle(node.id)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {hasChildren ? (
            <ChevronRight className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")} />
          ) : (
            <span className="size-1.5 rounded-full bg-current opacity-30" />
          )}
        </button>
        <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
        <Link href={`/folders/${node.id}`} className="min-w-0 flex-1 truncate py-1.5" draggable={false}>
          {node.name}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Folder actions"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onCreateChild(node.id)}>New subfolder</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRenameOpen(true)}>Rename</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <FolderRow
              key={child.id}
              node={child}
              depth={depth + 1}
              courseId={courseId}
              expanded={expanded}
              onToggle={onToggle}
              onCreateChild={onCreateChild}
            />
          ))}
        </div>
      )}

      <NameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename folder"
        initialValue={node.name}
        submitLabel="Rename"
        onSubmit={async (name) => {
          const result = await renameFolder(node.id, name);
          if (!result.error) router.refresh();
          return result;
        }}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{node.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Subfolders inside are deleted too. Notes inside {hasChildren ? "this folder and its subfolders" : "it"} are
              not deleted — they move to the course root.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteFolder(node.id).then(() => router.refresh())}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function FolderTree({ courseId, folders }: { courseId: string; folders: Folder[] }) {
  const router = useRouter();
  const tree = buildFolderTree(folders);
  // Starts empty (matching the server render) and is filled from localStorage after mount,
  // so the client's first render still matches what was server-rendered (no hydration mismatch).
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  useEffect(() => setExpanded(readExpanded()), []);
  const [createParentId, setCreateParentId] = useState<string | null | undefined>(undefined);

  // Data carries { type: "folder-root", courseId } — components/app-shell.tsx's shared
  // DndContext reads it to know both which course this is and that it's the "no folder" target.
  const { setNodeRef: setRootDropRef, isOver: isRootOver } = useDroppable({
    id: ROOT_DROP_ID(courseId),
    data: { type: "folder-root", courseId },
  });

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeExpanded(next);
      return next;
    });
  }

  return (
    <>
      {/* The DndContext this belongs to is shared with courses/notes, owned by
          components/app-shell.tsx — see course-tree.tsx's identical note on why. */}
      <div ref={setRootDropRef} className={cn("rounded-lg", isRootOver && "outline outline-2 outline-primary")}>
        {tree.map((node) => (
          <FolderRow
            key={node.id}
            node={node}
            depth={0}
            courseId={courseId}
            expanded={expanded}
            onToggle={toggle}
            onCreateChild={(parentId) => setCreateParentId(parentId)}
          />
        ))}
        <button
          type="button"
          className="flex h-8 w-full items-center gap-1.5 rounded-lg pl-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => setCreateParentId(null)}
        >
          <Plus className="size-3.5" /> New folder
        </button>
      </div>

      <NameDialog
        open={createParentId !== undefined}
        onOpenChange={(open) => !open && setCreateParentId(undefined)}
        title={createParentId ? "New subfolder" : "New folder"}
        submitLabel="Create"
        onSubmit={async (name) => {
          const result = await createFolder(courseId, name, createParentId ?? null);
          if (!result.error) {
            if (createParentId) {
              setExpanded((prev) => {
                const next = new Set(prev).add(createParentId);
                writeExpanded(next);
                return next;
              });
            }
            router.refresh();
          }
          return result;
        }}
      />
    </>
  );
}
