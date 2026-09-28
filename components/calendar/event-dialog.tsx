"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEvent, deleteEvent, updateEvent } from "@/app/(app)/actions/events";
import { MANUAL_EVENT_KINDS, type ManualEventKind } from "@/lib/event-kinds";
import type { CalendarItem } from "@/lib/server/calendar/view-data";

const selectClass =
  "h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

type Draft = {
  title: string;
  kind: ManualEventKind;
  courseId: string;
  allDay: boolean;
  date: string;
  startTime: string;
  endTime: string;
};

function draftFrom(item: CalendarItem | null, defaultDate: string): Draft {
  if (!item) {
    return { title: "", kind: "study", courseId: "", allDay: false, date: defaultDate, startTime: "09:00", endTime: "10:00" };
  }
  const start = new Date(item.startsAt);
  return {
    title: item.title,
    kind: (MANUAL_EVENT_KINDS as readonly string[]).includes(item.kind ?? "") ? (item.kind as ManualEventKind) : "other",
    courseId: item.courseId ?? "",
    allDay: item.allDay,
    // All-day events are stored at noon UTC on their date (lib/syllabus.ts), so read the date off the ISO string.
    date: item.allDay ? item.startsAt.slice(0, 10) : format(start, "yyyy-MM-dd"),
    startTime: item.allDay ? "09:00" : format(start, "HH:mm"),
    endTime: item.endsAtRaw ? format(new Date(item.endsAtRaw), "HH:mm") : "",
  };
}

/** Add or edit a standalone calendar event (PLAN.md Phase 13 task 6). `item` null = add. Times are
 * turned into ISO timestamps here, in the browser's own time zone. */
export function EventDialog({
  open,
  onOpenChange,
  item,
  defaultDate,
  courses,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CalendarItem | null;
  defaultDate: string;
  courses: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(item, defaultDate));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Opened from outside (no internal trigger), so prefill reacts to `open` — same as CardEditDialog.
  useEffect(() => {
    if (open) {
      setDraft(draftFrom(item, defaultDate));
      setConfirmDelete(false);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = {
      title: draft.title,
      kind: draft.kind,
      courseId: draft.courseId || null,
      allDay: draft.allDay,
      date: draft.allDay ? draft.date : null,
      startsAt: draft.allDay ? null : new Date(`${draft.date}T${draft.startTime}`).toISOString(),
      endsAt: draft.allDay || !draft.endTime ? null : new Date(`${draft.date}T${draft.endTime}`).toISOString(),
    };
    startTransition(async () => {
      const result = item ? await updateEvent(item.id, input) : await createEvent(input);
      if (result.error) return setError(result.error);
      onOpenChange(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!item) return;
    if (!confirmDelete) return setConfirmDelete(true);
    startTransition(async () => {
      const result = await deleteEvent(item.id);
      if (result.error) return setError(result.error);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{item ? "Edit event" : "Add event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="event-title">Title</Label>
              <Input id="event-title" autoFocus value={draft.title} onChange={(e) => set({ title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="event-kind">Kind</Label>
                <select id="event-kind" value={draft.kind} onChange={(e) => set({ kind: e.target.value as ManualEventKind })} className={selectClass}>
                  {MANUAL_EVENT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k[0].toUpperCase() + k.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-course">Course</Label>
                <select id="event-course" value={draft.courseId} onChange={(e) => set({ courseId: e.target.value })} className={selectClass}>
                  <option value="">No course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-date">Date</Label>
              <Input id="event-date" type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={draft.allDay} onCheckedChange={(c) => set({ allDay: c === true })} />
              All day
            </label>
            {!draft.allDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="event-start">Starts</Label>
                  <Input id="event-start" type="time" value={draft.startTime} onChange={(e) => set({ startTime: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-end">Ends</Label>
                  <Input id="event-end" type="time" value={draft.endTime} onChange={(e) => set({ endTime: e.target.value })} />
                </div>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="gap-2">
            {item && (
              <Button type="button" variant={confirmDelete ? "destructive" : "outline"} onClick={handleDelete} disabled={pending}>
                {confirmDelete ? "Really delete?" : "Delete"}
              </Button>
            )}
            <Button type="submit" disabled={pending || !draft.title.trim() || !draft.date}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
