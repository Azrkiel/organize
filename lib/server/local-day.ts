import "server-only";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { addDays, startOfDay } from "date-fns";

/**
 * "Today" as UTC instants, per `settings.timezone` rather than the server's own clock —
 * the digest cron needs this (PLAN.md Phase 6 task 3: "Compute 'today' from settings.timezone").
 * `startUtc` is inclusive, `endUtc` exclusive.
 */
export function getLocalDayRange(timeZone: string, now: Date = new Date()): { startUtc: Date; endUtc: Date } {
  const localNow = toZonedTime(now, timeZone);
  const localStartOfDay = startOfDay(localNow);
  const startUtc = fromZonedTime(localStartOfDay, timeZone);
  const endUtc = fromZonedTime(addDays(localStartOfDay, 1), timeZone);
  return { startUtc, endUtc };
}
