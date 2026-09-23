"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { applyTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

const LABEL: Record<Theme, string> = { light: "Light", dark: "Dark", system: "System" };
const ICON: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>("system");

  // Read after mount (matches ThemeScript's own default) so server and first client render agree.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (stored === "light" || stored === "dark" || stored === "system") setThemeState(stored);
    } catch {}

    // Live-update when the OS theme changes while "System" is selected and the app stays open.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange() {
      try {
        const current = (localStorage.getItem(THEME_STORAGE_KEY) as Theme | null) ?? "system";
        if (current === "system") applyTheme("system");
      } catch {}
    }
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
    applyTheme(next);
  }

  const Icon = ICON[theme];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Icon className="size-4" /> {LABEL[theme]}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(["light", "dark", "system"] as const).map((t) => {
          const ItemIcon = ICON[t];
          return (
            <DropdownMenuItem key={t} onClick={() => setTheme(t)}>
              <ItemIcon className="size-4" /> {LABEL[t]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
