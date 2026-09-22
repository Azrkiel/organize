import * as chrono from "chrono-node";

export type ParsedTaskInput = {
  /** What's left after stripping the date/time, priority, and course tag. Empty if nothing but those was typed. */
  title: string;
  dueAt: Date | null;
  /** 0 none, 1 low, 2 med, 3 high — matches tasks.priority. */
  priority: 0 | 1 | 2 | 3;
  /** Raw text after `#`, e.g. "calc". Resolving it to a real course is the caller's job (parse-task stays pure/DB-free). */
  courseTag: string | null;
};

const COURSE_TAG = /#([a-zA-Z][\w-]*)/;
const PRIORITY_TAG = /!(high|hi|med(?:ium)?|low)\b/i;

const PRIORITY_MAP: Record<string, 1 | 2 | 3> = {
  high: 3,
  hi: 3,
  med: 2,
  medium: 2,
  low: 1,
};

/** Removes `match` from `text` and collapses the whitespace that leaves behind. */
function strip(text: string, match: string): string {
  return text.replace(match, " ").replace(/\s+/g, " ").trim();
}

/**
 * Parses quick-add task input like "calc hw tomorrow 5pm !high #calc" into a title, due date,
 * priority, and course tag. Pure and DB-free (course tags are resolved by the caller against the
 * real course list) so it's easy to unit test. `referenceDate` anchors relative dates like
 * "tomorrow" — defaults to now, override it in tests for deterministic results.
 */
export function parseTaskInput(input: string, referenceDate: Date = new Date()): ParsedTaskInput {
  let text = input;

  const courseMatch = text.match(COURSE_TAG);
  const courseTag = courseMatch ? courseMatch[1] : null;
  if (courseMatch) text = strip(text, courseMatch[0]);

  const priorityMatch = text.match(PRIORITY_TAG);
  const priority = priorityMatch ? PRIORITY_MAP[priorityMatch[1].toLowerCase()] : 0;
  if (priorityMatch) text = strip(text, priorityMatch[0]);

  const [chronoResult] = chrono.parse(text, referenceDate, { forwardDate: true });
  const dueAt = chronoResult ? chronoResult.start.date() : null;
  if (chronoResult) text = strip(text, chronoResult.text);

  return { title: text.trim(), dueAt, priority, courseTag };
}
