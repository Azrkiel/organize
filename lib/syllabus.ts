import { z } from "zod";
import { ASSESSMENT_KINDS } from "@/lib/assessment-kinds";

/** A calendar date as the AI writes it (and as the review screen edits it): `YYYY-MM-DD`. */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()
  // Models sometimes write "" or an unparseable date instead of null — treat as "no date".
  .catch(null);

const scheduleRowSchema = z.object({
  week: z.coerce.number().int().min(0).max(60).nullable().optional().catch(null),
  date: dateOnly,
  topics: z.array(z.string().trim().min(1)).default([]),
  readings: z.array(z.string().trim().min(1)).default([]),
});


const assessmentSchema = z.object({
  title: z.string().trim().min(1),
  kind: z.enum(ASSESSMENT_KINDS).catch("assignment"),
  date: dateOnly,
  weight: z.coerce.number().min(0).max(100).nullable().optional().catch(null),
  covers_weeks: z.array(z.coerce.number().int()).nullable().optional().catch(null),
});

/** The structured result of parsing a syllabus (PLAN.md Phase 13 task 2), stored in `syllabi.parsed`.
 * Lenient on purpose: a model's small mistakes (a bad date, an unknown assessment kind) degrade to
 * "no date"/"assignment" rather than rejecting the whole parse — the review screen is where the
 * owner fixes anything that came out wrong. */
export const parsedSyllabusSchema = z.object({
  course_name: z.string().nullable().optional().catch(null),
  instructor: z.string().nullable().optional().catch(null),
  schedule: z.array(scheduleRowSchema).default([]),
  assessments: z.array(assessmentSchema).default([]),
  grading: z
    .array(z.object({ component: z.string().trim().min(1), weight: z.coerce.number().min(0).max(100) }))
    .default([])
    .catch([]),
  policies_summary: z.string().nullable().optional().catch(null),
  /** Set when the reviewed syllabus was added to the course, so the review screen can warn that
   * adding it again would duplicate its events and tasks. */
  imported_at: z.string().nullable().optional().catch(null),
});

export type ParsedSyllabus = z.infer<typeof parsedSyllabusSchema>;
export type SyllabusScheduleRow = ParsedSyllabus["schedule"][number];
export type SyllabusAssessment = ParsedSyllabus["assessments"][number];

/** Pulls a JSON object out of a model reply that may be wrapped in a ```json fence or have a
 * sentence of preamble, then validates it. Returns null when there's no usable object at all. */
export function parseSyllabusJson(text: string): ParsedSyllabus | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = parsedSyllabusSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export type PlannedTopic = {
  title: string;
  description: string | null;
  week: number | null;
  scheduledDate: string | null;
  position: number;
};

/** What confirming an assessment creates (PLAN.md Phase 13 task 3). Exams and quizzes with a date
 * become an all-day `exam` calendar event; everything else becomes a task (with a due date when
 * there is one — its linked deadline event then syncs out through Phase 5 on its own). Each
 * assessment lands in the calendar exactly once, never as both an event and a task deadline. */
export type PlannedAssessment =
  | { type: "event"; title: string; date: string }
  | { type: "task"; title: string; date: string | null };

/** Turns the reviewed syllabus into the rows to create — pure, so it's testable without a DB. */
export function planSyllabusImport(parsed: ParsedSyllabus): {
  topics: PlannedTopic[];
  assessments: PlannedAssessment[];
} {
  const topics: PlannedTopic[] = [];
  for (const row of parsed.schedule) {
    const readings = row.readings.length > 0 ? `Readings: ${row.readings.join("; ")}` : null;
    for (const title of row.topics) {
      topics.push({
        title: title.slice(0, 200),
        description: readings,
        week: row.week ?? null,
        scheduledDate: row.date ?? null,
        position: topics.length,
      });
    }
  }

  const assessments: PlannedAssessment[] = parsed.assessments.map((a) => {
    const title = a.title.slice(0, 200);
    const date = a.date ?? null;
    if ((a.kind === "exam" || a.kind === "quiz") && date) return { type: "event", title, date };
    return { type: "task", title, date };
  });

  return { topics, assessments };
}

/** All-day events are stored at noon UTC on their date: the calendar buckets events by the
 * browser's local day, and noon UTC falls on the same calendar date everywhere from UTC-11 to
 * UTC+11, while the Google sync reads the date straight off the ISO string. */
export function allDayStartsAt(date: string): string {
  return `${date}T12:00:00.000Z`;
}
