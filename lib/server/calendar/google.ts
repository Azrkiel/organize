import "server-only";
import { google, type calendar_v3 } from "googleapis";
import { getIntegration, updateAccessToken } from "@/lib/server/integrations";
import type { CalendarClient, CalendarEvent, CalendarEventInput, DateRange } from "./types";

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function toGoogleEvent(input: CalendarEventInput): calendar_v3.Schema$Event {
  return {
    summary: input.title,
    description: input.description,
    start: input.allDay ? { date: toDateOnly(input.startsAt) } : { dateTime: input.startsAt },
    end: input.allDay ? { date: toDateOnly(input.endsAt) } : { dateTime: input.endsAt },
    reminders: input.reminders.length
      ? { useDefault: false, overrides: input.reminders }
      : { useDefault: true },
  };
}

function fromGoogleEvent(event: calendar_v3.Schema$Event): CalendarEvent | null {
  if (!event.id) return null;
  const startsAt = event.start?.dateTime ?? event.start?.date;
  const endsAt = event.end?.dateTime ?? event.end?.date;
  if (!startsAt || !endsAt) return null;

  return {
    externalId: event.id,
    title: event.summary ?? "(untitled)",
    description: event.description ?? undefined,
    startsAt,
    endsAt,
    allDay: !event.start?.dateTime,
  };
}

/**
 * Builds a CalendarClient for a user's connected Google account. Throws if not connected.
 * The underlying OAuth2 client auto-refreshes the access token on demand and this persists
 * the refreshed token back to `integrations` via the `tokens` event — callers never think
 * about refresh explicitly.
 */
export async function getGoogleCalendarClient(userId: string): Promise<CalendarClient> {
  const integration = await getIntegration(userId, "google");
  if (!integration) throw new Error("Google is not connected for this user.");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET env var.");
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({
    refresh_token: integration.refreshToken,
    access_token: integration.accessToken ?? undefined,
    expiry_date: integration.accessTokenExpiresAt
      ? new Date(integration.accessTokenExpiresAt).getTime()
      : undefined,
  });

  // Fired whenever googleapis silently refreshes the access token before a call.
  auth.on("tokens", (tokens) => {
    if (!tokens.access_token) return;
    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : new Date().toISOString();
    // Fire-and-forget: never block/fail the calendar call on a persistence hiccup.
    void updateAccessToken(userId, "google", tokens.access_token, expiresAt).catch((err) => {
      console.error("Failed to persist refreshed Google access token", err);
    });
  });

  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = integration.calendarId ?? "primary";

  return {
    async createEvent(input) {
      const { data } = await calendar.events.insert({
        calendarId,
        requestBody: toGoogleEvent(input),
      });
      if (!data.id) throw new Error("Google did not return an event id.");
      return data.id;
    },

    async updateEvent(externalId, input) {
      await calendar.events.update({
        calendarId,
        eventId: externalId,
        requestBody: toGoogleEvent(input),
      });
    },

    async deleteEvent(externalId) {
      try {
        await calendar.events.delete({ calendarId, eventId: externalId });
      } catch (err) {
        // 404/410 means it's already gone (e.g. deleted by hand in Google Calendar) — not an error for us.
        const status = (err as { code?: number; response?: { status?: number } })?.response?.status;
        if (status !== 404 && status !== 410) throw err;
      }
    },

    async listEvents(range: DateRange) {
      const { data } = await calendar.events.list({
        calendarId,
        timeMin: range.from,
        timeMax: range.to,
        singleEvents: true,
        orderBy: "startTime",
      });
      return (data.items ?? []).map(fromGoogleEvent).filter((e): e is CalendarEvent => e !== null);
    },
  };
}
