"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Home, LogOut, Menu, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { signOut } from "@/app/actions";

const COLLAPSED_KEY = "organize:sidebar-collapsed";

function SidebarContent({ email, onNavigate }: { email: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-4 text-lg font-semibold tracking-tight">Organize</div>
      <nav className="flex-1 space-y-1 px-2">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex h-11 items-center gap-2 rounded-lg px-3 text-sm hover:bg-muted"
        >
          <Home className="size-4" /> Home
        </Link>
      </nav>
      <div className="space-y-2 border-t p-3">
        <p className="truncate px-1 text-xs text-muted-foreground" title={email}>
          {email}
        </p>
        <form action={signOut}>
          <Button type="submit" variant="ghost" className="h-11 w-full justify-start gap-2">
            <LogOut className="size-4" /> Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}

export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  return (
    <div className="flex min-h-dvh">
      {!collapsed && (
        <aside className="hidden w-60 shrink-0 border-r md:block">
          <div className="sticky top-0 h-dvh">
            <SidebarContent email={email} />
          </div>
        </aside>
      )}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
          <SidebarContent email={email} onNavigate={() => setDrawerOpen(false)} />
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
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      </div>
    </div>
  );
}
