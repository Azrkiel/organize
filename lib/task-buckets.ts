import { addDays, endOfDay, startOfDay } from "date-fns";

/** Strictly before today — this is what should render in red. */
export function isOverdue(dueAt: string | null, now: Date = new Date()): boolean {
  if (!dueAt) return false;
  return new Date(dueAt) < startOfDay(now);
}

/** The "Today" tab: due today or overdue. */
export function isDueTodayOrOverdue(dueAt: string | null, now: Date = new Date()): boolean {
  if (!dueAt) return false;
  return new Date(dueAt) <= endOfDay(now);
}

/** The "Upcoming" tab: due after today, within the next 7 days. */
export function isUpcoming(dueAt: string | null, now: Date = new Date()): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  return due > endOfDay(now) && due <= endOfDay(addDays(now, 7));
}
