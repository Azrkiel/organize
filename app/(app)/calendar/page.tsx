import { getCalendarItems } from "@/lib/server/calendar/view-data";
import { CalendarView } from "@/components/calendar/calendar-view";
import { createClient } from "@/lib/supabase/server";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toDateOnly(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const params = await searchParams;
  const view: "month" | "week" = params.view === "week" ? "week" : "month";
  const anchor = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? new Date(`${params.date}T00:00:00Z`) : new Date();

  // Fetches a padded window server-side (cheap to overfetch); the client bucket the results into
  // local calendar days, so the exact padding just needs to comfortably cover the visible grid
  // regardless of the viewer's time zone.
  const from = new Date(anchor);
  const to = new Date(anchor);
  if (view === "week") {
    from.setUTCDate(from.getUTCDate() - 9);
    to.setUTCDate(to.getUTCDate() + 9);
  } else {
    from.setUTCDate(1);
    from.setUTCDate(from.getUTCDate() - 9);
    to.setUTCMonth(to.getUTCMonth() + 1, 1);
    to.setUTCDate(to.getUTCDate() + 9);
  }

  const supabase = await createClient();
  const [items, { data: courses }] = await Promise.all([
    getCalendarItems({ from, to }),
    supabase.from("courses").select("id, name").eq("archived", false).order("position"),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
      <CalendarView view={view} anchorDate={toDateOnly(anchor)} items={items} courses={courses ?? []} />
    </div>
  );
}
