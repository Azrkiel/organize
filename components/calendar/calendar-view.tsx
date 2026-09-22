"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalendarItem } from "@/lib/server/calendar/view-data";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function navHref(view: "month" | "week", date: Date) {
  const params = new URLSearchParams({ view, date: format(date, "yyyy-MM-dd") });
  return `/calendar?${params.toString()}`;
}

export function CalendarView({
  view,
  anchorDate,
  items,
}: {
  view: "month" | "week";
  anchorDate: string; // yyyy-MM-dd
  items: CalendarItem[];
}) {
  // Date-only strings parse to local midnight with parseISO (unlike `new Date(str)`, which
  // treats them as UTC) — matters here since the grid is built from local calendar days.
  const anchor = parseISO(anchorDate);

  const days = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(anchor, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end: addDays(start, 6) });
    }
    const gridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 });
    const gridEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [view, anchor]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      // Real timestamptz values (always carry an offset) — a plain `new Date` renders correctly
      // in the browser's local time zone here, same as everywhere else in the app.
      const key = format(new Date(item.startsAt), "yyyy-MM-dd");
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    return map;
  }, [items]);

  const title =
    view === "week"
      ? `${format(days[0], "MMM d")} – ${format(days[6], "MMM d, yyyy")}`
      : format(anchor, "MMMM yyyy");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Link
            href={navHref(view, view === "week" ? addWeeks(anchor, -1) : addMonths(anchor, -1))}
            className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
            aria-label="Previous"
          >
            ‹
          </Link>
          <Link href={navHref(view, new Date())} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Today
          </Link>
          <Link
            href={navHref(view, view === "week" ? addWeeks(anchor, 1) : addMonths(anchor, 1))}
            className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
            aria-label="Next"
          >
            ›
          </Link>
          <h2 className="ml-2 text-sm font-medium">{title}</h2>
        </div>
        <div className="flex gap-1">
          <Link
            href={navHref("month", anchor)}
            className={cn(buttonVariants({ variant: view === "month" ? "secondary" : "outline", size: "sm" }))}
          >
            Month
          </Link>
          <Link
            href={navHref("week", anchor)}
            className={cn(buttonVariants({ variant: view === "week" ? "secondary" : "outline", size: "sm" }))}
          >
            Week
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-xs">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="bg-muted px-2 py-1.5 text-center font-medium text-muted-foreground">
            {label}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayItems = itemsByDay.get(key) ?? [];
          const dimmed = view === "month" && !isSameMonth(day, anchor);
          return (
            <div
              key={key}
              className={cn(
                "min-h-24 bg-background p-1.5",
                view === "week" && "min-h-40",
                dimmed && "bg-muted/30 text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "mb-1 inline-flex size-5 items-center justify-center rounded-full text-[0.7rem]",
                  isToday(day) && "bg-primary font-medium text-primary-foreground"
                )}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayItems.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "truncate rounded px-1 py-0.5 text-[0.7rem] leading-tight",
                      item.source === "local"
                        ? "bg-muted"
                        : "border border-dashed border-muted-foreground/40 text-muted-foreground"
                    )}
                    title={`${item.title}${item.allDay ? "" : ` — ${format(new Date(item.startsAt), "h:mm a")}`}`}
                  >
                    {item.courseColor && (
                      <span
                        className="mr-1 inline-block size-1.5 shrink-0 rounded-full align-middle"
                        style={{ backgroundColor: item.courseColor }}
                      />
                    )}
                    {!item.allDay && (
                      <span className="text-muted-foreground">{format(new Date(item.startsAt), "h:mm a")} </span>
                    )}
                    {item.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
