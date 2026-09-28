import "server-only";
import { createClient } from "@/lib/supabase/server";
import { suggestTopics, type TopicLike } from "@/lib/topic-map";
import type { Lecture } from "@/lib/types";

export type TopicMapEntry = {
  id: string;
  title: string;
  description: string | null;
  week: number | null;
  scheduledDate: string | null;
  lectures: { id: string; title: string; hasNotes: boolean }[];
};

/** A course's topics in syllabus order, each with the lectures linked to it (PLAN.md Phase 13 task 4). */
export async function getCourseTopicMap(courseId: string): Promise<TopicMapEntry[]> {
  const supabase = await createClient();
  const { data: topics } = await supabase
    .from("topics")
    .select("id, title, description, week, scheduled_date")
    .eq("course_id", courseId)
    .order("position", { ascending: true });
  if (!topics || topics.length === 0) return [];

  const { data: links } = await supabase
    .from("lecture_topics")
    .select("topic_id, lectures(id, title, note_id)")
    .in(
      "topic_id",
      topics.map((t) => t.id)
    );

  const byTopic = new Map<string, TopicMapEntry["lectures"]>();
  for (const link of links ?? []) {
    if (!link.lectures) continue;
    const list = byTopic.get(link.topic_id) ?? [];
    list.push({ id: link.lectures.id, title: link.lectures.title, hasNotes: Boolean(link.lectures.note_id) });
    byTopic.set(link.topic_id, list);
  }

  return topics.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    week: t.week,
    scheduledDate: t.scheduled_date,
    lectures: byTopic.get(t.id) ?? [],
  }));
}

export type LectureTopicsData = {
  topics: TopicLike[];
  linkedIds: string[];
  suggestedIds: string[];
};

/**
 * A lecture's course topics, which are already linked, and — once the lecture has generated notes
 * — which ones it most likely covers (PLAN.md Phase 13 task 4), matched against the note's text.
 * Null when the lecture has no course or the course has no topics yet.
 */
export async function getLectureTopicsData(lecture: Lecture): Promise<LectureTopicsData | null> {
  if (!lecture.course_id) return null;
  const supabase = await createClient();

  const [{ data: topics }, { data: links }, { data: note }] = await Promise.all([
    supabase
      .from("topics")
      .select("id, title, scheduled_date")
      .eq("course_id", lecture.course_id)
      .order("position", { ascending: true }),
    supabase.from("lecture_topics").select("topic_id").eq("lecture_id", lecture.id),
    lecture.note_id
      ? supabase.from("notes").select("title, content_text").eq("id", lecture.note_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!topics || topics.length === 0) return null;

  const topicList: TopicLike[] = topics.map((t) => ({ id: t.id, title: t.title, scheduledDate: t.scheduled_date }));
  const linkedIds = (links ?? []).map((l) => l.topic_id);

  const suggestedIds = note
    ? suggestTopics(
        { text: `${note.title} ${note.content_text ?? ""}`, date: lecture.recorded_at.slice(0, 10) },
        topicList,
        new Set(linkedIds)
      ).map((t) => t.id)
    : [];

  return { topics: topicList, linkedIds, suggestedIds };
}
