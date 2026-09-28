/** Pure topic-map logic (PLAN.md Phase 13 tasks 4-5): suggesting which topics a lecture covers,
 * and working out which topics are still gaps. No AI calls — plain date and keyword matching. */

export type TopicLike = { id: string; title: string; scheduledDate: string | null };

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "into", "intro", "introduction", "part", "review", "chapter",
  "unit", "week", "lecture", "topic", "topics", "section", "overview", "basics", "basic", "of", "to", "in", "on", "an",
]);

/** Crude singular form: "classes" -> "class", "bases" -> "base", "acids" -> "acid". */
function singular(w: string): string {
  if (/(ss|x|z|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** Lowercased singular words of 3+ letters, minus filler words. */
export function keywords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const out = new Set<string>();
  for (const w of words) {
    if (w.length < 3 || STOPWORDS.has(w)) continue;
    out.add(singular(w));
  }
  return out;
}

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/**
 * Topics this lecture most likely covers, best first. A topic qualifies if most of its title's
 * keywords appear in the lecture's text, or if it was scheduled within a few days of the lecture
 * (a syllabus date is a strong hint even when the wording differs); both together rank highest.
 */
export function suggestTopics(
  lecture: { text: string; date: string | null },
  topics: TopicLike[],
  exclude: Set<string> = new Set(),
  limit = 3
): TopicLike[] {
  const textWords = keywords(lecture.text);
  const scored: { topic: TopicLike; score: number }[] = [];

  for (const topic of topics) {
    if (exclude.has(topic.id)) continue;
    const titleWords = [...keywords(topic.title)];
    const overlap = titleWords.length > 0 ? titleWords.filter((w) => textWords.has(w)).length / titleWords.length : 0;

    let score = overlap >= 0.5 ? overlap : 0;
    if (lecture.date && topic.scheduledDate) {
      const days = daysBetween(lecture.date, topic.scheduledDate);
      if (days <= 3) score += 1 - days / 4;
    }
    if (score > 0) scored.push({ topic, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.topic);
}

/** A topic is a gap once its scheduled date has arrived (or it has none) and no linked lecture
 * has notes yet. Topics scheduled for the future aren't gaps — there's nothing to have missed. */
export function isTopicGap(topic: { scheduledDate: string | null; hasNotes: boolean }, today: string): boolean {
  if (topic.hasNotes) return false;
  return topic.scheduledDate === null || topic.scheduledDate <= today;
}
