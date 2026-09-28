"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { syncEventOut, unsyncEventOut } from "@/lib/server/calendar/sync";
import { allDayStartsAt } from "@/lib/syllabus";
import { MANUAL_EVENT_KINDS } from "@/lib/event-kinds";

type ActionResult = { error?: string };

const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    kind: z.enum(MANUAL_EVENT_KINDS),
    courseId: z.string().uuid().nullable(),
    allDay: z.boolean(),
    /** `YYYY-MM-DD`, used when allDay. */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    /** ISO timestamps built in the browser from its local time zone, used when !allDay. */
    startsAt: z.string().datetime({ offset: true }).nullable(),
    endsAt: z.string().datetime({ offset: true }).nullable(),
  })
  .refine((e) => (e.allDay ? Boolean(e.date) : Boolean(e.startsAt)), { message: "Pick a date." })
  .refine((e) => e.allDay || !e.endsAt || !e.startsAt || e.endsAt > e.startsAt, {
    message: "The end time must be after the start time.",
  });

export type EventInput = z.input<typeof eventSchema>;

function toRow(e: z.output<typeof eventSchema>) {
  return {
    title: e.title,
    kind: e.kind,
    course_id: e.courseId,
    all_day: e.allDay,
    starts_at: e.allDay ? allDayStartsAt(e.date!) : new Date(e.startsAt!).toISOString(),
    ends_at: e.allDay || !e.endsAt ? null : new Date(e.endsAt).toISOString(),
  };
}

/** A standalone calendar event (PLAN.md Phase 13 task 6), synced out through Phase 5's `syncEventOut`. */
export async function createEvent(input: EventInput): Promise<ActionResult> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  const { data: event, error } = await supabase
    .from("events")
    .insert({ user_id: auth.user.id, ...toRow(parsed.data) })
    .select("*")
    .single();
  if (error || !event) return { error: "Could not create the event." };

  try {
    await syncEventOut(auth.user.id, event);
  } catch (err) {
    console.error("syncEventOut failed after createEvent", err);
  }
  revalidatePath("/calendar");
  return {};
}

export async function updateEvent(eventId: string, input: EventInput): Promise<ActionResult> {
  const id = z.string().uuid().safeParse(eventId);
  const parsed = eventSchema.safeParse(input);
  if (!id.success) return { error: "Invalid event." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  // Task deadlines follow their task (Phase 5) — editing one here would be overwritten on the next task edit.
  const { data: event, error } = await supabase
    .from("events")
    .update({ ...toRow(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", id.data)
    .is("task_id", null)
    .select("*")
    .single();
  if (error || !event) return { error: "Could not update the event." };

  try {
    await syncEventOut(auth.user.id, event);
  } catch (err) {
    console.error("syncEventOut failed after updateEvent", err);
  }
  revalidatePath("/calendar");
  return {};
}

export async function deleteEvent(eventId: string): Promise<ActionResult> {
  const id = z.string().uuid().safeParse(eventId);
  if (!id.success) return { error: "Invalid event." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  const { data: event } = await supabase
    .from("events")
    .select("google_event_id, outlook_event_id")
    .eq("id", id.data)
    .is("task_id", null)
    .maybeSingle();
  if (!event) return { error: "Event not found." };

  // Before the delete: once the row is gone, so are its external calendar ids.
  try {
    await unsyncEventOut(auth.user.id, { google: event.google_event_id, microsoft: event.outlook_event_id });
  } catch (err) {
    console.error("unsyncEventOut failed before deleteEvent", err);
  }

  const { error } = await supabase.from("events").delete().eq("id", id.data);
  if (error) return { error: "Could not delete the event." };
  revalidatePath("/calendar");
  return {};
}
