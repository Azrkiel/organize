"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CheckSquare,
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
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
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
        ))}
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
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

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

  const sidebarProps = { email, courses, archivedCourses, foldersByCourse };

  return (
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
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      </div>
      <CommandPalette courses={courses} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
