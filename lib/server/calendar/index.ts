import "server-only";
import type { CalendarClient, CalendarProvider } from "./types";
import { getGoogleCalendarClient } from "./google";

export type { CalendarClient, CalendarEvent, CalendarEventInput, CalendarProvider, CalendarReminder, DateRange } from "./types";

export async function getCalendarClient(userId: string, provider: CalendarProvider): Promise<CalendarClient> {
  if (provider === "google") return getGoogleCalendarClient(userId);
  throw new Error("Microsoft calendar sync is not built yet.");
}
