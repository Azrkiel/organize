import "server-only";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { createServiceClient } from "@/lib/supabase/service";
import { getLocalDayRange } from "@/lib/server/local-day";
import { daysUntil, formatCountdown } from "@/lib/countdown";
import type { Event, Task } from "@/lib/types";

export type DigestRecipient = { userId: string; email: string; timezone: string };

/**
 * The owner's digest settings, or null if the digest is off, unconfigured, or there's no
 * account to send it to. This is a single-user app, so there's exactly one `settings` row.
 */
export async function getDigestRecipient(): Promise<DigestRecipient | null> {
  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("user_id, digest_enabled, digest_email, timezone")
    .maybeSingle();
  if (!settings || !settings.digest_enabled) return null;

  let email = settings.digest_email;
  if (!email) {
    const { data } = await supabase.auth.admin.getUserById(settings.user_id);
    email = data.user?.email ?? null;
  }
  if (!email) return null;

  return { userId: settings.user_id, email, timezone: settings.timezone };
}

export type DigestData = {
  overdueTasks: Task[];
  todayTasks: Task[];
  todayEvents: Event[];
  upcomingExams: Event[];
};

/** Everything the daily digest reports on, for one user's "today" in their own time zone. */
export async function getDigestData(userId: string, timeZone: string): Promise<DigestData> {
  const supabase = createServiceClient();
  const { startUtc, endUtc } = getLocalDayRange(timeZone);
  const startIso = startUtc.toISOString();
  const endIso = endUtc.toISOString();

  const [{ data: dueTasks }, { data: todayEvents }, { data: exams }] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("done", false)
      .not("due_at", "is", null)
      .lt("due_at", endIso)
      .order("due_at"),
    // `task_id is null` because Phase 5 mirrors every task with a due date into a linked
    // `deadline` event. Those tasks are already listed in the task sections above, so
    // including their events here would print each one twice.
    supabase
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .is("task_id", null)
      .gte("starts_at", startIso)
      .lt("starts_at", endIso)
      .order("starts_at"),
    supabase
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .eq("kind", "exam")
      .gte("starts_at", endIso)
      .order("starts_at")
      .limit(3),
  ]);

  const due = dueTasks ?? [];
  return {
    overdueTasks: due.filter((t) => t.due_at! < startIso),
    todayTasks: due.filter((t) => t.due_at! >= startIso),
    todayEvents: todayEvents ?? [],
    upcomingExams: exams ?? [],
  };
}

/** Plain-text + HTML bodies for the digest email. */
export function buildDigestEmail(data: DigestData, timeZone: string, now: Date = new Date()) {
  const localNow = toZonedTime(now, timeZone);
  const subject = `Organize: ${format(localNow, "EEEE, MMMM d")}`;

  const lines: string[] = [];
  const section = (heading: string, items: string[]) => {
    if (items.length === 0) return;
    lines.push(heading, ...items.map((i) => `- ${i}`), "");
  };

  section(
    "Overdue",
    data.overdueTasks.map((t) => t.title)
  );
  section(
    "Due today",
    data.todayTasks.map((t) => (t.due_at ? `${t.title} (${format(toZonedTime(t.due_at, timeZone), "h:mm a")})` : t.title))
  );
  section(
    "Today",
    data.todayEvents.map((e) => (e.all_day ? e.title : `${e.title} (${format(toZonedTime(e.starts_at, timeZone), "h:mm a")})`))
  );
  section(
    "Upcoming exams",
    data.upcomingExams.map(
      (e) => `${e.title} — ${formatCountdown(daysUntil(toZonedTime(e.starts_at, timeZone), localNow))}`
    )
  );

  const text = lines.length > 0 ? lines.join("\n").trimEnd() : "Nothing due today. Nice.";
  const html = lines.length > 0
    ? `<pre style="font-family:inherit;white-space:pre-wrap">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`
    : "<p>Nothing due today. Nice.</p>";

  return { subject, text, html };
}
