"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import {
  CalendarDays,
  CheckSquare,
  FileText,
  Home,
  Inbox,
  Layers,
  LogOut,
  Menu,
  PanelLeft,
  RotateCcw,
  Search,
  Settings,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { CourseTree } from "@/components/sidebar/course-tree";
import { NewNoteButton } from "@/components/new-note-button";
import { CommandPalette } from "@/components/command-palette";
import { signOut } from "@/app/actions";
import { reorderCourses } from "@/app/(app)/actions/courses";
import { moveFolder } from "@/app/(app)/actions/folders";
import { moveNote } from "@/app/(app)/actions/notes";
import type { Course, Folder } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLLAPSED_KEY = "organize:sidebar-collapsed";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/review", label: "Review", icon: RotateCcw },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/unfiled", label: "Unfiled", icon: Inbox },
] as const;

// A curated subset for the mobile bottom bar (PLAN.md Phase 8 task 2) — the full nav has grown
// to 7 items since this task was written; everything else stays one tap away via the drawer.
// "Notes" points at /unfiled, the app's one general-purpose (not course-scoped) notes list.
const BOTTOM_NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/unfiled", label: "Notes", icon: Inbox },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
] as const;

const UNFILED_DROP_ID = "unfiled-drop";

/** Wraps the "Unfiled" nav link so a dragged note can be dropped there to clear its course/folder. */
function UnfiledNavLink({ href, label, icon: Icon, onNavigate }: { href: string; label: string; icon: typeof Home; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { setNodeRef, isOver } = useDroppable({ id: UNFILED_DROP_ID, data: { type: "unfiled" } });

  return (
    <Link
      ref={setNodeRef}
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex h-9 items-center gap-2 rounded-lg px-3 text-sm hover:bg-muted",
        pathname === href && "bg-muted font-medium",
        isOver && "outline outline-2 outline-primary"
      )}
    >
      <Icon className="size-4" /> {label}
    </Link>
  );
}

function SidebarContent({
  email,
  courses,
  archivedCourses,
  foldersByCourse,
  onNavigate,
}: {
  email: string;
  courses: Course[];
  archivedCourses: Course[];
  foldersByCourse: Record<string, Folder[]>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-4 text-lg font-semibold tracking-tight">Organize</div>
      <nav className="space-y-0.5 px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) =>
          href === "/unfiled" ? (
            <UnfiledNavLink key={href} href={href} label={label} icon={Icon} onNavigate={onNavigate} />
          ) : (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex h-9 items-center gap-2 rounded-lg px-3 text-sm hover:bg-muted",
                pathname === href && "bg-muted font-medium"
              )}
            >
              <Icon className="size-4" /> {label}
            </Link>
          )
        )}
      </nav>
      <ScrollArea className="flex-1 px-2 py-2">
        <CourseTree courses={courses} archivedCourses={archivedCourses} foldersByCourse={foldersByCourse} />
      </ScrollArea>
      <div className="space-y-1 border-t p-3">
        <p className="truncate px-1 pb-1 text-xs text-muted-foreground" title={email}>
          {email}
        </p>
        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg px-3 text-sm hover:bg-muted",
            pathname === "/settings" && "bg-muted font-medium"
          )}
        >
          <Settings className="size-4" /> Settings
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="ghost" className="h-9 w-full justify-start gap-2 px-3">
            <LogOut className="size-4" /> Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}

function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
    >
      {BOTTOM_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs text-muted-foreground",
              active && "text-foreground font-medium"
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  email,
  courses,
  archivedCourses,
  foldersByCourse,
  children,
}: {
  email: string;
  courses: Course[];
  archivedCourses: Course[];
  foldersByCourse: Record<string, Folder[]>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Local mirror of the `courses` prop so a course-reorder drag can update the visible order
  // immediately, before the server round trip (`reorderCourses` + `router.refresh()`) completes.
  const [courseOrder, setCourseOrder] = useState(courses);
  useEffect(() => setCourseOrder(courses), [courses]);

  // The one shared drag-and-drop context for the whole app: reordering courses, moving folders
  // (into another folder or a course root), and moving notes (onto a course, a folder, a course
  // root, or "Unfiled") all go through this single DndContext and its `data.current.type`-keyed
  // dispatch below. dnd-kit only lets a draggable and a droppable interact when they belong to
  // the same DndContext instance — course/folder dragging used to each own a separate local one,
  // which is exactly why a note (rendered in <main>) could never be dropped on a sidebar target.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [activeNote, setActiveNote] = useState<{ id: string; title: string } | null>(null);

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (data?.type === "note") setActiveNote({ id: data.noteId, title: data.title });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveNote(null);
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === "course") {
      if (active.id === over.id) return;
      const oldIndex = courseOrder.findIndex((c) => c.id === active.id);
      const newIndex = courseOrder.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const next = arrayMove(courseOrder, oldIndex, newIndex);
      setCourseOrder(next);
      reorderCourses(next.map((c) => c.id)).then(() => router.refresh());
      return;
    }

    if (activeData?.type === "folder") {
      const folderId = activeData.folderId as string;
      if (overData?.type === "folder-root") {
        moveFolder(folderId, null).then(() => router.refresh());
      } else if (overData?.type === "folder") {
        const targetId = overData.folderId as string;
        if (targetId !== folderId) moveFolder(folderId, targetId).then(() => router.refresh());
      }
      return;
    }

    if (activeData?.type === "note") {
      const noteId = activeData.noteId as string;
      if (overData?.type === "course") {
        moveNote(noteId, { courseId: overData.courseId as string, folderId: null }).then(() => router.refresh());
      } else if (overData?.type === "folder-root") {
        moveNote(noteId, { courseId: overData.courseId as string, folderId: null }).then(() => router.refresh());
      } else if (overData?.type === "folder") {
        // courseId is resolved server-side from the folder itself (same invariant as createNote).
        moveNote(noteId, { courseId: null, folderId: overData.folderId as string }).then(() => router.refresh());
      } else if (overData?.type === "unfiled") {
        moveNote(noteId, { courseId: null, folderId: null }).then(() => router.refresh());
      }
      return;
    }
  }

  // Read after mount so server and first client render match.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, prev ? "0" : "1");
      } catch {}
      return !prev;
    });
  }

  const sidebarProps = { email, courses: courseOrder, archivedCourses, foldersByCourse };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex min-h-dvh">
        {!collapsed && (
          <aside className="hidden w-64 shrink-0 border-r md:block">
            <div className="sticky top-0 h-dvh">
              <SidebarContent {...sidebarProps} />
            </div>
          </aside>
        )}

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">Main navigation</SheetDescription>
            <SidebarContent {...sidebarProps} onNavigate={() => setDrawerOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 items-center gap-2 border-b px-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-11 md:hidden"
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden size-9 md:inline-flex"
              aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
              onClick={toggleCollapsed}
            >
              <PanelLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setPaletteOpen(true)}
            >
              <Search className="size-4" /> Search
              <kbd className="ml-2 hidden rounded border bg-muted px-1 text-[0.7rem] sm:inline">Ctrl K</kbd>
            </Button>
            <div className="ml-auto">
              <NewNoteButton />
            </div>
          </header>
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 pb-24 md:pb-8">{children}</main>
        </div>
        <BottomNav />
        <CommandPalette courses={courseOrder} open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>

      <DragOverlay>
        {activeNote && (
          <div className="flex h-10 items-center gap-2 rounded-lg border bg-popover px-3 text-sm shadow-md">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{activeNote.title}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
