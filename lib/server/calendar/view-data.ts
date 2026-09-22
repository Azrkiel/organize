import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCalendarClient } from "@/lib/server/calendar";
import { listConnectedProviders } from "@/lib/server/integrations";
import type { CalendarProvider } from "./types";

export type CalendarItem = {
  /** A local event's own id, or `external:<provider>:<externalId>` for a pulled-only item. */
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  courseId: string | null;
  courseColor: string | null;
  /** "local" = lives in our `events` table (may also be synced out). "google"/"microsoft" = pulled
   * straight from that calendar, read-only, and not one of ours (no matching external id on file). */
  source: "local" | CalendarProvider;
};

/**
 * Everything to show on the calendar for `range`: local `events` rows plus read-only events
 * pulled from each connected calendar, with anything that's actually one of our own synced
 * events filtered out by matching `google_event_id`/`outlook_event_id` — otherwise every task
 * deadline we sync out would also come back in and show up twice (PLAN.md Phase 5 task 5).
 */
export async function getCalendarItems(range: { from: Date; to: Date }): Promise<CalendarItem[]> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const [{ data: localEvents }, { data: courses }] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .gte("starts_at", fromIso)
      .lte("starts_at", toIso)
      .order("starts_at", { ascending: true }),
    supabase.from("courses").select("id, color"),
  ]);

  const colorByCourse = new Map((courses ?? []).map((c) => [c.id, c.color]));
  const knownExternalIds = new Set<string>();
  for (const e of localEvents ?? []) {
    if (e.google_event_id) knownExternalIds.add(e.google_event_id);
    if (e.outlook_event_id) knownExternalIds.add(e.outlook_event_id);
  }

  const items: CalendarItem[] = (localEvents ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    startsAt: e.starts_at,
    endsAt: e.ends_at ?? e.starts_at,
    allDay: e.all_day,
    courseId: e.course_id,
    courseColor: e.course_id ? (colorByCourse.get(e.course_id) ?? null) : null,
    source: "local",
  }));

  const providers = await listConnectedProviders(auth.user.id);
  for (const provider of providers) {
    try {
      const client = await getCalendarClient(auth.user.id, provider);
      const pulled = await client.listEvents({ from: fromIso, to: toIso });
      for (const ev of pulled) {
        if (knownExternalIds.has(ev.externalId)) continue; // already shown as a local event above
        items.push({
          id: `external:${provider}:${ev.externalId}`,
          title: ev.title,
          startsAt: ev.startsAt,
          endsAt: ev.endsAt,
          allDay: ev.allDay,
          courseId: null,
          courseColor: null,
          source: provider,
        });
      }
    } catch (err) {
      // A provider being briefly unreachable shouldn't blank the rest of the calendar.
      console.error(`Failed to pull ${provider} calendar events for the visible range`, err);
    }
  }

  return items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
