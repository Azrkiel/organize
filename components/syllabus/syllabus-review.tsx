"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  confirmSyllabusImport,
  getSyllabusPrompt,
  parseSyllabus,
  savePastedSyllabus,
} from "@/app/(app)/actions/syllabus";
import { ASSESSMENT_KINDS, type AssessmentKind } from "@/lib/assessment-kinds";
import type { ParsedSyllabus } from "@/lib/syllabus";

const selectClass =
  "h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/** Step 1 of the review screen: turn raw syllabus text into structure — Gemini when a key is set,
 * otherwise the copy-prompt/paste-JSON fallback (PLAN.md Phase 13 task 2). */
export function SyllabusParsePanel({ syllabusId, geminiConfigured }: { syllabusId: string; geminiConfigured: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reply, setReply] = useState("");

  async function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    setPending(true);
    try {
      const result = await action();
      if (result.error) setError(result.error);
      else router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleCopy() {
    setError(null);
    const result = await getSyllabusPrompt(syllabusId);
    if (!result.prompt) return setError(result.error ?? "Could not build the prompt.");
    try {
      await navigator.clipboard.writeText(result.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy — your browser blocked clipboard access.");
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      {geminiConfigured ? (
        <Button size="sm" onClick={() => run(() => parseSyllabus(syllabusId))} disabled={pending}>
          <Sparkles className="size-4" /> {pending ? "Reading syllabus…" : "Read schedule & assessments"}
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            No Gemini API key is set — copy the prompt into a Claude chat (or any AI), then paste the JSON reply below.
          </p>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy prompt for Claude"}
          </Button>
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className="min-h-40 font-mono text-xs"
            placeholder='{"course_name": ...}'
            aria-label="Pasted JSON reply"
          />
          <Button size="sm" onClick={() => run(() => savePastedSyllabus(syllabusId, reply))} disabled={pending || !reply.trim()}>
            {pending ? "Saving…" : "Use this reply"}
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

type ScheduleDraft = { week: string; date: string; topics: string; readings: string };
type AssessmentDraft = { title: string; kind: AssessmentKind; date: string; weight: string };

function splitList(value: string): string[] {
  return value
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toNumber(value: string): number | null {
  const n = Number(value);
  return value.trim() === "" || Number.isNaN(n) ? null : n;
}

/** Step 2 (PLAN.md Phase 13 task 3): editable schedule and assessment tables. Nothing is created
 * until "Add to course" — then topics, calendar events, and tasks are all created in one go. */
export function SyllabusReviewTables({
  syllabusId,
  courseId,
  parsed,
  existingTopicCount,
}: {
  syllabusId: string;
  courseId: string;
  parsed: ParsedSyllabus;
  existingTopicCount: number;
}) {
  const [schedule, setSchedule] = useState<ScheduleDraft[]>(() =>
    parsed.schedule.map((r) => ({
      week: r.week?.toString() ?? "",
      date: r.date ?? "",
      topics: r.topics.join("; "),
      readings: r.readings.join("; "),
    }))
  );
  const [assessments, setAssessments] = useState<AssessmentDraft[]>(() =>
    parsed.assessments.map((a) => ({ title: a.title, kind: a.kind, date: a.date ?? "", weight: a.weight?.toString() ?? "" }))
  );
  const [replaceTopics, setReplaceTopics] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ topics: number; events: number; tasks: number } | null>(null);

  function updateRow<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number, patch: Partial<T>) {
    setter((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function handleConfirm() {
    setError(null);
    setPending(true);
    try {
      const result = await confirmSyllabusImport({
        syllabusId,
        replaceTopics,
        parsed: {
          ...parsed,
          schedule: schedule
            .map((r) => ({
              week: toNumber(r.week),
              date: r.date || null,
              topics: splitList(r.topics),
              readings: splitList(r.readings),
            }))
            .filter((r) => r.topics.length > 0),
          assessments: assessments
            .filter((a) => a.title.trim())
            .map((a) => ({ title: a.title.trim(), kind: a.kind, date: a.date || null, weight: toNumber(a.weight) })),
        },
      });
      if (result.error) setError(result.error);
      else setDone({ topics: result.topics ?? 0, events: result.events ?? 0, tasks: result.tasks ?? 0 });
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-2 rounded-lg border p-4 text-sm">
        <p className="font-medium">Added to the course.</p>
        <p className="text-muted-foreground">
          {done.topics} topics, {done.events} exam/quiz events, and {done.tasks} tasks. Anything with a date is syncing to
          your connected calendars.
        </p>
        <Link href={`/courses/${courseId}`} className="font-medium hover:underline">
          Back to the course →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {(parsed.instructor || parsed.policies_summary || parsed.grading.length > 0) && (
        <div className="space-y-1 text-sm text-muted-foreground">
          {parsed.instructor && <p>Instructor: {parsed.instructor}</p>}
          {parsed.grading.length > 0 && (
            <p>Grading: {parsed.grading.map((g) => `${g.component} ${g.weight}%`).join(" · ")}</p>
          )}
          {parsed.policies_summary && <p>{parsed.policies_summary}</p>}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Schedule</h2>
        <p className="text-xs text-muted-foreground">Separate multiple topics or readings with semicolons.</p>
        <div className="space-y-2">
          {schedule.map((row, i) => (
            <div key={i} className="grid grid-cols-[4rem_9rem_1fr_auto] gap-2 max-sm:grid-cols-[4rem_1fr_auto]">
              <Input value={row.week} onChange={(e) => updateRow(setSchedule, i, { week: e.target.value })} placeholder="Wk" aria-label="Week" inputMode="numeric" />
              <Input type="date" value={row.date} onChange={(e) => updateRow(setSchedule, i, { date: e.target.value })} aria-label="Date" />
              <div className="space-y-1 max-sm:col-span-3 max-sm:row-start-2">
                <Input value={row.topics} onChange={(e) => updateRow(setSchedule, i, { topics: e.target.value })} placeholder="Topics" aria-label="Topics" />
                <Input value={row.readings} onChange={(e) => updateRow(setSchedule, i, { readings: e.target.value })} placeholder="Readings" aria-label="Readings" className="text-xs" />
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setSchedule((rows) => rows.filter((_, j) => j !== i))} aria-label="Remove row">
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSchedule((rows) => [...rows, { week: "", date: "", topics: "", readings: "" }])}>
          <Plus className="size-4" /> Add week
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Assessments</h2>
        <p className="text-xs text-muted-foreground">
          Dated exams and quizzes become calendar events; everything else becomes a task, due 11:59 PM on its date.
        </p>
        <div className="space-y-2">
          {assessments.map((a, i) => (
            <div key={i} className="grid grid-cols-[1fr_7.5rem_9rem_4.5rem_auto] gap-2 max-sm:grid-cols-2">
              <Input value={a.title} onChange={(e) => updateRow(setAssessments, i, { title: e.target.value })} placeholder="Title" aria-label="Title" className="max-sm:col-span-2" />
              <select
                value={a.kind}
                onChange={(e) => updateRow(setAssessments, i, { kind: e.target.value as AssessmentKind })}
                className={selectClass}
                aria-label="Kind"
              >
                {ASSESSMENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k[0].toUpperCase() + k.slice(1)}
                  </option>
                ))}
              </select>
              <Input type="date" value={a.date} onChange={(e) => updateRow(setAssessments, i, { date: e.target.value })} aria-label="Date" />
              <Input value={a.weight} onChange={(e) => updateRow(setAssessments, i, { weight: e.target.value })} placeholder="%" aria-label="Weight" inputMode="decimal" />
              <Button variant="ghost" size="icon-sm" onClick={() => setAssessments((rows) => rows.filter((_, j) => j !== i))} aria-label="Remove assessment" className="justify-self-end">
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setAssessments((rows) => [...rows, { title: "", kind: "assignment", date: "", weight: "" }])}>
          <Plus className="size-4" /> Add assessment
        </Button>
      </section>

      <div className="space-y-3 border-t pt-4">
        {parsed.imported_at && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            This syllabus was already added on {new Date(parsed.imported_at).toLocaleDateString()}. Adding it again
            creates its events and tasks a second time.
          </p>
        )}
        {existingTopicCount > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={replaceTopics} onCheckedChange={(c) => setReplaceTopics(c === true)} />
            Replace this course&apos;s {existingTopicCount} existing topics (otherwise they&apos;re kept and these are added)
          </label>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleConfirm} disabled={pending}>
          {pending ? "Adding…" : "Add to course"}
        </Button>
      </div>
    </div>
  );
}
