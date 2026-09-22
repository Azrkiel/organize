// Common interface every calendar provider (Google, later Microsoft) implements.
// Keeping sync-out code (Phase 5 task 4) provider-agnostic.

export type CalendarProvider = "google" | "microsoft";

export type CalendarReminder = { method: "email" | "popup"; minutes: number };

export type CalendarEventInput = {
  title: string;
  description?: string;
  startsAt: string; // ISO timestamp
  endsAt: string; // ISO timestamp
  allDay: boolean;
  /** Empty array means "provider default reminders", per each provider's own convention. */
  reminders: CalendarReminder[];
};

export type CalendarEvent = {
  externalId: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
};

export type DateRange = { from: string; to: string };

export interface CalendarClient {
  createEvent(input: CalendarEventInput): Promise<string>; // returns external event id
  updateEvent(externalId: string, input: CalendarEventInput): Promise<void>;
  deleteEvent(externalId: string): Promise<void>;
  listEvents(range: DateRange): Promise<CalendarEvent[]>;
}
