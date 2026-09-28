import Link from "next/link";
import { isTopicGap } from "@/lib/topic-map";
import type { TopicMapEntry } from "@/lib/server/topics";
import { cn } from "@/lib/utils";

function formatDate(date: string) {
  // Date-only string: build it as a local date so it never shifts a day across time zones.
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function topicLabel(t: TopicMapEntry) {
  return t.week !== null ? `Week ${t.week}: ${t.title}` : t.title;
}

/** A course's topics by week, each with the lectures that cover it, and anything due-but-uncovered
 * flagged as a gap (PLAN.md Phase 13 tasks 4-5). `today` is the viewer's local date (`YYYY-MM-DD`). */
export function TopicMap({ topics, today }: { topics: TopicMapEntry[]; today: string }) {
  const gaps = topics.filter((t) =>
    isTopicGap({ scheduledDate: t.scheduledDate, hasNotes: t.lectures.some((l) => l.hasNotes) }, today)
  );
  const gapIds = new Set(gaps.map((t) => t.id));

  return (
    <div className="space-y-3">
      {gaps.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {gaps.length === 1 ? "No notes yet for " : `No notes yet for ${gaps.length} topics, including `}
          <span className="font-medium text-foreground">{topicLabel(gaps[0])}</span>.
        </p>
      )}
      <ul className="divide-y rounded-lg border">
        {topics.map((t) => (
          <li key={t.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm">
            <span className="w-16 shrink-0 text-xs text-muted-foreground">
              {t.week !== null ? `Wk ${t.week}` : ""}
              {t.scheduledDate && <span className="block">{formatDate(t.scheduledDate)}</span>}
            </span>
            <span className={cn("min-w-0 flex-1", gapIds.has(t.id) && "text-muted-foreground")}>
              {t.title}
              {t.description && <span className="block text-xs text-muted-foreground">{t.description}</span>}
            </span>
            <span className="flex flex-wrap gap-2 text-xs">
              {t.lectures.length > 0 ? (
                t.lectures.map((l) => (
                  <Link key={l.id} href={`/lectures/${l.id}`} className="hover:underline">
                    {l.title}
                  </Link>
                ))
              ) : gapIds.has(t.id) ? (
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-400">No notes</span>
              ) : (
                <span className="text-muted-foreground">Upcoming</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
