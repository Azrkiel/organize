import { differenceInCalendarDays } from "date-fns";

/** Calendar days between `now` and `target`, using the server clock (matches `lib/task-buckets.ts`). */
export function daysUntil(target: Date, now: Date = new Date()): number {
  return differenceInCalendarDays(target, now);
}

/** "today" / "tomorrow" / "in 9 days" / "3 days ago", for a value from `daysUntil`. */
export function formatCountdown(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 1) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}
