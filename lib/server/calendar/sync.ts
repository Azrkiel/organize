import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCalendarClient } from "@/lib/server/calendar";
import { listConnectedProviders } from "@/lib/server/integrations";
import type { Database } from "@/lib/database.types";
import type { CalendarEventInput, CalendarProvider, CalendarReminder } from "./types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

const DEFAULT_REMINDERS: CalendarReminder[] = [
  { method: "email", minutes: 1440 }, // 24h before — the free email alert
  { method: "popup", minutes: 60 },
];
const EXAM_EXTRA_REMINDER: CalendarReminder = { method: "email", minutes: 4320 }; // 3 days before

function remindersFor(kind: EventRow["kind"]): CalendarReminder[] {
  return kind === "exam" ? [...DEFAULT_REMINDERS, EXAM_EXTRA_REMINDER] : DEFAULT_REMINDERS;
}

function toCalendarInput(event: EventRow): CalendarEventInput {
  // Most of our events (task deadlines) have no natural duration — give them 30 minutes so
  // they render as a normal timed block instead of a zero-length calendar entry.
  const endsAt = event.ends_at ?? new Date(new Date(event.starts_at).getTime() + 30 * 60_000).toISOString();
  return {
    title: event.title,
    startsAt: event.starts_at,
    endsAt,
    allDay: event.all_day,
    reminders: remindersFor(event.kind),
  };
}

const EXTERNAL_ID_COLUMN = {
  google: "google_event_id",
  microsoft: "outlook_event_id",
} as const satisfies Record<CalendarProvider, "google_event_id" | "outlook_event_id">;

/**
 * Mirrors one `events` row to every calendar the user has connected. Best-effort per provider:
 * one provider failing (network hiccup, revoked access, a provider not built yet) never blocks
 * the others or the caller. Sync failures must never block saving locally (PLAN.md Phase 5 task 7).
 */
export async function syncEventOut(userId: string, event: EventRow): Promise<void> {
  const providers = await listConnectedProviders(userId);
  if (providers.length === 0) return;

  const supabase = await createClient();
  const input = toCalendarInput(event);
  const failures: string[] = [];

  for (const provider of providers) {
    const idColumn = EXTERNAL_ID_COLUMN[provider];
    const existingId = event[idColumn];
    try {
      const client = await getCalendarClient(userId, provider);
      if (existingId) {
        await client.updateEvent(existingId, input);
      } else {
        const newId = await client.createEvent(input);
        // Supabase's generated Update type rejects a computed key, so branch explicitly instead.
        const patch = idColumn === "google_event_id" ? { google_event_id: newId } : { outlook_event_id: newId };
        await supabase.from("events").update(patch).eq("id", event.id);
      }
    } catch (err) {
      // Logged, not thrown — a broken calendar connection must never block saving the note/task itself.
      console.error(`Calendar sync-out failed for event ${event.id} on ${provider}`, err);
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${provider}: ${message}`);
    }
  }

  // Record the outcome so the UI can show a "sync failed, retry" badge (PLAN.md Phase 5 task 7),
  // instead of the failure only living in a server log the owner will never see.
  await supabase
    .from("events")
    .update({ sync_error: failures.length > 0 ? failures.join("; ") : null })
    .eq("id", event.id);
}

/**
 * Removes an event's entries from every connected calendar. Call this BEFORE deleting the
 * `events` row (or before a cascade deletes it) — once the row is gone, its external ids are too.
 */
export async function unsyncEventOut(
  userId: string,
  externalIds: Partial<Record<CalendarProvider, string | null>>,
): Promise<void> {
  for (const provider of Object.keys(externalIds) as CalendarProvider[]) {
    const externalId = externalIds[provider];
    if (!externalId) continue;
    try {
      const client = await getCalendarClient(userId, provider);
      await client.deleteEvent(externalId);
    } catch (err) {
      console.error(`Calendar sync-out delete failed on ${provider}`, err);
    }
  }
}
