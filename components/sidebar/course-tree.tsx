"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, ChevronRight, GripVertical, MoreHorizontal, PaintBucket, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NameDialog } from "@/components/sidebar/name-dialog";
import { ColorPicker } from "@/components/sidebar/color-picker";
import { FolderTree } from "@/components/sidebar/folder-tree";
import {
  createCourse,
  recolorCourse,
  renameCourse,
  reorderCourses,
  setCourseArchived,
} from "@/app/(app)/actions/courses";
import type { Course, Folder } from "@/lib/types";
import { cn } from "@/lib/utils";

const EXPANDED_KEY = "organize:expanded-courses";

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

function CourseRow({
  course,
  folders,
  isExpanded,
  onToggle,
}: {
  course: Course;
  folders: Folder[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const active = pathname === `/courses/${course.id}`;
  const [renameOpen, setRenameOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: course.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-50")}>
      <div
        className={cn(
          "group flex h-9 items-center gap-1 rounded-lg pr-1 text-sm hover:bg-muted",
          active && "bg-muted font-medium"
        )}
      >
        <button
          type="button"
          className="flex size-5 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Reorder course"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={isExpanded ? "Collapse" : "Expand"}
          className="flex size-5 shrink-0 items-center justify-center text-muted-foreground"
          onClick={onToggle}
        >
          <ChevronRight className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")} />
        </button>
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: course.color }} />
        <Link href={`/courses/${course.id}`} className="min-w-0 flex-1 truncate py-1.5 font-medium">
          {course.name}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                aria-label="Course actions"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setRenameOpen(true)}>
              <Pencil /> Rename
            </DropdownMenuItem>
            <ColorPicker
              value={course.color}
              onChange={(color) => recolorCourse(course.id, color).then(() => router.refresh())}
            >
              <DropdownMenuItem closeOnClick={false}>
                <PaintBucket /> Color
              </DropdownMenuItem>
            </ColorPicker>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCourseArchived(course.id, true).then(() => router.refresh())}>
              <Archive /> Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {isExpanded && (
        <div className="pl-2">
          <FolderTree courseId={course.id} folders={folders} />
        </div>
      )}
      <NameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename course"
        initialValue={course.name}
        submitLabel="Rename"
        onSubmit={async (name) => {
          const result = await renameCourse(course.id, name);
          if (!result.error) router.refresh();
          return result;
        }}
      />
    </div>
  );
}

function ArchivedSection({ courses }: { courses: Course[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (courses.length === 0) return null;

  return (
    <div className="mt-2 border-t pt-2">
      <button
        type="button"
        className="flex h-8 w-full items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
        Archived ({courses.length})
      </button>
      {open && (
        <div className="space-y-0.5">
          {courses.map((c) => (
            <div key={c.id} className="flex h-8 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground">
              <span className="size-2 shrink-0 rounded-full opacity-50" style={{ backgroundColor: c.color }} />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setCourseArchived(c.id, false).then(() => router.refresh())}
              >
                Unarchive
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CourseTree({
  courses,
  archivedCourses,
  foldersByCourse,
}: {
  courses: Course[];
  archivedCourses: Course[];
  foldersByCourse: Record<string, Folder[]>;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(courses);
  // Starts empty (matching the server render) and is filled from localStorage after mount,
  // so the client's first render still matches what was server-rendered (no hydration mismatch).
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  useEffect(() => setExpanded(readExpanded()), []);
  const [createOpen, setCreateOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Keep local order in sync when the server sends fresh data (after any mutation, router.refresh()).
  useEffect(() => setOrder(courses), [courses]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeExpanded(next);
      return next;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.findIndex((c) => c.id === active.id);
    const newIndex = order.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    reorderCourses(next.map((c) => c.id)).then(() => router.refresh());
  }

  return (
    <div>
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-muted-foreground">Courses</span>
        <Button variant="ghost" size="icon" className="size-6" aria-label="New course" onClick={() => setCreateOpen(true)}>
          <Plus className="size-3.5" />
        </Button>
      </div>

      {order.length === 0 ? (
        <p className="px-2 py-2 text-xs text-muted-foreground">No courses yet.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {order.map((course) => (
              <CourseRow
                key={course.id}
                course={course}
                folders={foldersByCourse[course.id] ?? []}
                isExpanded={expanded.has(course.id)}
                onToggle={() => toggle(course.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      <ArchivedSection courses={archivedCourses} />

      <NameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New course"
        submitLabel="Create"
        onSubmit={async (name) => {
          const result = await createCourse(name);
          if (!result.error) router.refresh();
          return result;
        }}
      />
    </div>
  );
}
